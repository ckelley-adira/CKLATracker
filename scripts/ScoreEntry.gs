/**
 * ============================================================
 * CKLA Skills Tracking — Apps Script System
 * File: ScoreEntry.gs
 * Purpose: Read unit structure, write scores to cells
 * Version: 1.0
 * ============================================================
 */

/**
 * Reads the assessment structure for a given unit tab.
 * Returns an object describing sections, questions, and point limits.
 *
 * Called by the sidebar UI to dynamically build the form.
 */
function getUnitStructure(tabName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    return { error: 'Tab not found: ' + tabName };
  }

  const lastCol = sheet.getLastColumn();
  if (lastCol < COL.FIRST_QUESTION) {
    return { error: 'No question columns found in ' + tabName };
  }

  const numCols = lastCol - COL.FIRST_QUESTION + 1;

  // Read the three header rows in one batch (Big Gulp pattern!)
  const headerRange = sheet.getRange(
    ROW.POINTS_POSSIBLE,
    COL.FIRST_QUESTION,
    ROW.QUESTION_HEADERS - ROW.POINTS_POSSIBLE + 1,
    numCols
  );
  const headerData = headerRange.getValues();

  // Row indices within our batch
  const pointsRow = headerData[0];                                     // Row 2
  const sectionRow = headerData[ROW.SECTION_HEADERS - ROW.POINTS_POSSIBLE]; // Row 14
  const questionRow = headerData[ROW.QUESTION_HEADERS - ROW.POINTS_POSSIBLE]; // Row 15

  // Also read merged cell ranges to identify section spans
  // We'll detect sections by checking where sectionRow has values
  const sections = [];
  let currentSection = null;

  for (let i = 0; i < numCols; i++) {
    const colIndex = COL.FIRST_QUESTION + i;
    const sectionName = sectionRow[i] ? String(sectionRow[i]).trim() : '';
    const questionName = questionRow[i] ? String(questionRow[i]).trim() : '';
    const maxPoints = pointsRow[i] !== '' && pointsRow[i] !== null
                      ? Number(pointsRow[i]) : 1;

    // New section detected
    if (sectionName !== '') {
      currentSection = {
        name: sectionName,
        questions: []
      };
      sections.push(currentSection);
    }

    // Skip "Total" columns — they're formula-computed
    if (questionName.toLowerCase() === 'total') continue;
    // Skip "Needs Part 2?" columns
    if (questionName.toLowerCase().includes('needs part')) continue;
    // Skip empty question headers
    if (questionName === '') continue;

    // If no section has been started yet, create a default one
    if (!currentSection) {
      currentSection = { name: 'Assessment', questions: [] };
      sections.push(currentSection);
    }

    currentSection.questions.push({
      col: colIndex,
      name: questionName,
      maxPoints: maxPoints
    });
  }

  return {
    tabName: tabName,
    sections: sections,
    totalQuestions: sections.reduce((sum, s) => sum + s.questions.length, 0)
  };
}


/**
 * Get existing scores for a student in a unit tab.
 * Used to pre-fill the form when editing existing scores.
 */
function getStudentScores(tabName, studentName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(tabName);
  if (!sheet) return {};

  const row = findStudentRow(tabName, studentName);
  if (row === -1) return {};

  const structure = getUnitStructure(tabName);
  if (structure.error) return {};

  const scores = {};

  // Batch read all score columns for this student
  const lastCol = sheet.getLastColumn();
  const numCols = lastCol - COL.FIRST_QUESTION + 1;
  const rowData = sheet.getRange(row, COL.FIRST_QUESTION, 1, numCols).getValues()[0];

  structure.sections.forEach(section => {
    section.questions.forEach(q => {
      const idx = q.col - COL.FIRST_QUESTION;
      const val = rowData[idx];
      if (val !== '' && val !== null && val !== undefined) {
        scores[q.col] = Number(val);
      }
    });
  });

  return scores;
}


