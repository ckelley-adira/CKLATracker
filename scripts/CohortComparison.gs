/**
 * ============================================================
 * CKLA Skills Tracking — Apps Script System
 * File: CohortComparison.gs
 * Purpose: Phase 3 — Cohort comparison charts. Groups students
 *          by demographic fields (ethnicity, MLL, EL status)
 *          and compares average performance across groups
 *          with trend data across units.
 * Version: 1.0
 * ============================================================
 */


// Meta Data tab layout constants
var META_HEADER_ROW = 12; // Header row above teacher/student roster in Meta Data tab
var META_DATA_START_ROW = 13; // First data row in Meta Data tab


/**
 * Show the Cohort Comparison dialog.
 * Opens an HTML dialog where the user selects a grade and
 * demographic grouping to compare performance across cohorts.
 */
function showCohortComparisonDialog() {
  var html = HtmlService
    .createHtmlOutput(buildCohortComparisonHTML_())
    .setTitle('Cohort Comparison')
    .setWidth(700)
    .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, 'Cohort Comparison Charts');
}


/**
 * Retrieve available demographic groupings from the Meta Data tab.
 * Scans the header row for columns that contain demographic labels
 * (e.g., "Ethnicity", "MLL", "EL", "Gender", "IEP").
 *
 * @returns {Array<string>} List of demographic column names found
 */
function getDemographicFields() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var meta = ss.getSheetByName('1. Meta Data');
  if (!meta) return [];

  var lastCol = meta.getLastColumn();
  if (lastCol < 1) return [];

  var headers = meta.getRange(META_HEADER_ROW, 1, 1, lastCol).getValues()[0];
  var demoFields = [];
  var knownDemoLabels = ['ethnicity', 'race', 'mll', 'el', 'ell', 'gender', 'iep', 'sped', '504', 'frl'];

  headers.forEach(function(h) {
    var label = String(h).trim().toLowerCase();
    if (!label) return;
    for (var i = 0; i < knownDemoLabels.length; i++) {
      if (label.indexOf(knownDemoLabels[i]) >= 0) {
        demoFields.push(String(h).trim());
        break;
      }
    }
  });

  return demoFields;
}


/**
 * Build student-to-demographic mapping from the Meta Data tab.
 * Matches students by name to their demographic attributes.
 *
 * @param {string} demoField  The demographic column header name
 * @returns {Object} Map of student name → demographic value
 */
function getStudentDemographicMap_(demoField) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var meta = ss.getSheetByName('1. Meta Data');
  if (!meta) return {};

  var lastCol = meta.getLastColumn();
  var lastRow = meta.getLastRow();
  if (lastCol < 1 || lastRow < META_DATA_START_ROW) return {};

  // Find the column index for the requested demographic field
  var headers = meta.getRange(META_HEADER_ROW, 1, 1, lastCol).getValues()[0];
  var demoColIdx = -1;
  for (var c = 0; c < headers.length; c++) {
    if (String(headers[c]).trim() === demoField) {
      demoColIdx = c;
      break;
    }
  }
  if (demoColIdx === -1) return {};

  // Find the student name column (look for "Student", "Name", etc.)
  var nameColIdx = -1;
  for (var c2 = 0; c2 < headers.length; c2++) {
    var h = String(headers[c2]).trim().toLowerCase();
    if (h === 'student' || h === 'student name' || h === 'name') {
      nameColIdx = c2;
      break;
    }
  }
  if (nameColIdx === -1) return {};

  var numRows = lastRow - META_HEADER_ROW;
  var data = meta.getRange(META_DATA_START_ROW, 1, numRows, lastCol).getValues();
  var map = {};

  data.forEach(function(row) {
    var name = String(row[nameColIdx]).trim();
    var demo = String(row[demoColIdx]).trim();
    if (name && demo) {
      map[name] = demo;
    }
  });

  return map;
}


/**
 * Generate cohort comparison data for a given grade and demographic field.
 *
 * Groups students by their demographic value and computes per-unit
 * average percentages for each group. Returns data suitable for
 * rendering comparison charts with trend lines.
 *
 * @param {string} grade      Grade key ('K', '1', or '2')
 * @param {string} demoField  Demographic field name (e.g., "Ethnicity", "MLL")
 * @returns {Object} { grade, demoField, groups: { [groupValue]: { label, unitAvgs: [ { unit, avgPct, count } ] } } }
 */
