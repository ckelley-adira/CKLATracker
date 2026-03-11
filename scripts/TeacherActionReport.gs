/**
 * ============================================================
 * CKLA Skills Tracking — Apps Script System
 * File: TeacherActionReport.gs
 * Purpose: Phase 3 — Teacher Action Report: one-pager per
 *          teacher with class summary, flagged students,
 *          skill gaps, and action items.
 * Version: 1.0
 * ============================================================
 */


/**
 * Show the Teacher Action Report dialog.
 * Opens an HTML dialog where the user selects a grade and teacher
 * to generate a comprehensive one-pager report.
 */
function showTeacherActionReportDialog() {
  var html = HtmlService
    .createHtmlOutput(buildTeacherActionReportHTML_())
    .setTitle('Teacher Action Report')
    .setWidth(700)
    .setHeight(650);
  SpreadsheetApp.getUi().showModalDialog(html, 'Teacher Action Report');
}


/**
 * Generate Teacher Action Report data for a given grade and teacher.
 *
 * Computes:
 *   - Class summary: total students, average %, % at mastery
 *   - Per-unit breakdown with averages and tier counts
 *   - Flagged students: students below 60% on any unit (with details)
 *   - Skill gaps: sections with class average below 70%
 *   - Action items: auto-generated recommendations based on data
 *
 * @param {string} grade   Grade key ('K', '1', or '2')
 * @param {string} teacher Teacher name
 * @returns {Object} Report data object
 */