/**
 * Write scores for a student in a unit tab.
 * Called by the sidebar when the teacher clicks Submit.
 *
 * @param {string} tabName - The unit tab name
 * @param {string} studentName - Student name (Last, First)
 * @param {Object} scores - Map of column number -> score value
 * @returns {Object} - Success/error result
 */
function submitScores(tabName, studentName, scores) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(tabName);

  if (!sheet) {
    return { success: false, error: 'Tab not found: ' + tabName };
  }

  const row = findStudentRow(tabName, studentName);
  if (row === -1) {
    return { success: false, error: 'Student not found: ' + studentName };
  }

  // Validate scores against point limits
  const structure = getUnitStructure(tabName);
  const questionMap = {};
  structure.sections.forEach(s => {
    s.questions.forEach(q => {
      questionMap[q.col] = q;
    });
  });

  const errors = [];
  const validScores = {};

  Object.keys(scores).forEach(colStr => {
    const col = parseInt(colStr);
    const value = scores[colStr];
    const question = questionMap[col];

    if (!question) {
      errors.push('Unknown column: ' + col);
      return;
    }

    if (value === '' || value === null || value === undefined) {
      // Allow blank — don't write anything
      return;
    }

    const numVal = Number(value);
    if (isNaN(numVal)) {
      errors.push(question.name + ': not a number');
      return;
    }
    if (numVal < 0) {
      errors.push(question.name + ': cannot be negative');
      return;
    }
    if (numVal > question.maxPoints) {
      errors.push(question.name + ': max is ' + question.maxPoints + ', got ' + numVal);
      return;
    }

    validScores[col] = numVal;
  });

  if (errors.length > 0) {
    return { success: false, error: errors.join('\n') };
  }

  // Write scores — batch where possible
  // Group consecutive columns for efficient range writes
  const cols = Object.keys(validScores).map(Number).sort((a, b) => a - b);

  if (cols.length === 0) {
    return { success: false, error: 'No scores to submit' };
  }

  // Write each score individually (safest for non-consecutive columns)
  cols.forEach(col => {
    sheet.getRange(row, col).setValue(validScores[col]);
  });

  // Log the submission
  logSubmission_(tabName, studentName, cols.length);

  return {
    success: true,
    message: 'Saved ' + cols.length + ' scores for ' + studentName + ' in ' + tabName
  };
}


/**
 * Quick-entry mode: submit scores for ALL students in a class
 * for a single question/column.
 */
function submitColumnScores(tabName, teacher, colNumber, scoreMap) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(tabName);

  if (!sheet) {
    return { success: false, error: 'Tab not found: ' + tabName };
  }

  const students = getStudentsForTeacher(tabName, teacher);
  let written = 0;
  const errors = [];

  students.forEach(student => {
    const score = scoreMap[student.name];
    if (score === undefined || score === null || score === '') return;

    const numVal = Number(score);
    if (isNaN(numVal)) {
      errors.push(student.name + ': invalid score');
      return;
    }

    sheet.getRange(student.row, colNumber).setValue(numVal);
    written++;
  });

  return {
    success: true,
    message: 'Wrote ' + written + ' scores to column ' + colNumber,
    errors: errors
  };
}


/**
 * Internal: log a score submission to the Staging tab (if it exists)
 * for audit trail purposes.
 */
function logSubmission_(tabName, studentName, scoreCount) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let logSheet = ss.getSheetByName('Submission Log');

    // Create the log sheet if it doesn't exist
    if (!logSheet) {
      logSheet = ss.insertSheet('Submission Log');
      logSheet.appendRow([
        'Timestamp', 'User', 'Tab', 'Student', 'Scores Written'
      ]);
      logSheet.getRange('1:1').setFontWeight('bold');
      // Move to end
      ss.moveActiveSheet(ss.getNumSheets());
    }

    logSheet.appendRow([
      new Date(),
      Session.getActiveUser().getEmail(),
      tabName,
      studentName,
      scoreCount
    ]);
  } catch (e) {
    // Logging failure shouldn't block score submission
    console.log('Log error: ' + e.message);
  }
}