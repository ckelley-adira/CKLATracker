/**
 * ============================================================
 * CKLA Skills Tracking — Apps Script System
 * File: TeacherSheetSync.gs
 * Purpose: Phase 2 — Create lightweight per-teacher input
 *          sheets for the current unit, synced back to the
 *          master workbook.
 * ============================================================
 */

// Prefix for teacher input sheet names
const TEACHER_SHEET_PREFIX = '_Input: ';


/**
 * Create a per-teacher input sheet for a specific unit.
 * The sheet contains only the teacher's students with editable
 * score columns. Formulas, other teachers' data, and summary
 * rows are excluded to keep it lightweight.
 *
 * @param {string} tabName - The unit tab to create an input sheet for
 * @param {string} teacher - Teacher name
 * @returns {Object} - { success, sheetName } or { success, error }
 */
function createTeacherInputSheet(tabName, teacher) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sourceSheet = ss.getSheetByName(tabName);

  if (!sourceSheet) {
    return { success: false, error: 'Tab not found: ' + tabName };
  }

  var structure = getUnitStructure(tabName);
  if (structure.error) {
    return { success: false, error: structure.error };
  }

  var students = getStudentsForTeacher(tabName, teacher);
  if (students.length === 0) {
    return { success: false, error: 'No students found for ' + teacher + ' in ' + tabName };
  }

  // Sheet name: "_Input: Teacher — Unit"
  var sheetName = TEACHER_SHEET_PREFIX + teacher + ' — ' + tabName;

  // Truncate to Google Sheets' 100-character tab name limit
  if (sheetName.length > 100) {
    sheetName = sheetName.substring(0, 97) + '...';
  }

  // Delete existing sheet if present
  var existing = ss.getSheetByName(sheetName);
  if (existing) {
    ss.deleteSheet(existing);
  }

  var inputSheet = ss.insertSheet(sheetName);

  // ===================== BUILD HEADER ========================

  // Row 1: Title
  inputSheet.getRange(1, 1, 1, 4).merge();
  inputSheet.getRange(1, 1)
    .setValue(tabName + ' — ' + teacher)
    .setFontSize(14)
    .setFontWeight('bold')
    .setFontColor('#1a73e8');

  // Row 2: Instructions
  inputSheet.getRange(2, 1, 1, 4).merge();
  inputSheet.getRange(2, 1)
    .setValue('Enter scores below. Click "CKLA Tools → Phase 2 → Sync Input Sheets" when done.')
    .setFontSize(11)
    .setFontColor('#5f6368');

  // Row 3: Column headers — Student name + question names
  var headerRow = 3;
  inputSheet.getRange(headerRow, 1)
    .setValue('Student Name')
    .setFontWeight('bold')
    .setBackground('#e8f0fe');

  var colIndex = 2;
  var columnMapping = []; // Track { inputCol, sourceCol, maxPoints }

  structure.sections.forEach(function(section) {
    section.questions.forEach(function(q) {
      inputSheet.getRange(headerRow, colIndex)
        .setValue(q.name)
        .setFontWeight('bold')
        .setFontSize(10)
        .setBackground('#e8f0fe')
        .setHorizontalAlignment('center');

      // Row 4: Max points reference
      inputSheet.getRange(headerRow + 1, colIndex)
        .setValue('/' + q.maxPoints)
        .setFontSize(9)
        .setFontColor('#9aa0a6')
        .setHorizontalAlignment('center');

      columnMapping.push({
        inputCol: colIndex,
        sourceCol: q.col,
        maxPoints: q.maxPoints,
        name: q.name
      });

      colIndex++;
    });
  });

  // ===================== POPULATE STUDENTS ====================

  var dataStartRow = 5; // Row 5 onward: student data

  students.forEach(function(student, idx) {
    var row = dataStartRow + idx;

    // Student name (read-only — protected later)
    inputSheet.getRange(row, 1)
      .setValue(student.name)
      .setFontColor('#3c4043');

    // Pre-fill existing scores from the master tab
    columnMapping.forEach(function(cm) {
      var existingValue = sourceSheet.getRange(student.row, cm.sourceCol).getValue();
      if (existingValue !== '' && existingValue !== null) {
        inputSheet.getRange(row, cm.inputCol).setValue(existingValue);
      }

      // Add data validation (0 to maxPoints)
      var rule = SpreadsheetApp.newDataValidation()
        .requireNumberBetween(0, cm.maxPoints)
        .setAllowInvalid(false)
        .setHelpText('Enter 0–' + cm.maxPoints)
        .build();
      inputSheet.getRange(row, cm.inputCol).setDataValidation(rule);
    });

    // Alternating row colors
    if (idx % 2 === 1) {
      inputSheet.getRange(row, 1, 1, colIndex - 1)
        .setBackground('#f8f9fa');
    }
  });

  // ===================== METADATA (hidden row) ===============
  // Store mapping metadata in a hidden row for sync
  var metaRow = dataStartRow + students.length + 2;
  inputSheet.getRange(metaRow, 1).setValue('__META__');
  inputSheet.getRange(metaRow, 2).setValue(JSON.stringify({
    sourceTab: tabName,
    teacher: teacher,
    dataStartRow: dataStartRow,
    columnMapping: columnMapping,
    studentCount: students.length,
    createdAt: new Date().toISOString()
  }));
  // Hide the metadata row
  inputSheet.hideRows(metaRow);

  // ===================== PROTECT NAME COLUMN =================
  var protection = inputSheet.getRange(dataStartRow, 1, students.length, 1)
    .protect()
    .setDescription('Student names — do not edit');
  // Remove all editors except the owner
  protection.setWarningOnly(true);

  // Freeze header rows
  inputSheet.setFrozenRows(headerRow + 1);
  inputSheet.setFrozenColumns(1);

  // Auto-resize columns
  inputSheet.autoResizeColumn(1);

  // Move to end of workbook
  ss.moveActiveSheet(ss.getNumSheets());

  return {
    success: true,
    sheetName: sheetName,
    studentCount: students.length,
    questionCount: columnMapping.length,
    message: 'Created input sheet for ' + teacher + ' with ' +
             students.length + ' students and ' + columnMapping.length + ' questions.'
  };
}


