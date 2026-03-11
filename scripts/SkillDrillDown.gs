/**
 * ============================================================
 * CKLA Skills Tracking — Apps Script System
 * File: SkillDrillDown.gs
 * Purpose: Phase 3 — Skill-level drill-down dashboards.
 *          Surfaces weakest skills by class and grade, breaking
 *          down performance by assessment section.
 * Version: 1.0
 * ============================================================
 */


/**
 * Show the skill drill-down dialog.
 * Opens an HTML dialog where the user selects a grade and optional
 * teacher filter, then sees per-section performance breakdowns.
 */
function showSkillDrillDownDialog() {
  const html = HtmlService
    .createHtmlOutput(buildSkillDrillDownHTML_())
    .setTitle('Skill Drill-Down')
    .setWidth(700)
    .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, 'Skill Drill-Down by Section');
}


/**
 * Compute per-section performance data across all units for a grade.
 *
 * Reads the section headers (ROW.SECTION_HEADERS) and question
 * headers (ROW.QUESTION_HEADERS) to group question columns into
 * assessment sections (e.g., Comprehension, Vocabulary, Writing).
 * For each section, calculates:
 *   - Average percentage correct across all students
 *   - Number of students below 60% in that section
 *   - Number of students at 60–79%
 *   - Number of students at or above 80%
 *
 * @param {string} grade  Grade key ('K', '1', or '2')
 * @param {string} teacher  Teacher name or 'ALL' for all teachers
 * @returns {Object} { grade, teacher, units: [ { unit, sections: [ { name, avgPct, below60, at60to79, above80, studentCount } ] } ] }
 */
function getSkillDrillDownData(grade, teacher) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var gradeMap = getUnitTabs();
  var tabs = gradeMap[grade] ? gradeMap[grade].tabs : [];

  var result = {
    grade: grade,
    teacher: teacher || 'ALL',
    units: []
  };

  tabs.forEach(function(tabName) {
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) return;

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < ROW.DATA_START || lastCol < COL.FIRST_QUESTION) return;

    // Read section headers (row 14) and points possible (row 2)
    var sectionHeaders = sheet.getRange(
      ROW.SECTION_HEADERS, COL.FIRST_QUESTION, 1, lastCol - COL.FIRST_QUESTION + 1
    ).getValues()[0];

    var pointsPossible = sheet.getRange(
      ROW.POINTS_POSSIBLE, COL.FIRST_QUESTION, 1, lastCol - COL.FIRST_QUESTION + 1
    ).getValues()[0];

    // Build section boundaries: each non-empty cell in sectionHeaders
    // marks the start of a new section that spans until the next header.
    var sections = buildSectionRanges_(sectionHeaders);
    if (sections.length === 0) return;

    var numRows = lastRow - ROW.DATA_START + 1;

    // Batch read: teacher (col D) + student name (col F) + all score columns
    var teacherData = sheet.getRange(ROW.DATA_START, COL.TEACHER, numRows, 1).getValues();
    var nameData = sheet.getRange(ROW.DATA_START, COL.STUDENT_NAME, numRows, 1).getValues();
    var scoreData = sheet.getRange(
      ROW.DATA_START, COL.FIRST_QUESTION, numRows, lastCol - COL.FIRST_QUESTION + 1
    ).getValues();

    var unitSections = [];

    sections.forEach(function(sec) {
      var sectionStats = {
        name: sec.name,
        avgPct: 0,
        below60: 0,
        at60to79: 0,
        above80: 0,
        studentCount: 0
      };

      var totalPct = 0;

      for (var r = 0; r < numRows; r++) {
        var studentName = String(nameData[r][0]).trim();
        if (!studentName) continue;

        var teacherName = String(teacherData[r][0]).trim();
        if (teacher && teacher !== 'ALL' && teacherName !== teacher) continue;

        // Sum earned points and possible points for this section
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

        if (possible === 0) continue;

        var pct = Math.round((earned / possible) * 100);
        totalPct += pct;
        sectionStats.studentCount++;

        if (pct >= 80) {
          sectionStats.above80++;
        } else if (pct >= 60) {
          sectionStats.at60to79++;
        } else {
          sectionStats.below60++;
        }
      }

      sectionStats.avgPct = sectionStats.studentCount > 0
        ? Math.round(totalPct / sectionStats.studentCount)
        : 0;

      unitSections.push(sectionStats);
    });

    result.units.push({
      unit: tabName,
      sections: unitSections
    });
  });

  return result;
}


