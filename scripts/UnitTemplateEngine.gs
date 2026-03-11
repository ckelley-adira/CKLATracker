/**
 * ============================================================
 * CKLA Skills Tracking — Apps Script System
 * File: UnitTemplateEngine.gs
 * Purpose: Phase 2 — Standardized unit templates with
 *          automated tab generation for new units.
 * ============================================================
 */

// Default sections for different assessment types
const DEFAULT_UNIT_SECTIONS = {
  'skills': [
    { name: 'Part 1: Reading Comprehension', questions: 10, maxPoints: 1 },
    { name: 'Part 2: Vocabulary', questions: 5, maxPoints: 1 },
    { name: 'Part 3: Grammar & Writing', questions: 5, maxPoints: 2 },
    { name: 'Part 4: Spelling', questions: 10, maxPoints: 1 }
  ],
  'knowledge': [
    { name: 'Part 1: Listening Comprehension', questions: 5, maxPoints: 2 },
    { name: 'Part 2: Vocabulary', questions: 5, maxPoints: 1 },
    { name: 'Part 3: Writing', questions: 3, maxPoints: 4 }
  ],
  'custom': []
};


/**
 * Show the unit generation dialog.
 * Teacher selects a grade, unit number, assessment type, and
 * optionally customizes the section structure.
 */
function showUnitGeneratorDialog() {
  const html = '<div style="font-family:Google Sans,sans-serif;padding:16px">' +
    '<h3 style="color:#1a73e8;margin-bottom:12px">Generate New Unit Tab</h3>' +
    '<p style="font-size:12px;color:#5f6368;margin-bottom:12px">' +
    'Create a new unit assessment tab from the standard template. ' +
    'Includes pre-configured headers, formulas, and data validation.</p>' +

    // Grade
    '<div style="margin-bottom:10px">' +
    '<label style="font-size:12px;font-weight:500;display:block;margin-bottom:4px">Grade</label>' +
    '<select id="ugGrade" style="width:100%;padding:8px;border:1px solid #dadce0;border-radius:4px">' +
    '<option value="K">Kindergarten</option>' +
    '<option value="1">Grade 1</option>' +
    '<option value="2">Grade 2</option></select></div>' +

    // Unit number
    '<div style="margin-bottom:10px">' +
    '<label style="font-size:12px;font-weight:500;display:block;margin-bottom:4px">Unit Number</label>' +
    '<input id="ugUnit" type="number" min="1" max="12" value="1" ' +
    'style="width:100%;padding:8px;border:1px solid #dadce0;border-radius:4px"></div>' +

    // Assessment type
    '<div style="margin-bottom:10px">' +
    '<label style="font-size:12px;font-weight:500;display:block;margin-bottom:4px">Assessment Type</label>' +
    '<select id="ugType" style="width:100%;padding:8px;border:1px solid #dadce0;border-radius:4px">' +
    '<option value="skills">Skills Assessment (Reading, Vocab, Grammar, Spelling)</option>' +
    '<option value="knowledge">Knowledge Assessment (Listening, Vocab, Writing)</option>' +
    '<option value="custom">Custom (empty template)</option></select></div>' +

    // Populate from existing tab
    '<div style="margin-bottom:10px">' +
    '<label style="font-size:12px;font-weight:500;display:block;margin-bottom:4px">' +
    'Copy Student Roster From (optional)</label>' +
    '<select id="ugSource" style="width:100%;padding:8px;border:1px solid #dadce0;border-radius:4px">' +
    '<option value="">None — start with empty roster</option></select></div>' +

    '<button onclick="generate()" style="width:100%;padding:8px;background:#1a73e8;' +
    'color:white;border:none;border-radius:4px;cursor:pointer">Generate Unit Tab</button>' +
    '<div id="ugResult" style="margin-top:8px;font-size:12px"></div>' +

    '<script>' +
    'google.script.run.withSuccessHandler(function(tabs){' +
    'var sel=document.getElementById("ugSource");' +
    'Object.keys(tabs).forEach(function(g){' +
    'tabs[g].tabs.forEach(function(t){' +
    'var o=document.createElement("option");o.value=t;o.textContent=t;' +
    'sel.appendChild(o)})})}).getUnitTabs();' +
    'function generate(){' +
    'var grade=document.getElementById("ugGrade").value;' +
    'var unit=document.getElementById("ugUnit").value;' +
    'var type=document.getElementById("ugType").value;' +
    'var source=document.getElementById("ugSource").value;' +
    'document.getElementById("ugResult").textContent="Generating...";' +
    'google.script.run.withSuccessHandler(function(r){' +
    'if(r.success){document.getElementById("ugResult").innerHTML=' +
    '"<span style=\\"color:#137333\\">✓ "+r.message+"</span>";}' +
    'else{document.getElementById("ugResult").innerHTML=' +
    '"<span style=\\"color:#d93025\\">✗ "+r.error+"</span>";}' +
    '}).generateUnitTab(grade,unit,type,source)}' +
    '</script></div>';

  const output = HtmlService.createHtmlOutput(html)
    .setWidth(420)
    .setHeight(480);
  SpreadsheetApp.getUi().showModalDialog(output, 'Generate Unit Tab');
}


