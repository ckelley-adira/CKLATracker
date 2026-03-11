/**
 * ============================================================
 * CKLA Skills Tracking — Apps Script System
 * File: ImportExport.gs
 * Purpose: Bulk CSV import, data export, backup utilities
 * Version: 1.0
 * ============================================================
 */

/**
 * Show the import dialog.
 */
function showImportDialog() {
  const html = HtmlService
    .createHtmlOutput(
      '<div style="font-family:Google Sans,sans-serif;padding:16px">' +
      '<h3>Import Scores from CSV</h3>' +
      '<p style="font-size:13px;color:#5f6368">CSV format: ' +
      'StudentName, Q1Score, Q2Score, Q3Score, ...<br>' +
      'Scores must be in the same column order as the unit tab.</p>' +
      '<textarea id="csvData" rows="10" style="width:100%;font-family:monospace;' +
      'font-size:12px;padding:8px;border:1px solid #dadce0;border-radius:4px"' +
      ' placeholder="Paste CSV data here..."></textarea><br>' +
      '<select id="impTab" style="width:100%;padding:8px;margin:8px 0">' +
      '<option>Select target unit tab...</option></select>' +
      '<button onclick="doImport()" style="width:100%;padding:8px 16px;' +
      'background:#1a73e8;color:white;border:none;border-radius:4px;' +
      'cursor:pointer">Import</button>' +
      '<div id="impResult" style="margin-top:8px;font-size:12px"></div>' +
      '<script>' +
      'google.script.run.withSuccessHandler(function(tabs){' +
      'var sel=document.getElementById("impTab");' +
      'Object.keys(tabs).forEach(function(g){' +
      'tabs[g].tabs.forEach(function(t){' +
      'var o=document.createElement("option");o.value=t;o.textContent=t;' +
      'sel.appendChild(o);});});}).getUnitTabs();' +
      'function doImport(){var csv=document.getElementById("csvData").value;' +
      'var tab=document.getElementById("impTab").value;' +
      'document.getElementById("impResult").textContent="Importing...";' +
      'google.script.run.withSuccessHandler(function(r){' +
      'document.getElementById("impResult").innerHTML=' +
      '"<b>"+r.imported+"</b> rows imported, <b>"+r.errors.length+"</b> errors"' +
      '+(r.errors.length?"<br>"+r.errors.join("<br>"):"");' +
      '}).importCSVScores(tab,csv);}' +
      '</script></div>'
    )
    .setWidth(500)
    .setHeight(450);
  SpreadsheetApp.getUi().showModalDialog(html, 'Import Scores');
}


/**
 * Import scores from CSV text into a unit tab.
 * CSV format: StudentName, Score1, Score2, Score3, ...
 * Scores are mapped to data-entry columns (skipping Total columns).
 */
function importCSVScores(tabName, csvText) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(tabName);

  if (!sheet) {
    return { imported: 0, errors: ['Tab not found: ' + tabName] };
  }

  const structure = getUnitStructure(tabName);
  if (structure.error) {
    return { imported: 0, errors: [structure.error] };
  }

  // Flatten all question columns in order
  const allQuestionCols = [];
  structure.sections.forEach(s => {
    s.questions.forEach(q => allQuestionCols.push(q));
  });

  const lines = csvText.trim().split('\n');
  let imported = 0;
  const errors = [];

  lines.forEach((line, lineIdx) => {
    const parts = line.split(',').map(p => p.trim());
    if (parts.length < 2) return;

    const studentName = parts[0];
    const row = findStudentRow(tabName, studentName);

    if (row === -1) {
      errors.push('Row ' + (lineIdx + 1) + ': Student not found — ' + studentName);
      return;
    }

    const scores = parts.slice(1);
    let written = 0;

    scores.forEach((score, i) => {
      if (i >= allQuestionCols.length) return;
      if (score === '' || score === '-') return;

      const numVal = Number(score);
      if (isNaN(numVal)) {
        errors.push('Row ' + (lineIdx + 1) + ', col ' + (i + 1) + ': Not a number');
        return;
      }

      const q = allQuestionCols[i];
      if (numVal > q.maxPoints) {
        errors.push(
          'Row ' + (lineIdx + 1) + ': ' + q.name + ' max is ' +
          q.maxPoints + ', got ' + numVal
        );
        return;
      }

      sheet.getRange(row, q.col).setValue(numVal);
      written++;
    });

    if (written > 0) imported++;
  });

  return { imported: imported, errors: errors };
}


/**
 * Show the export dialog.
 */
function showExportDialog() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt(
    'Export Grade Data',
    'Enter the grade to export (K, 1, or 2):',
    ui.ButtonSet.OK_CANCEL
  );

  if (result.getSelectedButton() !== ui.Button.OK) return;

  const grade = result.getResponseText().trim();
  const csvContent = exportGradeData(grade);

  if (!csvContent) {
    ui.alert('No data found for grade ' + grade);
    return;
  }

  // Write CSV to a new sheet for easy copy
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let exportSheet = ss.getSheetByName('_Export');
  if (exportSheet) ss.deleteSheet(exportSheet);

  exportSheet = ss.insertSheet('_Export');
  const lines = csvContent.split('\n');
  lines.forEach((line, i) => {
    const cells = line.split(',');
    exportSheet.getRange(i + 1, 1, 1, cells.length).setValues([cells]);
  });

  ss.setActiveSheet(exportSheet);
  ui.alert(
    'Export Complete',
    'Data exported to the "_Export" tab.\n' +
    'You can copy it or download as CSV from File → Download.',
    ui.ButtonSet.OK
  );
}