function getCohortComparisonData(grade, demoField) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var gradeMap = getUnitTabs();
  var tabs = gradeMap[grade] ? gradeMap[grade].tabs : [];
  var demoMap = getStudentDemographicMap_(demoField);

  var result = {
    grade: grade,
    demoField: demoField,
    units: tabs.slice(), // list of unit tab names for chart labels
    groups: {}
  };

  tabs.forEach(function(tabName, tabIdx) {
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) return;

    var lastRow = sheet.getLastRow();
    if (lastRow < ROW.DATA_START) return;

    var numRows = lastRow - ROW.DATA_START + 1;

    // Batch read: student name (F) and overall % (H)
    var nameData = sheet.getRange(ROW.DATA_START, COL.STUDENT_NAME, numRows, 1).getValues();
    var pctData = sheet.getRange(ROW.DATA_START, COL.PCT_CORRECT, numRows, 1).getValues();

    for (var r = 0; r < numRows; r++) {
      var name = String(nameData[r][0]).trim();
      if (!name) continue;

      var groupVal = demoMap[name] || 'Unknown';
      var pct = pctData[r][0];

      if (pct === '' || pct === null || isNaN(Number(pct))) continue;
      var pctNum = Math.round(Number(pct) * 100);

      if (!result.groups[groupVal]) {
        result.groups[groupVal] = {
          label: groupVal,
          unitAvgs: tabs.map(function() { return { sum: 0, count: 0 }; })
        };
      }

      result.groups[groupVal].unitAvgs[tabIdx].sum += pctNum;
      result.groups[groupVal].unitAvgs[tabIdx].count++;
    }
  });

  // Convert sum/count to averages
  Object.keys(result.groups).forEach(function(key) {
    result.groups[key].unitAvgs = result.groups[key].unitAvgs.map(function(ua, idx) {
      return {
        unit: tabs[idx],
        avgPct: ua.count > 0 ? Math.round(ua.sum / ua.count) : null,
        count: ua.count
      };
    });
  });

  return result;
}


/**
 * Internal: generate a consistent color for a cohort group.
 * Uses a predefined palette with enough variation for comparison.
 */
var COHORT_COLORS_ = [
  '#1a73e8', '#ea4335', '#34a853', '#fbbc04', '#9334e6',
  '#e8710a', '#46bdc6', '#7baaf7', '#f07b72', '#57bb8a'
];


/**
 * Internal: build the HTML for the Cohort Comparison dialog.
 */