/**
 * Generate a new unit tab from the standard template.
 *
 * @param {string} grade - 'K', '1', or '2'
 * @param {number} unitNum - Unit number (1–12)
 * @param {string} assessmentType - 'skills', 'knowledge', or 'custom'
 * @param {string} sourceTab - Optional: copy student roster from this tab
 * @returns {Object} - { success, tabName, message } or { success, error }
 */
function generateUnitTab(grade, unitNum, assessmentType, sourceTab) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Build tab name following existing conventions
  const tabName = buildTabName_(grade, unitNum, assessmentType);

  // Check if tab already exists
  if (ss.getSheetByName(tabName)) {
    return { success: false, error: 'Tab already exists: ' + tabName };
  }

  const sections = DEFAULT_UNIT_SECTIONS[assessmentType] || [];
  const sheet = ss.insertSheet(tabName);

  // ===================== HEADER ROWS =========================

  // Row 1: Unit title
  sheet.getRange(1, 1).setValue(tabName)
    .setFontSize(14)
    .setFontWeight('bold')
    .setFontColor('#1a73e8');

  // Row 2: Points possible (populated per question column)
  sheet.getRange(2, 1).setValue('Points Possible')
    .setFontWeight('bold')
    .setFontSize(10)
    .setFontColor('#5f6368');

  // Rows 3–13: Reserved for summary stats (AVERAGEIFS, COUNTIFS, etc.)
  const summaryLabels = [
    'Class Average', 'Teacher Average', '% at Mastery (≥80%)',
    'Count at Mastery', 'Q1 (Top 20%)', 'Q2', 'Q3', 'Q4', 'Q5 (Bottom 20%)',
    '', ''
  ];
  summaryLabels.forEach(function(label, idx) {
    sheet.getRange(3 + idx, 1)
      .setValue(label)
      .setFontSize(10)
      .setFontColor('#5f6368');
  });

  // Row 14: Section headers
  sheet.getRange(14, 1).setValue('Assessment Sections')
    .setFontWeight('bold')
    .setBackground('#e8f0fe');

  // Row 15: Question/skill names
  sheet.getRange(15, 1).setValue('Question / Skill')
    .setFontWeight('bold')
    .setBackground('#e8f0fe');

  // ===================== STUDENT INFO COLUMNS ================

  // Columns A–I: Student info headers (Row 15)
  const infoHeaders = [
    'Student #', 'School', 'Grade', 'Teacher', 'Student ID',
    'Student Name', 'Quintile', '% Correct', 'Total Points'
  ];
  infoHeaders.forEach(function(header, idx) {
    sheet.getRange(15, idx + 1)
      .setValue(header)
      .setFontWeight('bold')
      .setBackground('#e8f0fe')
      .setHorizontalAlignment('center');
  });

  // ===================== QUESTION COLUMNS ====================

  let currentCol = COL.FIRST_QUESTION; // Column J
  const questionCols = [];  // Track actual question column letters (exclude Totals)
  const sectionTotalCols = []; // Track section total column positions and ranges

  sections.forEach(function(section) {
    const sectionStartCol = currentCol;

    // Row 14: Section header
    if (section.questions > 0) {
      sheet.getRange(14, currentCol)
        .setValue(section.name)
        .setFontWeight('bold')
        .setBackground('#d2e3fc')
        .setFontColor('#1967d2');

      // Merge section header across question columns
      if (section.questions > 1) {
        sheet.getRange(14, currentCol, 1, section.questions).merge();
      }
    }

    for (let q = 1; q <= section.questions; q++) {
      // Row 15: Question name
      sheet.getRange(15, currentCol)
        .setValue(section.name.replace(/Part \d+: /, '') + ' Q' + q)
        .setFontSize(9)
        .setHorizontalAlignment('center');

      // Row 2: Points possible
      sheet.getRange(2, currentCol)
        .setValue(section.maxPoints)
        .setHorizontalAlignment('center')
        .setFontWeight('bold');

      // Data validation for score entry cells (Rows 16–365)
      const rule = SpreadsheetApp.newDataValidation()
        .requireNumberBetween(0, section.maxPoints)
        .setAllowInvalid(false)
        .setHelpText('Enter 0–' + section.maxPoints)
        .build();
      sheet.getRange(ROW.DATA_START, currentCol, ROW.DATA_END - ROW.DATA_START + 1, 1)
        .setDataValidation(rule);

      questionCols.push(currentCol);
      currentCol++;
    }

    // Total column for this section
    if (section.questions > 0) {
      const sectionEndCol = currentCol - 1;
      sheet.getRange(14, currentCol)
        .setValue('');
      sheet.getRange(15, currentCol)
        .setValue('Total')
        .setFontWeight('bold')
        .setHorizontalAlignment('center')
        .setBackground('#fff2cc');
      // Leave Points Possible blank for section total columns to avoid double-counting in % Correct
      sheet.getRange(2, currentCol)
        .setValue('')
        .setHorizontalAlignment('center');

      sectionTotalCols.push({
        totalCol: currentCol,
        startCol: sectionStartCol,
        endCol: sectionEndCol
      });

      currentCol++;
    }
  });

  // ===================== FORMULA COLUMNS (G, H, I) ===========

  // Only generate formulas if at least one question column exists.
  // When there are no sections/questions (custom type), skip formula
  // creation to avoid invalid ranges.
  if (questionCols.length > 0) {
    // Build a SUM expression that only includes actual question columns
    // (excluding section Total columns) by creating disjoint ranges per section
    const questionRangeLetters = questionCols.map(function(c) {
      return columnToLetter_(c);
    });

    for (let r = ROW.DATA_START; r <= ROW.DATA_END; r++) {
      // Section total formulas: SUM of question columns within each section
      sectionTotalCols.forEach(function(st) {
        const startLetter = columnToLetter_(st.startCol);
        const endLetter = columnToLetter_(st.endCol);
        sheet.getRange(r, st.totalCol)
          .setFormula('=IF(F' + r + '="","",SUM(' +
                      startLetter + r + ':' + endLetter + r + '))');
      });

      // Column I (Total Points): SUM of only question columns (excludes Total columns)
      const sumParts = questionRangeLetters.map(function(letter) {
        return letter + r;
      }).join(',');
      sheet.getRange(r, COL.TOTAL_PTS)
        .setFormula('=IF(F' + r + '="","",SUM(' + sumParts + '))');

      // Column H (% Correct): Total / Max possible (only question columns in row 2)
      const maxParts = questionRangeLetters.map(function(letter) {
        return letter + '$2';
      }).join(',');
      sheet.getRange(r, COL.PCT_CORRECT)
        .setFormula('=IF(I' + r + '="","",I' + r + '/SUM(' + maxParts + '))');

      // Column G (Quintile): uses the % Correct value to assign a 1–5 quintile
      sheet.getRange(r, COL.QUINTILE)
        .setFormula('=IF(H' + r + '="","",IF(H' + r + '>=0.8,"Q1",' +
                    'IF(H' + r + '>=0.6,"Q2",IF(H' + r + '>=0.4,"Q3",' +
                    'IF(H' + r + '>=0.2,"Q4","Q5")))))');
    }
  }

  // ===================== COPY STUDENT ROSTER ==================

  if (sourceTab && sourceTab !== '') {
    const result = copyStudentRoster_(ss, sourceTab, tabName);
    if (!result.success) {
      // Non-fatal: tab was created, just no roster
      console.log('Roster copy warning: ' + result.error);
    }
  }

  // ===================== FORMATTING ==========================

  // Freeze first 15 rows and first 9 columns
  sheet.setFrozenRows(15);
  sheet.setFrozenColumns(9);

  // Column widths
  sheet.setColumnWidth(COL.STUDENT_NAME, 180);
  sheet.setColumnWidth(COL.TEACHER, 140);

  // Tab color based on grade
  const tabColors = { 'K': '#34a853', '1': '#ea8600', '2': '#9334e6' };
  sheet.setTabColor(tabColors[grade] || '#5f6368');

  return {
    success: true,
    tabName: tabName,
    message: 'Generated ' + tabName + ' with ' +
             sections.reduce(function(sum, s) { return sum + s.questions; }, 0) +
             ' question columns and standard formulas.'
  };
}


