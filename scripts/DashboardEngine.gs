/**
 * ============================================================
 * CKLA Skills Tracking — Apps Script System
 * File: DashboardEngine.gs
 * Purpose: Refresh summaries, generate reports, update charts
 * Version: 1.0
 * ============================================================
 */

/**
 * Refresh all summary statistics across all unit tabs.
 * This recalculates the class-level and teacher-level averages
 * that live in rows 3–13 of each unit tab.
 *
 * In the current spreadsheet, these are formula-driven (AVERAGEIFS,
 * COUNTIFS). This function is a safety net: it forces recalc and
 * can optionally replace slow volatile formulas with static values
 * (the "Big Gulp" pattern from Adira Reads).
 */
function refreshAllSummaries() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  ui.alert(
    'Refresh Summaries',
    'This will force-recalculate all summary statistics.\n' +
    'Existing formulas will be preserved.\n\nContinue?',
    ui.ButtonSet.OK_CANCEL
  );

  const gradeMap = getUnitTabs();
  let tabCount = 0;

  Object.keys(gradeMap).forEach(grade => {
    gradeMap[grade].tabs.forEach(tabName => {
      const sheet = ss.getSheetByName(tabName);
      if (!sheet) return;

      // Force recalc by reading and re-setting a dummy cell
      // (Google Sheets recalculates formulas when cells they
      // depend on change)
      const dummyCell = sheet.getRange('A1');
      const val = dummyCell.getValue();
      dummyCell.setValue(val);

      tabCount++;
    });
  });

  SpreadsheetApp.flush(); // Force all pending changes to commit

  ui.alert(
    'Refresh Complete',
    'Recalculated summaries across ' + tabCount + ' unit tabs.',
    ui.ButtonSet.OK
  );
}


/**
 * Generate a per-student report card showing scores across all units.
 * Opens a dialog where the teacher selects a student, then generates
 * a summary of their performance across every unit they have data for.
 */
function showStudentReportDialog() {
  const html = HtmlService
    .createHtmlOutput(buildStudentReportHTML_())
    .setTitle('Student Report')
    .setWidth(500)
    .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, 'Student Report');
}


/**
 * Compute per-student summary data across all units for a given grade.
 * Returns an array of objects: { student, units: [ { unit, pct, quintile } ] }
 */
function getStudentSummaryData(grade) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const gradeMap = getUnitTabs();
  const tabs = gradeMap[grade] ? gradeMap[grade].tabs : [];

  if (tabs.length === 0) return [];

  // Get student list from first unit tab
  const firstSheet = ss.getSheetByName(tabs[0]);
  if (!firstSheet) return [];

  const lastRow = firstSheet.getLastRow();
  if (lastRow < ROW.DATA_START) return [];

  const numRows = lastRow - ROW.DATA_START + 1;
  const names = firstSheet.getRange(
    ROW.DATA_START, COL.STUDENT_NAME, numRows, 1
  ).getValues().flat().filter(n => n && String(n).trim() !== '');

  // For each student, collect their Overall % from each unit tab
  const studentData = names.map(name => ({
    student: name,
    units: []
  }));

  tabs.forEach(tabName => {
    const sheet = ss.getSheetByName(tabName);
    if (!sheet) return;

    const lr = sheet.getLastRow();
    if (lr < ROW.DATA_START) return;

    const nr = lr - ROW.DATA_START + 1;

    // Batch read: student names (F), quintile (G), overall % (H)
    const data = sheet.getRange(ROW.DATA_START, COL.STUDENT_NAME, nr, 3).getValues();

    data.forEach(row => {
      const sName = String(row[0]).trim();
      const quintile = row[1] || '';
      const pct = row[2];

      const studentObj = studentData.find(s => s.student === sName);
      if (studentObj) {
        studentObj.units.push({
          unit: tabName,
          pct: pct !== '' && pct !== null ? Math.round(Number(pct) * 100) : null,
          quintile: String(quintile)
        });
      }
    });
  });

  return studentData;
}


/**
 * Build a summary stats object for dashboard display.
 * Returns per-grade and per-teacher breakdowns.
 */
