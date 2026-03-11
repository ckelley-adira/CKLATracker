/**
 * ============================================================
 * CKLA Skills Tracking — Apps Script System
 * File: CKLAConfig.gs
 * Purpose: Menu, constants, tab mapping, utility functions
 * Version: 1.0
 * ============================================================
 */

// ======================== CONSTANTS ==========================

const CKLA_VERSION = '2.0';

// Row positions in every unit tab (fixed layout)
const ROW = {
  SECTION_HEADERS: 14,   // Part 1, Part 2, etc.
  QUESTION_HEADERS: 15,  // Individual question/skill names
  POINTS_POSSIBLE: 2,    // Max points per question
  DATA_START: 16,        // First student data row
  DATA_END: 365          // Last possible student row
};

// Column positions for student info (A–I)
const COL = {
  STUDENT_NUM: 1,    // A: Student #
  SCHOOL: 2,         // B: School
  GRADE: 3,          // C: Grade
  TEACHER: 4,        // D: Teacher
  STUDENT_ID: 5,     // E: Student ID
  STUDENT_NAME: 6,   // F: Student name (Last, First)
  QUINTILE: 7,       // G: Overall Level (formula)
  PCT_CORRECT: 8,    // H: Overall % Correct (formula)
  TOTAL_PTS: 9,      // I: Total Points (formula)
  FIRST_QUESTION: 10 // J: First data-entry column
};

// Grade → unit tab mapping (auto-detected from sheet names)
// This reads the actual spreadsheet tabs at runtime
function getUnitTabs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const allSheets = ss.getSheets().map(s => s.getName());

  const gradeMap = {
    'K': { prefix: 'K U', tabs: [] },
    '1': { prefix: 'Gr1', tabs: [] },
    '2': { prefix: 'Gr2', tabs: [] }
  };

  allSheets.forEach(name => {
    if (name.startsWith('K U')) {
      gradeMap['K'].tabs.push(name);
    } else if (name.startsWith('Gr1') &&
               !name.includes('Roster') &&
               !name.includes('Summary')) {
      gradeMap['1'].tabs.push(name);
    } else if (name.startsWith('Gr2') &&
               !name.includes('Roster') &&
               !name.includes('Summary')) {
      gradeMap['2'].tabs.push(name);
    }
  });

  return gradeMap;
}


// ======================== MENU ===============================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('CKLA Tools')
    .addItem('Enter Assessment Scores', 'showScoreEntrySidebar')
    .addSeparator()
    .addSubMenu(ui.createMenu('Reports')
      .addItem('Refresh All Summaries', 'refreshAllSummaries')
      .addItem('Generate Student Report', 'showStudentReportDialog')
      .addItem('Export Grade Data (CSV)', 'showExportDialog')
    )
    .addSubMenu(ui.createMenu('Data Tools')
      .addItem('Import Scores from CSV', 'showImportDialog')
      .addItem('Validate All Data', 'validateAllData')
      .addItem('Backup Data Sheets', 'backupDataSheets')
    )
    .addSubMenu(ui.createMenu('Phase 1 Tools')
      .addItem('Apply Heat Map to Roster Views', 'applyHeatMapToAllRosterViews')
      .addItem('Add Sparkline Trends to Summary Charts', 'addSparklineTrendsToAllSummaryCharts')
    )
    .addSubMenu(ui.createMenu('Phase 2 Tools')
      .addItem('Build Navigation Hub', 'buildNavigationHub')
      .addItem('Form Manager (Create/Link Forms)', 'showFormManagerDialog')
      .addSeparator()
      .addItem('Create Teacher Input Sheet', 'showCreateTeacherSheetDialog')
      .addItem('Sync Teacher Input Sheets', 'syncAllTeacherInputSheets')
      .addItem('Clean Up Input Sheets', 'cleanupTeacherInputSheets')
      .addSeparator()
      .addItem('Generate New Unit Tab', 'showUnitGeneratorDialog')
    )
    .addSubMenu(ui.createMenu('Phase 3 Reports')
      .addItem('Student Progress (Individual)', 'showStudentProgressDialog')
      .addItem('Skill Drill-Down by Section', 'showSkillDrillDownDialog')
      .addItem('Teacher Action Report', 'showTeacherActionReportDialog')
      .addSeparator()
      .addItem('Cohort Comparison Charts', 'showCohortComparisonDialog')
    )
    .addSeparator()
    .addItem('About CKLA Tools v' + CKLA_VERSION, 'showAbout')
    .addToUi();
}

