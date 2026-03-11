/**
 * ============================================================
 * CKLA Skills Tracking — Apps Script System
 * File: DashboardEngine.gs
 * Purpose: Refresh summaries, generate reports, update charts
 * Version: 2.0 (Phase 3 — enhanced student progress dashboard)
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
 * Show the individual student progress dialog.
 * Opens an enhanced dialog where the teacher selects a grade and
 * individual student, then sees a detailed progress view with
 * a visual trend line and mastery breakdown.
 */
function showStudentProgressDialog() {
  var html = HtmlService
    .createHtmlOutput(buildStudentProgressHTML_())
    .setTitle('Student Progress')
    .setWidth(600)
    .setHeight(650);
  SpreadsheetApp.getUi().showModalDialog(html, 'Individual Student Progress');
}


/**
 * Get detailed progress data for a single student across all units.
 *
 * @param {string} grade        Grade key ('K', '1', or '2')
 * @param {string} studentName  Student name (Last, First)
 * @returns {Object} { student, grade, units: [ { unit, pct, quintile } ], trend, masteryBreakdown }
 */
function getIndividualStudentProgress(grade, studentName) {
  var allData = getStudentSummaryData(grade);
  var studentObj = null;

  for (var i = 0; i < allData.length; i++) {
    if (allData[i].student === studentName) {
      studentObj = allData[i];
      break;
    }
  }

  if (!studentObj) {
    return { student: studentName, grade: grade, units: [], trend: 'N/A', masteryBreakdown: {} };
  }

  // Calculate trend
  var scores = studentObj.units
    .filter(function(u) { return u.pct !== null; })
    .map(function(u) { return u.pct; });

  var trend = 'N/A';
  if (scores.length >= 2) {
    var firstHalf = scores.slice(0, Math.ceil(scores.length / 2));
    var secondHalf = scores.slice(Math.ceil(scores.length / 2));
    var firstAvg = firstHalf.reduce(function(a, b) { return a + b; }, 0) / firstHalf.length;
    var secondAvg = secondHalf.reduce(function(a, b) { return a + b; }, 0) / secondHalf.length;
    var diff = Math.round(secondAvg - firstAvg);
    trend = diff > 0 ? 'Improving (+' + diff + '%)' : diff < 0 ? 'Declining (' + diff + '%)' : 'Stable';
  }

  // Mastery breakdown
  var breakdown = { above80: 0, at60to79: 0, below60: 0, noData: 0 };
  studentObj.units.forEach(function(u) {
    if (u.pct === null) breakdown.noData++;
    else if (u.pct >= 80) breakdown.above80++;
    else if (u.pct >= 60) breakdown.at60to79++;
    else breakdown.below60++;
  });

  return {
    student: studentObj.student,
    grade: grade,
    units: studentObj.units,
    trend: trend,
    masteryBreakdown: breakdown
  };
}


/**
 * Get list of student names for a given grade (used for dropdown).
 *
 * @param {string} grade  Grade key ('K', '1', or '2')
 * @returns {Array<string>} Array of student names
 */
function getStudentListForGrade(grade) {
  var data = getStudentSummaryData(grade);
  return data.map(function(s) { return s.student; });
}


/**
 * Internal: generate the student report HTML dialog content.
 * (Original class-wide report — retained for backward compatibility.)
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


/**
 * Internal: generate the individual student progress HTML dialog content.
 * Includes a dropdown for student selection and a visual progress chart.
 */