function getTeacherActionReportData(grade, teacher) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var gradeMap = getUnitTabs();
  var tabs = gradeMap[grade] ? gradeMap[grade].tabs : [];

  var report = {
    grade: grade,
    teacher: teacher,
    classSummary: {
      totalStudents: 0,
      studentsWithData: 0,
      classAvgPct: 0,
      above80Count: 0,
      at60to79Count: 0,
      below60Count: 0
    },
    unitBreakdowns: [],
    flaggedStudents: [],
    skillGaps: [],
    actionItems: []
  };

  // Track per-student performance across units
  var studentPerf = {};

  tabs.forEach(function(tabName) {
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) return;

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < ROW.DATA_START) return;

    var numRows = lastRow - ROW.DATA_START + 1;

    // Batch read: teacher (D), student name (F), quintile (G), overall % (H)
    var data = sheet.getRange(ROW.DATA_START, COL.TEACHER, numRows, 5).getValues();

    var unitStats = {
      unit: tabName,
      students: 0,
      avgPct: 0,
      above80: 0,
      at60to79: 0,
      below60: 0
    };
    var totalPct = 0;

    data.forEach(function(row) {
      var t = String(row[0]).trim();
      var student = String(row[2]).trim(); // offset 2 = student name
      var pct = row[4]; // offset 4 = overall %

      if (!student || t !== teacher) return;

      if (pct !== '' && pct !== null && !isNaN(Number(pct))) {
        var pctNum = Math.round(Number(pct) * 100);
        unitStats.students++;
        totalPct += pctNum;

        if (pctNum >= 80) {
          unitStats.above80++;
        } else if (pctNum >= 60) {
          unitStats.at60to79++;
        } else {
          unitStats.below60++;
        }

        // Track per-student across units
        if (!studentPerf[student]) {
          studentPerf[student] = { scores: [], flagged: false };
        }
        studentPerf[student].scores.push({ unit: tabName, pct: pctNum });
        if (pctNum < 60) {
          studentPerf[student].flagged = true;
        }
      }
    });

    unitStats.avgPct = unitStats.students > 0
      ? Math.round(totalPct / unitStats.students) : 0;
    report.unitBreakdowns.push(unitStats);

    // Check for skill gaps using section-level data
    if (lastCol >= COL.FIRST_QUESTION) {
      var sectionHeaders = sheet.getRange(
        ROW.SECTION_HEADERS, COL.FIRST_QUESTION, 1, lastCol - COL.FIRST_QUESTION + 1
      ).getValues()[0];

      var pointsPossible = sheet.getRange(
        ROW.POINTS_POSSIBLE, COL.FIRST_QUESTION, 1, lastCol - COL.FIRST_QUESTION + 1
      ).getValues()[0];

      var sections = buildSectionRanges_(sectionHeaders);

      if (sections.length > 0) {
        var teacherRows = [];
        var scoreData = sheet.getRange(
          ROW.DATA_START, COL.FIRST_QUESTION, numRows, lastCol - COL.FIRST_QUESTION + 1
        ).getValues();
        var teacherCol = sheet.getRange(ROW.DATA_START, COL.TEACHER, numRows, 1).getValues();
        var nameCol = sheet.getRange(ROW.DATA_START, COL.STUDENT_NAME, numRows, 1).getValues();

        for (var r = 0; r < numRows; r++) {
          if (String(teacherCol[r][0]).trim() === teacher && String(nameCol[r][0]).trim()) {
            teacherRows.push(r);
          }
        }

        sections.forEach(function(sec) {
          var secTotal = 0;
          var secCount = 0;

          teacherRows.forEach(function(r) {
            var earned = 0;
            var possible = 0;
            for (var c = sec.startOffset; c <= sec.endOffset; c++) {
              var pts = pointsPossible[c];
              if (pts === '' || pts === null || isNaN(Number(pts)) || Number(pts) === 0) continue;
              possible += Number(pts);
              var val = scoreData[r][c];
              if (val !== '' && val !== null && !isNaN(Number(val))) {
                earned += Number(val);
              }
            }
            if (possible > 0) {
              secTotal += Math.round((earned / possible) * 100);
              secCount++;
            }
          });

          var secAvg = secCount > 0 ? Math.round(secTotal / secCount) : 0;
          if (secAvg < 70 && secCount > 0) {
            report.skillGaps.push({
              unit: tabName,
              section: sec.name,
              avgPct: secAvg
            });
          }
        });
      }
    }
  });

  // Build class summary from student performance data
  var studentNames = Object.keys(studentPerf);
  report.classSummary.totalStudents = studentNames.length;

  var totalOverall = 0;
  var studentsWithScores = 0;

  studentNames.forEach(function(name) {
    var perf = studentPerf[name];
    if (perf.scores.length === 0) return;

    studentsWithScores++;
    var avgScore = perf.scores.reduce(function(sum, s) { return sum + s.pct; }, 0) / perf.scores.length;
    totalOverall += avgScore;

    if (avgScore >= 80) {
      report.classSummary.above80Count++;
    } else if (avgScore >= 60) {
      report.classSummary.at60to79Count++;
    } else {
      report.classSummary.below60Count++;
    }

    // Build flagged student list
    if (perf.flagged) {
      var belowUnits = perf.scores.filter(function(s) { return s.pct < 60; });
      report.flaggedStudents.push({
        name: name,
        overallAvg: Math.round(avgScore),
        unitsBelow60: belowUnits.map(function(s) {
          return { unit: s.unit, pct: s.pct };
        })
      });
    }
  });

  report.classSummary.studentsWithData = studentsWithScores;
  report.classSummary.classAvgPct = studentsWithScores > 0
    ? Math.round(totalOverall / studentsWithScores) : 0;

  // Sort flagged students by overall average (lowest first)
  report.flaggedStudents.sort(function(a, b) { return a.overallAvg - b.overallAvg; });

  // Generate action items based on data
  report.actionItems = generateActionItems_(report);

  return report;
}


/**
 * Auto-generate action items based on report data.
 *
 * @param {Object} report  The teacher action report data
 * @returns {Array<string>} List of action item strings
 */
function generateActionItems_(report) {
  var items = [];
  var summary = report.classSummary;

  if (summary.below60Count > 0) {
    items.push(
      summary.below60Count + ' student(s) averaging below 60% — schedule intervention meetings.'
    );
  }

  if (summary.studentsWithData > 0) {
    var masteryRate = Math.round(100 * summary.above80Count / summary.studentsWithData);
    if (masteryRate < 50) {
      items.push(
        'Class mastery rate is ' + masteryRate + '% (below 50%) — consider re-teaching key concepts.'
      );
    }
  }

  if (report.skillGaps.length > 0) {
    var gapSections = [];
    report.skillGaps.forEach(function(g) {
      if (gapSections.indexOf(g.section) === -1) {
        gapSections.push(g.section);
      }
    });
    items.push(
      'Skill gaps detected in: ' + gapSections.join(', ') + ' — review instructional strategies for these areas.'
    );
  }

  if (report.flaggedStudents.length > 3) {
    items.push(
      report.flaggedStudents.length + ' students flagged across units — prioritize small-group intervention.'
    );
  }

  var declining = [];
  report.unitBreakdowns.forEach(function(u, idx) {
    if (idx > 0 && u.avgPct < report.unitBreakdowns[idx - 1].avgPct - 10) {
      declining.push(u.unit);
    }
  });
  if (declining.length > 0) {
    items.push(
      'Performance decline observed in: ' + declining.join(', ') + ' — investigate root causes.'
    );
  }

  if (items.length === 0) {
    items.push('All metrics within expected ranges — continue current instructional approach.');
  }

  return items;
}