function showScoreEntrySidebar() {
  const html = HtmlService
    .createHtmlOutputFromFile('ScoreEntryUI')
    .setTitle('CKLA Score Entry')
    .setWidth(420);
  SpreadsheetApp.getUi().showSidebar(html);
}

function showAbout() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    'CKLA Skills Tracking Tools v' + CKLA_VERSION,
    'Automated score entry & reporting for CKLA assessments.\n\n' +
    'Built for The Indy Learning Team.\n' +
    'Christel House Indianapolis.',
    ui.ButtonSet.OK
  );
}


// ===================== UTILITY FUNCTIONS =====================

/**
 * Get teachers for a specific grade from the Meta Data tab.
 * Returns array of teacher names.
 */
function getTeachersForGrade(grade) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const metaSheet = ss.getSheetByName('1. Meta Data');
  if (!metaSheet) return [];

  const gradeLabels = { 'K': 'Kinder', '1': '1st', '2': '2nd' };
  const gradeLabel = gradeLabels[grade] || grade;

  // Teacher roster starts at row 13, columns B=School, C=Grade, D=Teacher
  const data = metaSheet.getRange('C13:D42').getValues();
  const teachers = [];

  data.forEach(row => {
    const rowGrade = String(row[0]).trim();
    const teacher = String(row[1]).trim();
    if (rowGrade === gradeLabel && teacher && teacher !== '') {
      teachers.push(teacher);
    }
  });

  return teachers;
}

/**
 * Get students for a specific teacher from a unit tab.
 * Reads the student list from the data rows (ROW.DATA_START onward).
 */
function getStudentsForTeacher(tabName, teacher) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(tabName);
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  if (lastRow < ROW.DATA_START) return [];

  const numRows = lastRow - ROW.DATA_START + 1;
  // Read columns D (teacher) and F (student name)
  const teacherCol = sheet.getRange(ROW.DATA_START, COL.TEACHER, numRows, 1).getValues();
  const nameCol = sheet.getRange(ROW.DATA_START, COL.STUDENT_NAME, numRows, 1).getValues();

  const students = [];
  for (let i = 0; i < numRows; i++) {
    const t = String(teacherCol[i][0]).trim();
    const name = String(nameCol[i][0]).trim();
    if (name && name !== '' && (teacher === 'ALL' || t === teacher)) {
      students.push({
        name: name,
        row: ROW.DATA_START + i
      });
    }
  }
  return students;
}

/**
 * Build section ranges from the section header row.
 * Each non-empty cell starts a new section that spans until
 * the column before the next non-empty cell (or end of row).
 *
 * Shared utility used by SkillDrillDown.gs and TeacherActionReport.gs.
 *
 * @param {Array} headerRow  Array of section header values
 * @returns {Array<{name: string, startOffset: number, endOffset: number}>}
 */
function buildSectionRanges_(headerRow) {
  var sections = [];
  var currentName = '';
  var startIdx = -1;

  for (var i = 0; i < headerRow.length; i++) {
    var val = String(headerRow[i] == null ? '' : headerRow[i]).trim();
    if (val !== '') {
      // Close previous section
      if (currentName && startIdx >= 0) {
        sections.push({ name: currentName, startOffset: startIdx, endOffset: i - 1 });
      }
      currentName = val;
      startIdx = i;
    }
  }

  // Close last section
  if (currentName && startIdx >= 0) {
    sections.push({ name: currentName, startOffset: startIdx, endOffset: headerRow.length - 1 });
  }

  return sections;
}


/**
 * Find a student's row number in a unit tab by name.
 */
function findStudentRow(tabName, studentName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(tabName);
  if (!sheet) return -1;

  const lastRow = sheet.getLastRow();
  if (lastRow < ROW.DATA_START) return -1;

  const numRows = lastRow - ROW.DATA_START + 1;
  const names = sheet.getRange(ROW.DATA_START, COL.STUDENT_NAME, numRows, 1).getValues();

  for (let i = 0; i < numRows; i++) {
    if (String(names[i][0]).trim() === studentName) {
      return ROW.DATA_START + i;
    }
  }
  return -1;
}