function buildStudentProgressHTML_() {
  return '<div style="font-family:Google Sans,sans-serif;padding:12px;">' +
    '<h3 style="margin:0 0 8px;color:#1a73e8;">Individual Student Progress</h3>' +
    '<p style="font-size:13px;color:#555;">Select a grade and student to view their progress across all units.</p>' +
    '<select id="spGrade" style="padding:8px;width:100%;margin:4px 0;" onchange="loadStudents()">' +
    '<option value="K">Kindergarten</option>' +
    '<option value="1">Grade 1</option>' +
    '<option value="2">Grade 2</option></select>' +
    '<select id="spStudent" style="padding:8px;width:100%;margin:4px 0;">' +
    '<option value="">Select Student…</option></select>' +
    '<button onclick="showProgress()" style="padding:8px 16px;background:#1a73e8;' +
    'color:white;border:none;border-radius:4px;cursor:pointer;width:100%;margin:8px 0;">' +
    'Show Progress</button>' +
    '<div id="spOutput" style="max-height:400px;overflow-y:auto;"></div>' +
    '<script>' +
    'function loadStudents(){' +
    'var g=document.getElementById("spGrade").value;' +
    'var sel=document.getElementById("spStudent");' +
    'sel.innerHTML="<option value=\\'\\'>Loading…</option>";' +
    'google.script.run.withSuccessHandler(function(names){' +
    'sel.innerHTML="<option value=\\'\\'>Select Student…</option>";' +
    'names.forEach(function(n){sel.innerHTML+="<option value=\\'"+n+"\\'>"+n+"</option>";});' +
    '}).getStudentListForGrade(g);}' +
    'function showProgress(){' +
    'var g=document.getElementById("spGrade").value;' +
    'var s=document.getElementById("spStudent").value;' +
    'if(!s){document.getElementById("spOutput").innerHTML=' +
    '"<p style=\\'color:#c5221f;\\'>Please select a student.</p>";return;}' +
    'document.getElementById("spOutput").innerHTML="<p>Loading…</p>";' +
    'google.script.run.withSuccessHandler(function(d){' +
    'var h="";' +
    // Student header
    'h+="<div style=\\'background:#e8f0fe;padding:12px;border-radius:8px;margin-bottom:12px;\\'>";' +
    'h+="<h4 style=\\'margin:0;color:#1a73e8;\\'>"+d.student+"</h4>";' +
    'h+="<p style=\\'margin:4px 0 0;font-size:13px;\\'>Trend: <strong>"+d.trend+"</strong></p></div>";' +
    // Mastery breakdown
    'var mb=d.masteryBreakdown;' +
    'h+="<div style=\\'display:flex;gap:8px;margin-bottom:12px;text-align:center;font-size:12px;\\'>";' +
    'h+="<div style=\\'flex:1;background:#e6f4ea;padding:8px;border-radius:6px;\\'>"' +
    '+"<div style=\\'font-size:20px;font-weight:bold;color:#137333;\\'>"+mb.above80+"</div>Mastery</div>";' +
    'h+="<div style=\\'flex:1;background:#fef7e0;padding:8px;border-radius:6px;\\'>"' +
    '+"<div style=\\'font-size:20px;font-weight:bold;color:#856404;\\'>"+mb.at60to79+"</div>Approaching</div>";' +
    'h+="<div style=\\'flex:1;background:#fce8e6;padding:8px;border-radius:6px;\\'>"' +
    '+"<div style=\\'font-size:20px;font-weight:bold;color:#c5221f;\\'>"+mb.below60+"</div>Below</div></div>";' +
    // Visual bar chart
    'h+="<h4 style=\\'margin:8px 0 4px;color:#333;\\'>Performance by Unit</h4>";' +
    'd.units.forEach(function(u){' +
    'var label=u.unit.replace(/^(K |Gr\\d )/,"");' +
    'var pct=u.pct!==null?u.pct:0;' +
    'var color=u.pct===null?"#ccc":u.pct>=80?"#34a853":u.pct>=60?"#fbbc04":"#ea4335";' +
    'h+="<div style=\\'margin-bottom:6px;\\'>"' +
    '+"<div style=\\'display:flex;justify-content:space-between;font-size:12px;\\'>"' +
    '+"<span>"+label+"</span><span>"+(u.pct!==null?u.pct+"%":"—")+"</span></div>"' +
    '+"<div style=\\'background:#eee;border-radius:4px;height:14px;overflow:hidden;\\'>"' +
    '+"<div style=\\'background:"+color+";height:100%;width:"+pct+"%;border-radius:4px;\\'></div>"' +
    '+"</div></div>";});' +
    // Table view
    'h+="<h4 style=\\'margin:12px 0 4px;color:#333;\\'>Score Details</h4>";' +
    'h+="<table style=\\'width:100%;border-collapse:collapse;font-size:12px;\\'>"' +
    '+"<tr style=\\'background:#1a73e8;color:white;\\'><th style=\\'padding:6px;text-align:left;\\'>Unit</th>"' +
    '+"<th style=\\'padding:6px;\\'>Score</th><th style=\\'padding:6px;\\'>Level</th></tr>";' +
    'd.units.forEach(function(u){' +
    'var bg=u.pct===null?"#f5f5f5":u.pct>=80?"#e6f4ea":u.pct>=60?"#fef7e0":"#fce8e6";' +
    'h+="<tr style=\\'background:"+bg+"\\'>"' +
    '+"<td style=\\'padding:4px 6px;border-bottom:1px solid #eee;\\'>"+u.unit+"</td>"' +
    '+"<td style=\\'padding:4px 6px;text-align:center;border-bottom:1px solid #eee;\\'>"+(u.pct!==null?u.pct+"%":"—")+"</td>"' +
    '+"<td style=\\'padding:4px 6px;text-align:center;border-bottom:1px solid #eee;\\'>"+u.quintile+"</td></tr>";});' +
    'h+="</table>";' +
    'document.getElementById("spOutput").innerHTML=h;' +
    '}).getIndividualStudentProgress(g,s);}' +
    'loadStudents();' +
    '</script></div>';
}