function buildCohortComparisonHTML_() {
  return '<div style="font-family:Google Sans,sans-serif;padding:12px;">' +
    '<h3 style="margin:0 0 8px;color:#1a73e8;">Cohort Comparison Charts</h3>' +
    '<p style="font-size:13px;color:#555;">Compare performance across demographic groups with trend lines across units.</p>' +
    '<div style="display:flex;gap:8px;margin-bottom:12px;">' +
    '<select id="ccGrade" style="padding:8px;flex:1;" onchange="loadDemoFields()">' +
    '<option value="K">Kindergarten</option>' +
    '<option value="1">Grade 1</option>' +
    '<option value="2">Grade 2</option></select>' +
    '<select id="ccDemo" style="padding:8px;flex:1;">' +
    '<option value="">Loading fields…</option></select></div>' +
    '<button onclick="generateComparison()" style="padding:8px 16px;background:#1a73e8;' +
    'color:white;border:none;border-radius:4px;cursor:pointer;width:100%;margin-bottom:12px;">' +
    'Generate Comparison</button>' +
    '<div id="ccOutput" style="max-height:400px;overflow-y:auto;"></div>' +
    '<script>' +
    'var cohortColors=["#1a73e8","#ea4335","#34a853","#fbbc04","#9334e6",' +
    '"#e8710a","#46bdc6","#7baaf7","#f07b72","#57bb8a"];' +
    'function loadDemoFields(){' +
    'google.script.run.withSuccessHandler(function(fields){' +
    'var sel=document.getElementById("ccDemo");' +
    'if(fields.length===0){sel.innerHTML="<option value=\\'\\'>No demographic fields found</option>";return;}' +
    'sel.innerHTML="";' +
    'fields.forEach(function(f){sel.innerHTML+="<option value=\\'"+f+"\\'>"+f+"</option>";});' +
    '}).getDemographicFields();}' +
    'function generateComparison(){' +
    'var g=document.getElementById("ccGrade").value;' +
    'var d=document.getElementById("ccDemo").value;' +
    'if(!d){document.getElementById("ccOutput").innerHTML=' +
    '"<p style=\\'color:#c5221f;\\'>No demographic field selected.</p>";return;}' +
    'document.getElementById("ccOutput").innerHTML="<p>Analyzing cohorts…</p>";' +
    'google.script.run.withSuccessHandler(function(data){' +
    'var h="";' +
    'var groups=Object.keys(data.groups);' +
    'if(groups.length===0){h="<p>No demographic data found for selected field.</p>";' +
    'document.getElementById("ccOutput").innerHTML=h;return;}' +
    // Legend
    'h+="<div style=\\'margin-bottom:12px;\\'>";' +
    'groups.forEach(function(g,i){' +
    'h+="<span style=\\'display:inline-block;margin-right:12px;font-size:12px;\\'>"' +
    '+"<span style=\\'display:inline-block;width:12px;height:12px;background:"+cohortColors[i%cohortColors.length]+";border-radius:2px;margin-right:4px;vertical-align:middle;\\'></span>"' +
    '+g+"</span>";});' +
    'h+="</div>";' +
    // Simple bar chart per unit
    'h+="<table style=\\'width:100%;border-collapse:collapse;font-size:12px;\\'>";' +
    'h+="<tr style=\\'background:#1a73e8;color:white;\\'><th style=\\'padding:6px;text-align:left;\\'>Unit</th>";' +
    'groups.forEach(function(g){h+="<th style=\\'padding:6px;\\'>"+g+"</th>";});' +
    'h+="</tr>";' +
    'if(data.units){data.units.forEach(function(unit,ui){' +
    'h+="<tr>";' +
    'h+="<td style=\\'padding:4px 6px;border-bottom:1px solid #eee;\\'>"+unit+"</td>";' +
    'groups.forEach(function(g,gi){' +
    'var ua=data.groups[g].unitAvgs[ui];' +
    'var val=ua&&ua.avgPct!==null?ua.avgPct+"% <span style=\\'font-size:10px;color:#888;\\'>(n="+ua.count+")</span>":"—";' +
    'var bg=ua&&ua.avgPct!==null?(ua.avgPct>=80?"#e6f4ea":ua.avgPct>=60?"#fef7e0":"#fce8e6"):"#f5f5f5";' +
    'h+="<td style=\\'padding:4px 6px;text-align:center;background:"+bg+";border-bottom:1px solid #eee;\\'>"+val+"</td>";});' +
    'h+="</tr>";});}' +
    'h+="</table>";' +
    // Trend summary
    'h+="<h4 style=\\'margin:12px 0 4px;color:#333;\\'>Trend Summary</h4>";' +
    'h+="<table style=\\'width:100%;border-collapse:collapse;font-size:12px;\\'>"' +
    '+"<tr style=\\'background:#555;color:white;\\'><th style=\\'padding:6px;text-align:left;\\'>Group</th>"' +
    '+"<th style=\\'padding:6px;\\'>First Unit</th><th style=\\'padding:6px;\\'>Last Unit</th>"' +
    '+"<th style=\\'padding:6px;\\'>Change</th></tr>";' +
    'groups.forEach(function(g,gi){' +
    'var avgs=data.groups[g].unitAvgs.filter(function(u){return u.avgPct!==null;});' +
    'if(avgs.length<2){h+="<tr><td style=\\'padding:4px 6px;\\'>"+g+"</td><td colspan=3 style=\\'text-align:center;\\'>Insufficient data</td></tr>";return;}' +
    'var first=avgs[0].avgPct;var last=avgs[avgs.length-1].avgPct;var change=last-first;' +
    'var arrow=change>0?"▲":change<0?"▼":"—";' +
    'var color=change>0?"#137333":change<0?"#c5221f":"#555";' +
    'h+="<tr><td style=\\'padding:4px 6px;border-bottom:1px solid #eee;\\'>"+g+"</td>"' +
    '+"<td style=\\'padding:4px 6px;text-align:center;border-bottom:1px solid #eee;\\'>"+first+"%</td>"' +
    '+"<td style=\\'padding:4px 6px;text-align:center;border-bottom:1px solid #eee;\\'>"+last+"%</td>"' +
    '+"<td style=\\'padding:4px 6px;text-align:center;border-bottom:1px solid #eee;color:"+color+";font-weight:bold;\\'>"+arrow+" "+(change>=0?"+":"")+change+"%</td></tr>";});' +
    'h+="</table>";' +
    'document.getElementById("ccOutput").innerHTML=h;' +
    '}).getCohortComparisonData(g,d);}' +
    'loadDemoFields();' +
    '</script></div>';
}