function getDashboardStats(grade) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const gradeMap = getUnitTabs();
  const tabs = gradeMap[grade] ? gradeMap[grade].tabs : [];

  const stats = {
    grade: grade,
    totalStudents: 0,
    unitStats: [],
    teacherStats: {}
  };

  tabs.forEach(tabName => {
    const sheet = ss.getSheetByName(tabName);
    if (!sheet) return;

    const lastRow = sheet.getLastRow();
    if (lastRow < ROW.DATA_START) return;

    const numRows = lastRow - ROW.DATA_START + 1;

    // Batch read: teacher (D), student (F), quintile (G), overall % (H)
    const data = sheet.getRange(ROW.DATA_START, COL.TEACHER, numRows, 5).getValues();

    let studentsWithData = 0;
    let above80 = 0;
    let totalPct = 0;
    const teacherCounts = {};

    data.forEach(row => {
      const teacher = String(row[0]).trim();
      const student = String(row[2]).trim(); // COL.STUDENT_NAME - COL.TEACHER = offset 2
      const pct = row[4]; // COL.PCT_CORRECT - COL.TEACHER = offset 4

      if (!student || student === '') return;

      if (pct !== '' && pct !== null && !isNaN(Number(pct))) {
        studentsWithData++;
        const pctNum = Number(pct) * 100;
        totalPct += pctNum;
        if (pctNum >= 80) above80++;

        if (!teacherCounts[teacher]) {
          teacherCounts[teacher] = { total: 0, above80: 0, sumPct: 0 };
        }
        teacherCounts[teacher].total++;
        teacherCounts[teacher].sumPct += pctNum;
        if (pctNum >= 80) teacherCounts[teacher].above80++;
      }
    });

    stats.unitStats.push({
      unit: tabName,
      studentsWithData: studentsWithData,
      above80: above80,
      pctAbove80: studentsWithData > 0
        ? Math.round(100 * above80 / studentsWithData) : 0,
      avgPct: studentsWithData > 0
        ? Math.round(totalPct / studentsWithData) : 0
    });

    // Merge teacher stats
    Object.keys(teacherCounts).forEach(t => {
      if (!stats.teacherStats[t]) {
        stats.teacherStats[t] = { unitsReported: 0, totalAbove80: 0, totalStudents: 0, sumPct: 0 };
      }
      stats.teacherStats[t].unitsReported++;
      stats.teacherStats[t].totalAbove80 += teacherCounts[t].above80;
      stats.teacherStats[t].totalStudents += teacherCounts[t].total;
      stats.teacherStats[t].sumPct += teacherCounts[t].sumPct;
    });

    if (stats.totalStudents === 0) {
      stats.totalStudents = data.filter(r => String(r[2]).trim() !== '').length;
    }
  });

  return stats;
}


/**
 * Internal: generate the student report HTML dialog content.
 */
function buildStudentReportHTML_() {
  return '<div style="font-family: Google Sans, sans-serif; padding: 12px;">' +
    '<p>Select a grade to generate the student summary report:</p>' +
    '<select id="rptGrade" style="padding:8px;width:100%;margin:8px 0;">' +
    '<option value="K">Kindergarten</option>' +
    '<option value="1">Grade 1</option>' +
    '<option value="2">Grade 2</option></select>' +
    '<button onclick="generate()" style="padding:8px 16px;background:#1a73e8;' +
    'color:white;border:none;border-radius:4px;cursor:pointer;width:100%">' +
    'Generate Report</button>' +
    '<div id="rptOutput" style="margin-top:12px"></div>' +
    '<script>function generate(){var g=document.getElementById("rptGrade").value;' +
    'document.getElementById("rptOutput").innerHTML="Loading...";' +
    'google.script.run.withSuccessHandler(function(data){' +
    'var html="<table style=\\'width:100%;border-collapse:collapse;font-size:12px\\'>";' +
    'html+="<tr style=\\'background:#1a73e8;color:white\\'><th style=\\'padding:6px\\'>Student</th>";' +
    'if(data.length>0){data[0].units.forEach(function(u){' +
    'html+="<th style=\\'padding:6px\\'>"+u.unit.replace(/^(K |Gr\\d )/,"")+"</th>";});}' +
    'html+="</tr>";data.forEach(function(s){' +
    'html+="<tr><td style=\\'padding:4px 6px;border-bottom:1px solid #eee\\'>"+s.student+"</td>";' +
    's.units.forEach(function(u){var bg=u.pct===null?"#f5f5f5":u.pct>=80?"#e6f4ea":u.pct>=60?"#fef7e0":"#fce8e6";' +
    'html+="<td style=\\'padding:4px 6px;text-align:center;background:"+bg+";border-bottom:1px solid #eee\\'>"' +
    '+(u.pct!==null?u.pct+"%":"—")+"</td>";});html+="</tr>";});html+="</table>";' +
    'document.getElementById("rptOutput").innerHTML=html;' +
    '}).getStudentSummaryData(g);}</script></div>';
}