/**
 * Build section ranges from the section header row.
 * Each non-empty cell starts a new section that spans until
 * the column before the next non-empty cell (or end of row).
 *
 * @param {Array} headerRow  Array of section header values
 * @returns {Array<{name: string, startOffset: number, endOffset: number}>}
 */
function buildSectionRanges_(headerRow) {
  var sections = [];
  var currentName = '';
  var startIdx = -1;

  for (var i = 0; i < headerRow.length; i++) {
    var val = String(headerRow[i]).trim();
    if (val !== '' && val !== 'undefined') {
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
 * Get a cross-unit skill summary identifying the weakest sections
 * across all units for a grade. Useful for targeting interventions.
 *
 * @param {string} grade  Grade key ('K', '1', or '2')
 * @returns {Array<{section: string, avgPct: number, unitCount: number, totalBelow60: number}>}
 */
function getWeakestSkillsSummary(grade) {
  var data = getSkillDrillDownData(grade, 'ALL');
  var sectionTotals = {};

  data.units.forEach(function(unit) {
    unit.sections.forEach(function(sec) {
      if (!sectionTotals[sec.name]) {
        sectionTotals[sec.name] = { sumPct: 0, count: 0, totalBelow60: 0 };
      }
      sectionTotals[sec.name].sumPct += sec.avgPct;
      sectionTotals[sec.name].count++;
      sectionTotals[sec.name].totalBelow60 += sec.below60;
    });
  });

  var summary = Object.keys(sectionTotals).map(function(name) {
    var t = sectionTotals[name];
    return {
      section: name,
      avgPct: t.count > 0 ? Math.round(t.sumPct / t.count) : 0,
      unitCount: t.count,
      totalBelow60: t.totalBelow60
    };
  });

  // Sort by avgPct ascending (weakest first)
  summary.sort(function(a, b) { return a.avgPct - b.avgPct; });

  return summary;
}


/**
 * Internal: build the HTML for the skill drill-down dialog.
 */
function buildSkillDrillDownHTML_() {
  return '<div style="font-family:Google Sans,sans-serif;padding:12px;">' +
    '<h3 style="margin:0 0 8px;color:#1a73e8;">Skill Drill-Down by Section</h3>' +
    '<p style="font-size:13px;color:#555;">Select a grade and optional teacher to see per-section performance across units.</p>' +
    '<div style="display:flex;gap:8px;margin-bottom:12px;">' +
    '<select id="ddGrade" style="padding:8px;flex:1;" onchange="loadTeachers()">' +
    '<option value="K">Kindergarten</option>' +
    '<option value="1">Grade 1</option>' +
    '<option value="2">Grade 2</option></select>' +
    '<select id="ddTeacher" style="padding:8px;flex:1;">' +
    '<option value="ALL">All Teachers</option></select></div>' +
    '<button onclick="runDrillDown()" style="padding:8px 16px;background:#1a73e8;' +
    'color:white;border:none;border-radius:4px;cursor:pointer;width:100%;margin-bottom:8px;">' +
    'Generate Drill-Down</button>' +
    '<button onclick="showWeakest()" style="padding:8px 16px;background:#ea8600;' +
    'color:white;border:none;border-radius:4px;cursor:pointer;width:100%;margin-bottom:12px;">' +
    'Show Weakest Skills Summary</button>' +
    '<div id="ddOutput" style="max-height:380px;overflow-y:auto;"></div>' +
    '<script>' +
    'function loadTeachers(){' +
    'var g=document.getElementById("ddGrade").value;' +
    'google.script.run.withSuccessHandler(function(teachers){' +
    'var sel=document.getElementById("ddTeacher");' +
    'sel.innerHTML="<option value=\\'ALL\\'>All Teachers</option>";' +
    'teachers.forEach(function(t){sel.innerHTML+="<option value=\\'"+t+"\\'>"+t+"</option>";});' +
    '}).getTeachersForGrade(g);}' +
    'function runDrillDown(){' +
    'var g=document.getElementById("ddGrade").value;' +
    'var t=document.getElementById("ddTeacher").value;' +
    'document.getElementById("ddOutput").innerHTML="<p>Loading…</p>";' +
    'google.script.run.withSuccessHandler(function(data){' +
    'var html="";' +
    'if(!data.units||data.units.length===0){html="<p>No data found.</p>";' +
    'document.getElementById("ddOutput").innerHTML=html;return;}' +
    'data.units.forEach(function(u){' +
    'html+="<h4 style=\\'margin:12px 0 4px;color:#333;\\'>"+u.unit+"</h4>";' +
    'html+="<table style=\\'width:100%;border-collapse:collapse;font-size:12px;\\'>";' +
    'html+="<tr style=\\'background:#1a73e8;color:white;\\'>"' +
    '+"<th style=\\'padding:6px;text-align:left;\\'>Section</th>"' +
    '+"<th style=\\'padding:6px;\\'>Avg %</th>"' +
    '+"<th style=\\'padding:6px;\\'>≥80%</th>"' +
    '+"<th style=\\'padding:6px;\\'>60–79%</th>"' +
    '+"<th style=\\'padding:6px;\\'>< 60%</th>"' +
    '+"<th style=\\'padding:6px;\\'>Students</th></tr>";' +
    'u.sections.forEach(function(s){' +
    'var bg=s.avgPct>=80?"#e6f4ea":s.avgPct>=60?"#fef7e0":"#fce8e6";' +
    'html+="<tr style=\\'background:"+bg+"\\'>"' +
    '+"<td style=\\'padding:4px 6px;border-bottom:1px solid #eee;\\'>"+s.name+"</td>"' +
    '+"<td style=\\'padding:4px 6px;text-align:center;border-bottom:1px solid #eee;\\'>"+s.avgPct+"%</td>"' +
    '+"<td style=\\'padding:4px 6px;text-align:center;border-bottom:1px solid #eee;\\'>"+s.above80+"</td>"' +
    '+"<td style=\\'padding:4px 6px;text-align:center;border-bottom:1px solid #eee;\\'>"+s.at60to79+"</td>"' +
    '+"<td style=\\'padding:4px 6px;text-align:center;border-bottom:1px solid #eee;font-weight:"+(s.below60>0?"bold":"normal")+";color:"+(s.below60>0?"#c5221f":"inherit")+";\\'>"+s.below60+"</td>"' +
    '+"<td style=\\'padding:4px 6px;text-align:center;border-bottom:1px solid #eee;\\'>"+s.studentCount+"</td></tr>";});' +
    'html+="</table>";});' +
    'document.getElementById("ddOutput").innerHTML=html;' +
    '}).getSkillDrillDownData(g,t);}' +
    'function showWeakest(){' +
    'var g=document.getElementById("ddGrade").value;' +
    'document.getElementById("ddOutput").innerHTML="<p>Analyzing…</p>";' +
    'google.script.run.withSuccessHandler(function(data){' +
    'var html="<h4 style=\\'margin:8px 0;color:#ea8600;\\'>Weakest Skills — "+g+"</h4>";' +
    'html+="<table style=\\'width:100%;border-collapse:collapse;font-size:12px;\\'>";' +
    'html+="<tr style=\\'background:#ea8600;color:white;\\'>"' +
    '+"<th style=\\'padding:6px;text-align:left;\\'>Section</th>"' +
    '+"<th style=\\'padding:6px;\\'>Avg %</th>"' +
    '+"<th style=\\'padding:6px;\\'>Units</th>"' +
    '+"<th style=\\'padding:6px;\\'>Total < 60%</th></tr>";' +
    'data.forEach(function(s){' +
    'var bg=s.avgPct>=80?"#e6f4ea":s.avgPct>=60?"#fef7e0":"#fce8e6";' +
    'html+="<tr style=\\'background:"+bg+"\\'>"' +
    '+"<td style=\\'padding:4px 6px;border-bottom:1px solid #eee;\\'>"+s.section+"</td>"' +
    '+"<td style=\\'padding:4px 6px;text-align:center;border-bottom:1px solid #eee;\\'>"+s.avgPct+"%</td>"' +
    '+"<td style=\\'padding:4px 6px;text-align:center;border-bottom:1px solid #eee;\\'>"+s.unitCount+"</td>"' +
    '+"<td style=\\'padding:4px 6px;text-align:center;border-bottom:1px solid #eee;font-weight:bold;color:#c5221f;\\'>"+s.totalBelow60+"</td></tr>";});' +
    'html+="</table>";' +
    'document.getElementById("ddOutput").innerHTML=html;' +
    '}).getWeakestSkillsSummary(g);}' +
    'loadTeachers();' +
    '</script></div>';
}