/**
 * Internal: build the HTML for the Teacher Action Report dialog.
 */
function buildTeacherActionReportHTML_() {
  return '<div style="font-family:Google Sans,sans-serif;padding:12px;">' +
    '<h3 style="margin:0 0 8px;color:#1a73e8;">Teacher Action Report</h3>' +
    '<p style="font-size:13px;color:#555;">Generate a one-pager with class summary, flagged students, skill gaps, and action items.</p>' +
    '<div style="display:flex;gap:8px;margin-bottom:12px;">' +
    '<select id="tarGrade" style="padding:8px;flex:1;" onchange="loadTeachers()">' +
    '<option value="K">Kindergarten</option>' +
    '<option value="1">Grade 1</option>' +
    '<option value="2">Grade 2</option></select>' +
    '<select id="tarTeacher" style="padding:8px;flex:1;">' +
    '<option value="">Select Teacher…</option></select></div>' +
    '<button onclick="generateReport()" style="padding:8px 16px;background:#1a73e8;' +
    'color:white;border:none;border-radius:4px;cursor:pointer;width:100%;margin-bottom:12px;">' +
    'Generate Report</button>' +
    '<div id="tarOutput" style="max-height:420px;overflow-y:auto;"></div>' +
    '<script>' +
    'function loadTeachers(){' +
    'var g=document.getElementById("tarGrade").value;' +
    'google.script.run.withSuccessHandler(function(teachers){' +
    'var sel=document.getElementById("tarTeacher");' +
    'sel.innerHTML="<option value=\\'\\'>Select Teacher…</option>";' +
    'teachers.forEach(function(t){sel.innerHTML+="<option value=\\'"+t+"\\'>"+t+"</option>";});' +
    '}).getTeachersForGrade(g);}' +
    'function generateReport(){' +
    'var g=document.getElementById("tarGrade").value;' +
    'var t=document.getElementById("tarTeacher").value;' +
    'if(!t){document.getElementById("tarOutput").innerHTML=' +
    '"<p style=\\'color:#c5221f;\\'>Please select a teacher.</p>";return;}' +
    'document.getElementById("tarOutput").innerHTML="<p>Generating report…</p>";' +
    'google.script.run.withSuccessHandler(function(r){' +
    'var h="";' +
    // Class Summary
    'h+="<div style=\\'background:#e8f0fe;padding:12px;border-radius:8px;margin-bottom:12px;\\'>";' +
    'h+="<h4 style=\\'margin:0 0 8px;color:#1a73e8;\\'>Class Summary — "+r.teacher+"</h4>";' +
    'h+="<table style=\\'width:100%;font-size:13px;\\'>"' +
    '+"<tr><td>Total Students</td><td style=\\'text-align:right;font-weight:bold;\\'>"+r.classSummary.totalStudents+"</td></tr>"' +
    '+"<tr><td>Class Average</td><td style=\\'text-align:right;font-weight:bold;\\'>"+r.classSummary.classAvgPct+"%</td></tr>"' +
    '+"<tr><td style=\\'color:#137333;\\'>At Mastery (≥80%)</td><td style=\\'text-align:right;font-weight:bold;color:#137333;\\'>"+r.classSummary.above80Count+"</td></tr>"' +
    '+"<tr><td style=\\'color:#856404;\\'>Approaching (60–79%)</td><td style=\\'text-align:right;font-weight:bold;color:#856404;\\'>"+r.classSummary.at60to79Count+"</td></tr>"' +
    '+"<tr><td style=\\'color:#c5221f;\\'>Below Mastery (<60%)</td><td style=\\'text-align:right;font-weight:bold;color:#c5221f;\\'>"+r.classSummary.below60Count+"</td></tr>"' +
    '+"</table></div>";' +
    // Unit Breakdown
    'h+="<h4 style=\\'margin:8px 0 4px;color:#333;\\'>Unit Breakdown</h4>";' +
    'h+="<table style=\\'width:100%;border-collapse:collapse;font-size:12px;\\'>"' +
    '+"<tr style=\\'background:#1a73e8;color:white;\\'><th style=\\'padding:6px;text-align:left;\\'>Unit</th>"' +
    '+"<th style=\\'padding:6px;\\'>Avg %</th><th style=\\'padding:6px;\\'>≥80%</th>"' +
    '+"<th style=\\'padding:6px;\\'>60–79%</th><th style=\\'padding:6px;\\'><60%</th></tr>";' +
    'r.unitBreakdowns.forEach(function(u){' +
    'var bg=u.avgPct>=80?"#e6f4ea":u.avgPct>=60?"#fef7e0":"#fce8e6";' +
    'h+="<tr style=\\'background:"+bg+"\\'>"' +
    '+"<td style=\\'padding:4px 6px;border-bottom:1px solid #eee;\\'>"+u.unit+"</td>"' +
    '+"<td style=\\'padding:4px 6px;text-align:center;border-bottom:1px solid #eee;\\'>"+u.avgPct+"%</td>"' +
    '+"<td style=\\'padding:4px 6px;text-align:center;border-bottom:1px solid #eee;\\'>"+u.above80+"</td>"' +
    '+"<td style=\\'padding:4px 6px;text-align:center;border-bottom:1px solid #eee;\\'>"+u.at60to79+"</td>"' +
    '+"<td style=\\'padding:4px 6px;text-align:center;border-bottom:1px solid #eee;\\'>"+u.below60+"</td></tr>";});' +
    'h+="</table>";' +
    // Flagged Students
    'if(r.flaggedStudents.length>0){' +
    'h+="<h4 style=\\'margin:12px 0 4px;color:#c5221f;\\'>⚠ Flagged Students (Below 60%)</h4>";' +
    'h+="<table style=\\'width:100%;border-collapse:collapse;font-size:12px;\\'>"' +
    '+"<tr style=\\'background:#c5221f;color:white;\\'><th style=\\'padding:6px;text-align:left;\\'>Student</th>"' +
    '+"<th style=\\'padding:6px;\\'>Overall Avg</th><th style=\\'padding:6px;text-align:left;\\'>Units Below 60%</th></tr>";' +
    'r.flaggedStudents.forEach(function(s){' +
    'var units=s.unitsBelow60.map(function(u){return u.unit+" ("+u.pct+"%)";}).join(", ");' +
    'h+="<tr><td style=\\'padding:4px 6px;border-bottom:1px solid #eee;\\'>"+s.name+"</td>"' +
    '+"<td style=\\'padding:4px 6px;text-align:center;border-bottom:1px solid #eee;\\'>"+s.overallAvg+"%</td>"' +
    '+"<td style=\\'padding:4px 6px;border-bottom:1px solid #eee;font-size:11px;\\'>"+units+"</td></tr>";});' +
    'h+="</table>";}' +
    // Skill Gaps
    'if(r.skillGaps.length>0){' +
    'h+="<h4 style=\\'margin:12px 0 4px;color:#ea8600;\\'>Skill Gaps (Section Avg < 70%)</h4>";' +
    'h+="<table style=\\'width:100%;border-collapse:collapse;font-size:12px;\\'>"' +
    '+"<tr style=\\'background:#ea8600;color:white;\\'><th style=\\'padding:6px;text-align:left;\\'>Unit</th>"' +
    '+"<th style=\\'padding:6px;text-align:left;\\'>Section</th><th style=\\'padding:6px;\\'>Avg %</th></tr>";' +
    'r.skillGaps.forEach(function(g){' +
    'h+="<tr style=\\'background:#fef7e0;\\'><td style=\\'padding:4px 6px;border-bottom:1px solid #eee;\\'>"+g.unit+"</td>"' +
    '+"<td style=\\'padding:4px 6px;border-bottom:1px solid #eee;\\'>"+g.section+"</td>"' +
    '+"<td style=\\'padding:4px 6px;text-align:center;border-bottom:1px solid #eee;\\'>"+g.avgPct+"%</td></tr>";});' +
    'h+="</table>";}' +
    // Action Items
    'h+="<h4 style=\\'margin:12px 0 4px;color:#1a73e8;\\'>Action Items</h4>";' +
    'h+="<ul style=\\'font-size:13px;padding-left:20px;\\'>";' +
    'r.actionItems.forEach(function(a){h+="<li style=\\'margin-bottom:4px;\\'>"+a+"</li>";});' +
    'h+="</ul>";' +
    'document.getElementById("tarOutput").innerHTML=h;' +
    '}).getTeacherActionReportData(g,t);}' +
    'loadTeachers();' +
    '</script></div>';
}