// ===================== INTERNAL HELPERS ======================

/**
 * Build a tab name following the existing naming convention.
 * K → "K U1 Skills", Grade 1 → "Gr1 U1 Knowledge", etc.
 *
 * @param {string} grade - 'K', '1', or '2'
 * @param {number} unitNum - Unit number
 * @param {string} assessmentType - 'skills', 'knowledge', or 'custom'
 */
function buildTabName_(grade, unitNum, assessmentType) {
  const prefix = grade === 'K' ? 'K U' : 'Gr' + grade + ' U';
  let suffix;
  switch (assessmentType) {
    case 'knowledge':
      suffix = 'Knowledge';
      break;
    case 'custom':
      suffix = 'Custom';
      break;
    case 'skills':
    default:
      suffix = 'Skills';
      break;
  }
  return prefix + unitNum + ' ' + suffix;
}


/**
 * Convert a 1-based column number to a letter (1→A, 26→Z, 27→AA).
 */
function columnToLetter_(col) {
  let letter = '';
  let c = col;
  while (c > 0) {
    const mod = (c - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    c = Math.floor((c - 1) / 26);
  }
  return letter;
}


/**
 * Copy the student roster (columns A–F) from a source tab to a
 * destination tab, starting at ROW.DATA_START.
 */
function copyStudentRoster_(ss, sourceTabName, destTabName) {
  const sourceSheet = ss.getSheetByName(sourceTabName);
  const destSheet = ss.getSheetByName(destTabName);

  if (!sourceSheet || !destSheet) {
    return { success: false, error: 'Sheet not found' };
  }

  const lastRow = sourceSheet.getLastRow();
  if (lastRow < ROW.DATA_START) {
    return { success: false, error: 'No student data in source tab' };
  }

  const numRows = lastRow - ROW.DATA_START + 1;

  // Copy columns A–F (student info)
  const data = sourceSheet.getRange(
    ROW.DATA_START, 1, numRows, COL.STUDENT_NAME
  ).getValues();

  destSheet.getRange(
    ROW.DATA_START, 1, numRows, COL.STUDENT_NAME
  ).setValues(data);

  return { success: true, copied: numRows };
}