/**
 * Sync all teacher input sheets back to the master unit tabs.
 * Reads scores from each input sheet and writes them to the
 * corresponding cells in the source tab.
 *
 * @returns {Object} - { success, synced, errors }
 */
function syncAllTeacherInputSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var synced = 0;
  var errors = [];

  sheets.forEach(function(sheet) {
    var name = sheet.getName();
    if (!name.startsWith(TEACHER_SHEET_PREFIX)) return;

    var result = syncSingleInputSheet_(ss, sheet);
    if (result.success) {
      synced += result.written;
    } else {
      errors.push(name + ': ' + result.error);
    }
  });

  if (errors.length === 0) {
    SpreadsheetApp.getUi().alert(
      'Sync Complete',
      'Successfully synced ' + synced + ' score(s) from teacher input sheets.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } else {
    SpreadsheetApp.getUi().alert(
      'Sync Complete (with errors)',
      'Synced ' + synced + ' score(s).\n\nErrors:\n' + errors.join('\n'),
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }

  return { success: true, synced: synced, errors: errors };
}


/**
 * Internal: sync a single teacher input sheet to the master tab.
 *
 * @param {Spreadsheet} ss
 * @param {Sheet} inputSheet
 * @returns {Object} - { success, written } or { success, error }
 */
function syncSingleInputSheet_(ss, inputSheet) {
  try {
    // Find the metadata row
    var lastRow = inputSheet.getLastRow();
    var meta = null;

    for (var r = lastRow; r >= 1; r--) {
      if (inputSheet.getRange(r, 1).getValue() === '__META__') {
        var metaJson = inputSheet.getRange(r, 2).getValue();
        meta = JSON.parse(metaJson);
        break;
      }
    }

    if (!meta) {
      return { success: false, error: 'No metadata found' };
    }

    var sourceSheet = ss.getSheetByName(meta.sourceTab);
    if (!sourceSheet) {
      return { success: false, error: 'Source tab not found: ' + meta.sourceTab };
    }

    var written = 0;

    // Read student names and scores from the input sheet
    for (var i = 0; i < meta.studentCount; i++) {
      var row = meta.dataStartRow + i;
      var studentName = String(inputSheet.getRange(row, 1).getValue()).trim();

      if (!studentName) continue;

      // Find this student's row in the source tab
      var sourceRow = findStudentRow(meta.sourceTab, studentName);
      if (sourceRow === -1) continue;

      // Copy each score column
      meta.columnMapping.forEach(function(cm) {
        var value = inputSheet.getRange(row, cm.inputCol).getValue();
        if (value !== '' && value !== null) {
          var numVal = Number(value);
          if (!isNaN(numVal) && numVal >= 0 && numVal <= cm.maxPoints) {
            sourceSheet.getRange(sourceRow, cm.sourceCol).setValue(numVal);
            written++;
          }
        }
      });
    }

    return { success: true, written: written };

  } catch (e) {
    return { success: false, error: e.message };
  }
}


/**
 * Show a dialog to create a teacher input sheet.
 * Teacher selects a grade, unit, and teacher name.
 */
function showCreateTeacherSheetDialog() {
  var html = '<div style="font-family:Google Sans,sans-serif;padding:16px">' +
    '<h3 style="color:#1a73e8;margin-bottom:12px">Create Teacher Input Sheet</h3>' +
    '<p style="font-size:12px;color:#5f6368;margin-bottom:12px">' +
    'Creates a lightweight sheet with only your students and score columns. ' +
    'Sync back to the master tab when finished.</p>' +
    '<div style="margin-bottom:10px">' +
    '<label style="font-size:12px;font-weight:500;display:block;margin-bottom:4px">Grade</label>' +
    '<select id="tsGrade" onchange="loadTeachers()" style="width:100%;padding:8px;' +
    'border:1px solid #dadce0;border-radius:4px">' +
    '<option value="">Select grade...</option>' +
    '<option value="K">Kindergarten</option>' +
    '<option value="1">Grade 1</option>' +
    '<option value="2">Grade 2</option></select></div>' +
    '<div style="margin-bottom:10px">' +
    '<label style="font-size:12px;font-weight:500;display:block;margin-bottom:4px">Unit</label>' +
    '<select id="tsUnit" style="width:100%;padding:8px;border:1px solid #dadce0;' +
    'border-radius:4px" disabled><option>Select grade first...</option></select></div>' +
    '<div style="margin-bottom:10px">' +
    '<label style="font-size:12px;font-weight:500;display:block;margin-bottom:4px">Teacher</label>' +
    '<select id="tsTeacher" style="width:100%;padding:8px;border:1px solid #dadce0;' +
    'border-radius:4px" disabled><option>Select grade first...</option></select></div>' +
    '<button onclick="create()" style="width:100%;padding:8px;background:#1a73e8;' +
    'color:white;border:none;border-radius:4px;cursor:pointer">Create Input Sheet</button>' +
    '<div id="tsResult" style="margin-top:8px;font-size:12px"></div>' +
    '<script>var unitTabs={};' +
    'google.script.run.withSuccessHandler(function(t){unitTabs=t}).getUnitTabs();' +
    'function loadTeachers(){' +
    'var g=document.getElementById("tsGrade").value;if(!g)return;' +
    'var uSel=document.getElementById("tsUnit");' +
    'uSel.innerHTML="<option value=\\"\\">Select unit...</option>";' +
    'if(unitTabs[g]){unitTabs[g].tabs.forEach(function(t){' +
    'var o=document.createElement("option");o.value=t;o.textContent=t;uSel.appendChild(o)});}' +
    'uSel.disabled=false;' +
    'var tSel=document.getElementById("tsTeacher");' +
    'tSel.innerHTML="<option>Loading...</option>";' +
    'google.script.run.withSuccessHandler(function(teachers){' +
    'tSel.innerHTML="<option value=\\"\\">Select teacher...</option>";' +
    'teachers.forEach(function(t){var o=document.createElement("option");' +
    'o.value=t;o.textContent=t;tSel.appendChild(o)});' +
    'tSel.disabled=false;}).getTeachersForGrade(g);}' +
    'function create(){' +
    'var tab=document.getElementById("tsUnit").value;' +
    'var teacher=document.getElementById("tsTeacher").value;' +
    'if(!tab||!teacher){alert("Select unit and teacher");return;}' +
    'document.getElementById("tsResult").textContent="Creating...";' +
    'google.script.run.withSuccessHandler(function(r){' +
    'if(r.success){document.getElementById("tsResult").innerHTML=' +
    '"<span style=\\"color:#137333\\">✓ "+r.message+"</span>";}' +
    'else{document.getElementById("tsResult").innerHTML=' +
    '"<span style=\\"color:#d93025\\">✗ "+r.error+"</span>";}' +
    '}).createTeacherInputSheet(tab,teacher);}' +
    '</script></div>';

  var output = HtmlService.createHtmlOutput(html)
    .setWidth(420)
    .setHeight(400);
  SpreadsheetApp.getUi().showModalDialog(output, 'Create Teacher Input Sheet');
}


/**
 * Clean up all teacher input sheets.
 * Useful after syncing to remove temporary sheets.
 *
 * @returns {Object} - { success, deleted }
 */
function cleanupTeacherInputSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  var response = ui.alert(
    'Clean Up Input Sheets',
    'This will delete ALL teacher input sheets (tabs starting with "' +
    TEACHER_SHEET_PREFIX + '").\n\nMake sure you have synced first!\n\nContinue?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return { success: false, error: 'Cancelled' };

  var sheets = ss.getSheets();
  var deleted = 0;

  // Iterate in reverse to avoid index shifting issues
  for (var i = sheets.length - 1; i >= 0; i--) {
    if (sheets[i].getName().startsWith(TEACHER_SHEET_PREFIX)) {
      ss.deleteSheet(sheets[i]);
      deleted++;
    }
  }

  ui.alert(
    'Cleanup Complete',
    'Deleted ' + deleted + ' teacher input sheet(s).',
    ui.ButtonSet.OK
  );

  return { success: true, deleted: deleted };
}