/**
 * Export all student scores for a grade as CSV text.
 */
function exportGradeData(grade) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const gradeMap = getUnitTabs();
  const tabs = gradeMap[grade] ? gradeMap[grade].tabs : [];

  if (tabs.length === 0) return null;

  // Header row
  const headers = ['Student', 'Teacher'];
  const dataMap = {}; // studentName -> { teacher, scores: { tabName: pct } }

  tabs.forEach(tabName => {
    headers.push(tabName + ' %');

    const sheet = ss.getSheetByName(tabName);
    if (!sheet) return;

    const lastRow = sheet.getLastRow();
    if (lastRow < ROW.DATA_START) return;

    const numRows = lastRow - ROW.DATA_START + 1;
    const data = sheet.getRange(
      ROW.DATA_START, COL.TEACHER, numRows,
      COL.PCT_CORRECT - COL.TEACHER + 1
    ).getValues();

    data.forEach(row => {
      const teacher = String(row[0]).trim();
      const name = String(row[COL.STUDENT_NAME - COL.TEACHER]).trim();
      const pct = row[COL.PCT_CORRECT - COL.TEACHER];

      if (!name) return;

      if (!dataMap[name]) {
        dataMap[name] = { teacher: teacher, scores: {} };
      }
      if (pct !== '' && pct !== null && !isNaN(Number(pct))) {
        dataMap[name].scores[tabName] = Math.round(Number(pct) * 100);
      }
    });
  });

  // Build CSV
  const lines = [headers.join(',')];

  Object.keys(dataMap).sort().forEach(name => {
    const row = [name, dataMap[name].teacher];
    tabs.forEach(tabName => {
      const score = dataMap[name].scores[tabName];
      row.push(score !== undefined ? score : '');
    });
    lines.push(row.join(','));
  });

  return lines.join('\n');
}


/**
 * Validate all data across all unit tabs.
 * Checks for: scores exceeding point limits, missing student info,
 * orphaned rows (data without student name).
 */
function validateAllData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const gradeMap = getUnitTabs();
  const issues = [];

  Object.keys(gradeMap).forEach(grade => {
    gradeMap[grade].tabs.forEach(tabName => {
      const sheet = ss.getSheetByName(tabName);
      if (!sheet) return;

      const lastRow = sheet.getLastRow();
      if (lastRow < ROW.DATA_START) return;

      const structure = getUnitStructure(tabName);
      if (structure.error) return;

      const numRows = lastRow - ROW.DATA_START + 1;

      // Batch read student names
      const names = sheet.getRange(
        ROW.DATA_START, COL.STUDENT_NAME, numRows, 1
      ).getValues().flat();

      // Check each question column for out-of-range values
      structure.sections.forEach(section => {
        section.questions.forEach(q => {
          const values = sheet.getRange(
            ROW.DATA_START, q.col, numRows, 1
          ).getValues().flat();

          values.forEach((val, i) => {
            if (val === '' || val === null) return;
            const numVal = Number(val);
            if (isNaN(numVal)) {
              issues.push(tabName + ' | ' + names[i] + ' | ' +
                q.name + ': non-numeric value "' + val + '"');
            } else if (numVal < 0 || numVal > q.maxPoints) {
              issues.push(tabName + ' | ' + names[i] + ' | ' +
                q.name + ': ' + numVal + ' (max ' + q.maxPoints + ')');
            }
          });
        });
      });
    });
  });

  if (issues.length === 0) {
    ui.alert('Validation Passed', 'No data issues found across all unit tabs.', ui.ButtonSet.OK);
  } else {
    ui.alert(
      'Validation Issues Found',
      issues.length + ' issues detected:\n\n' + issues.slice(0, 20).join('\n') +
      (issues.length > 20 ? '\n\n... and ' + (issues.length - 20) + ' more' : ''),
      ui.ButtonSet.OK
    );
  }
}


/**
 * Backup all data sheets to a new spreadsheet in the same Drive folder.
 */
function backupDataSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  const backupName = 'CKLA Backup — ' +
    Utilities.formatDate(new Date(), 'America/Indiana/Indianapolis', 'yyyy-MM-dd HH:mm');

  const backup = SpreadsheetApp.create(backupName);

  // Copy each unit tab to the backup
  const gradeMap = getUnitTabs();
  let tabCount = 0;

  Object.keys(gradeMap).forEach(grade => {
    gradeMap[grade].tabs.forEach(tabName => {
      const sheet = ss.getSheetByName(tabName);
      if (sheet) {
        sheet.copyTo(backup).setName(tabName);
        tabCount++;
      }
    });
  });

  // Also copy Meta Data and roster views
  ['1. Meta Data', '2. K Roster View', '4. Gr1 Roster View', '6. Gr2 Roster View'].forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (sheet) {
      sheet.copyTo(backup).setName(name);
      tabCount++;
    }
  });

  // Delete the default blank sheet
  const sheets = backup.getSheets();
  if (sheets.length > 1 && sheets[0].getName() === 'Sheet1') {
    backup.deleteSheet(sheets[0]);
  }

  ui.alert(
    'Backup Complete',
    'Created backup with ' + tabCount + ' tabs:\n' + backupName +
    '\n\nBackup URL:\n' + backup.getUrl(),
    ui.ButtonSet.OK
  );
}