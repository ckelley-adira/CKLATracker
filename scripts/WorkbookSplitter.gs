/**
 * ============================================================
 * CKLA Skills Tracking — Apps Script System
 * File: WorkbookSplitter.gs
 * Purpose: Split master workbook into per-grade workbooks and
 *          configure IMPORTRANGE links for cross-grade reporting
 * Phase: 4
 * ============================================================
 */

// ======================== CONSTANTS ==========================

var SPLITTER_SHARED_TABS = ['1. Meta Data', 'Navigation Hub'];
var SPLITTER_GRADES = ['K', '1', '2'];


// ======================== DIALOG =============================

/**
 * Show the Workbook Split Manager dialog.
 */
function showWorkbookSplitDialog() {
  var html = buildWorkbookSplitHTML_();
  var dialog = HtmlService
    .createHtmlOutput(html)
    .setWidth(650)
    .setHeight(480)
    .setTitle('Workbook Split Manager');
  SpreadsheetApp.getUi().showModalDialog(dialog, 'Workbook Split Manager');
}


// ======================== TAB DISCOVERY ======================

/**
 * Get the list of tabs belonging to a specific grade.
 * Includes unit tabs, Roster Views, and Summary Charts.
 *
 * @param {string} grade - 'K', '1', or '2'
 * @returns {Array<string>} Tab names for this grade
 */
function getGradeTabList(grade) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var allSheets = ss.getSheets().map(function(s) { return s.getName(); });

  var prefixes = {
    'K': ['K U', 'K Roster', 'K Summary', 'Kinder'],
    '1': ['Gr1', 'Grade 1', 'Gr1 Roster', 'Gr1 Summary'],
    '2': ['Gr2', 'Grade 2', 'Gr2 Roster', 'Gr2 Summary']
  };

  var gradePrefixes = prefixes[grade] || [];
  var tabs = [];

  allSheets.forEach(function(name) {
    for (var i = 0; i < gradePrefixes.length; i++) {
      if (name.indexOf(gradePrefixes[i]) === 0) {
        tabs.push(name);
        return;
      }
    }
  });

  return tabs;
}


/**
 * Get a preview of what the split would produce.
 * Returns tab counts per grade for the dialog.
 *
 * @returns {Object} { grades: { K: { tabs, count }, ... }, sharedTabs }
 */
function getSplitPreview() {
  var result = { grades: {}, sharedTabs: [] };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var allSheets = ss.getSheets().map(function(s) { return s.getName(); });

  // Find shared tabs that exist
  SPLITTER_SHARED_TABS.forEach(function(name) {
    if (allSheets.indexOf(name) !== -1) {
      result.sharedTabs.push(name);
    }
  });

  // Get tabs per grade
  SPLITTER_GRADES.forEach(function(grade) {
    var tabs = getGradeTabList(grade);
    result.grades[grade] = {
      tabs: tabs,
      count: tabs.length
    };
  });

  return result;
}


// ======================== SPLIT ==============================

/**
 * Split the master workbook: create a new spreadsheet for the
 * specified grade, copying all grade-specific tabs plus shared tabs.
 *
 * @param {string} grade - 'K', '1', or '2'
 * @param {string} folderName - Optional folder name to save into
 * @returns {Object} { success, spreadsheetId, spreadsheetUrl, tabsCopied }
 */
function splitWorkbookForGrade(grade, folderName) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var gradeTabs = getGradeTabList(grade);
    var allSheets = ss.getSheets().map(function(s) { return s.getName(); });

    // Add shared tabs
    var tabsToCopy = [];
    SPLITTER_SHARED_TABS.forEach(function(name) {
      if (allSheets.indexOf(name) !== -1) {
        tabsToCopy.push(name);
      }
    });
    tabsToCopy = tabsToCopy.concat(gradeTabs);

    if (tabsToCopy.length === 0) {
      return { success: false, error: 'No tabs found for grade ' + grade };
    }

    // Create new spreadsheet
    var gradeLabels = { 'K': 'Kindergarten', '1': 'Grade 1', '2': 'Grade 2' };
    var label = gradeLabels[grade] || 'Grade ' + grade;
    var sourceName = ss.getName();
    var newName = sourceName.replace(/\.xlsx$/, '') + ' — ' + label;

    var newSS = SpreadsheetApp.create(newName);
    var newId = newSS.getId();

    // Copy each tab to the new spreadsheet
    var copied = [];
    tabsToCopy.forEach(function(tabName) {
      var sourceSheet = ss.getSheetByName(tabName);
      if (sourceSheet) {
        sourceSheet.copyTo(newSS).setName(tabName);
        copied.push(tabName);
      }
    });

    // Remove the default "Sheet1" that comes with a new spreadsheet
    var defaultSheet = newSS.getSheetByName('Sheet1');
    if (defaultSheet && newSS.getSheets().length > 1) {
      newSS.deleteSheet(defaultSheet);
    }

    // Store the mapping in properties for IMPORTRANGE setup
    var props = PropertiesService.getDocumentProperties();
    props.setProperty('SPLIT_GRADE_' + grade + '_ID', newId);
    props.setProperty('SPLIT_GRADE_' + grade + '_URL', newSS.getUrl());

    // Move to folder if specified
    if (folderName) {
      moveToFolder_(newId, folderName);
    }

    return {
      success: true,
      spreadsheetId: newId,
      spreadsheetUrl: newSS.getUrl(),
      tabsCopied: copied.length,
      tabs: copied
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}


/**
 * Move a spreadsheet to a named folder (creating if needed).
 * @param {string} fileId
 * @param {string} folderName
 */
function moveToFolder_(fileId, folderName) {
  try {
    var file = DriveApp.getFileById(fileId);
    var folders = DriveApp.getFoldersByName(folderName);
    var folder;

    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }

    folder.addFile(file);
    DriveApp.getRootFolder().removeFile(file);
  } catch (e) {
    console.log('moveToFolder_ error: ' + e.message);
  }
}


// ======================== IMPORTRANGE ========================

/**
 * Configure IMPORTRANGE links between per-grade workbooks and
 * a cross-grade reporting sheet.
 *
 * Creates a "Cross-Grade Report" tab in the current workbook
 * with IMPORTRANGE formulas pulling summary data from each
 * per-grade workbook.
 *
 * @param {Object} gradeSpreadsheetIds - Map of grade to spreadsheet ID
 *   e.g. { K: 'abc123', '1': 'def456', '2': 'ghi789' }
 * @returns {Object} { success, message }
 */
function configureImportRangeLinks(gradeSpreadsheetIds) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var reportSheetName = 'Cross-Grade Report';
    var reportSheet = ss.getSheetByName(reportSheetName);

    if (!reportSheet) {
      reportSheet = ss.insertSheet(reportSheetName);
    } else {
      reportSheet.clear();
    }

    // Header
    reportSheet.getRange('A1').setValue('Cross-Grade Reporting Dashboard');
    reportSheet.getRange('A1').setFontSize(16).setFontWeight('bold');
    reportSheet.getRange('A2').setValue('Auto-generated IMPORTRANGE links to per-grade workbooks');
    reportSheet.getRange('A2').setFontColor('#5f6368');

    var row = 4;
    var gradeLabels = { 'K': 'Kindergarten', '1': 'Grade 1', '2': 'Grade 2' };
    var grades = Object.keys(gradeSpreadsheetIds);

    grades.forEach(function(grade) {
      var id = gradeSpreadsheetIds[grade];
      if (!id) return;

      var label = gradeLabels[grade] || 'Grade ' + grade;
      var url = 'https://docs.google.com/spreadsheets/d/' + id;

      // Grade header
      reportSheet.getRange(row, 1).setValue(label);
      reportSheet.getRange(row, 1).setFontSize(13).setFontWeight('bold');
      row++;

      // Link to source workbook
      reportSheet.getRange(row, 1).setFormula(
        '=HYPERLINK("' + url + '", "Open ' + label + ' Workbook")'
      );
      row++;

      // IMPORTRANGE formula pulling summary data
      // This pulls the first Summary Chart tab's data
      var summaryTab = getSummaryTabForGrade_(grade);
      if (summaryTab) {
        reportSheet.getRange(row, 1).setValue('Summary Data (via IMPORTRANGE):');
        row++;
        reportSheet.getRange(row, 1).setFormula(
          '=IMPORTRANGE("' + id + '", "\'' + summaryTab + '\'!A1:H50")'
        );
        row += 52; // Leave space for imported data
      } else {
        reportSheet.getRange(row, 1).setValue('(No summary tab detected — configure manually)');
        row += 3;
      }
    });

    // Note about IMPORTRANGE authorization
    reportSheet.getRange(row, 1).setValue(
      'Note: Each IMPORTRANGE formula requires one-time authorization. ' +
      'Click on the cell with #REF! error and click "Allow access" when prompted.'
    );
    reportSheet.getRange(row, 1).setFontStyle('italic').setFontColor('#d93025');

    return {
      success: true,
      message: 'Cross-Grade Report tab created with IMPORTRANGE links for ' + grades.length + ' grade(s).'
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}


/**
 * Find the summary tab name for a grade.
 * @param {string} grade
 * @returns {string|null}
 */
function getSummaryTabForGrade_(grade) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var allSheets = ss.getSheets().map(function(s) { return s.getName(); });

  var patterns = {
    'K': ['K Summary', 'Kinder Summary'],
    '1': ['Gr1 Summary', 'Grade 1 Summary'],
    '2': ['Gr2 Summary', 'Grade 2 Summary']
  };

  var candidates = patterns[grade] || [];
  for (var i = 0; i < candidates.length; i++) {
    for (var j = 0; j < allSheets.length; j++) {
      if (allSheets[j].indexOf(candidates[i]) === 0) {
        return allSheets[j];
      }
    }
  }
  return null;
}


/**
 * Get stored split workbook IDs from document properties.
 * @returns {Object} Map of grade to { id, url }
 */
function getSplitWorkbookIds() {
  var props = PropertiesService.getDocumentProperties();
  var result = {};

  SPLITTER_GRADES.forEach(function(grade) {
    var id = props.getProperty('SPLIT_GRADE_' + grade + '_ID');
    var url = props.getProperty('SPLIT_GRADE_' + grade + '_URL');
    if (id) {
      result[grade] = { id: id, url: url };
    }
  });

  return result;
}


// ======================== DIALOG HTML ========================

/**
 * Build the Workbook Split Manager HTML dialog.
 */
function buildWorkbookSplitHTML_() {
  return '<!DOCTYPE html>\n' +
    '<html><head>\n' +
    '<style>\n' +
    '  body { font-family: "Google Sans", Roboto, sans-serif; margin: 16px; }\n' +
    '  h2 { color: #1a73e8; margin-bottom: 4px; }\n' +
    '  .subtitle { color: #5f6368; font-size: 13px; margin-bottom: 16px; }\n' +
    '  .grade-card { background: #f8f9fa; border: 1px solid #dadce0; border-radius: 8px; padding: 14px; margin-bottom: 10px; }\n' +
    '  .grade-card h3 { margin: 0 0 6px; }\n' +
    '  .tab-count { color: #5f6368; font-size: 13px; }\n' +
    '  .tab-list { font-size: 12px; color: #3c4043; max-height: 60px; overflow-y: auto; margin: 6px 0; }\n' +
    '  button { background: #1a73e8; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; margin-right: 6px; }\n' +
    '  button:hover { background: #1557b0; }\n' +
    '  button:disabled { background: #dadce0; cursor: not-allowed; }\n' +
    '  .btn-secondary { background: #5f6368; }\n' +
    '  .btn-secondary:hover { background: #3c4043; }\n' +
    '  .status { margin-top: 12px; padding: 10px; border-radius: 4px; font-size: 13px; }\n' +
    '  .status.success { background: #e6f4ea; color: #137333; }\n' +
    '  .status.error { background: #fce8e6; color: #d93025; }\n' +
    '  .status.info { background: #e8f0fe; color: #1a73e8; }\n' +
    '  .split-links { margin-top: 10px; }\n' +
    '  .split-links a { color: #1a73e8; text-decoration: none; font-size: 13px; }\n' +
    '  .split-links a:hover { text-decoration: underline; }\n' +
    '</style>\n' +
    '</head><body>\n' +
    '<h2>Workbook Split Manager</h2>\n' +
    '<p class="subtitle">Split the master workbook into separate per-grade workbooks for improved performance. IMPORTRANGE links enable cross-grade reporting.</p>\n' +
    '<div id="preview">Loading preview...</div>\n' +
    '<div id="status"></div>\n' +
    '<script>\n' +
    'function loadPreview() {\n' +
    '  google.script.run.withSuccessHandler(renderPreview).withFailureHandler(onError).getSplitPreview();\n' +
    '  google.script.run.withSuccessHandler(renderLinks).getSplitWorkbookIds();\n' +
    '}\n' +
    'function renderPreview(data) {\n' +
    '  var html = "";\n' +
    '  var gradeLabels = { K: "Kindergarten", "1": "Grade 1", "2": "Grade 2" };\n' +
    '  ["K", "1", "2"].forEach(function(g) {\n' +
    '    var info = data.grades[g];\n' +
    '    html += "<div class=\\"grade-card\\"><h3>" + gradeLabels[g] + "</h3>";\n' +
    '    html += "<span class=\\"tab-count\\">" + info.count + " tab(s) detected</span>";\n' +
    '    if (info.count > 0) {\n' +
    '      html += "<div class=\\"tab-list\\">" + info.tabs.join(", ") + "</div>";\n' +
    '      html += "<button onclick=\\"splitGrade(\'" + g + "\')\\">Split Grade " + g + "</button>";\n' +
    '    } else {\n' +
    '      html += "<div class=\\"tab-list\\">(No tabs found for this grade)</div>";\n' +
    '    }\n' +
    '    html += "</div>";\n' +
    '  });\n' +
    '  if (data.sharedTabs.length > 0) {\n' +
    '    html += "<p style=\\"font-size:12px;color:#5f6368\\">Shared tabs included in all splits: " + data.sharedTabs.join(", ") + "</p>";\n' +
    '  }\n' +
    '  html += "<hr><button class=\\"btn-secondary\\" onclick=\\"setupImportRange()\\">Configure IMPORTRANGE Links</button>";\n' +
    '  document.getElementById("preview").innerHTML = html;\n' +
    '}\n' +
    'function renderLinks(ids) {\n' +
    '  var keys = Object.keys(ids);\n' +
    '  if (keys.length === 0) return;\n' +
    '  var html = "<div class=\\"split-links\\"><strong>Existing splits:</strong><br>";\n' +
    '  var gradeLabels = { K: "Kindergarten", "1": "Grade 1", "2": "Grade 2" };\n' +
    '  keys.forEach(function(g) {\n' +
    '    html += "<a href=\\"" + ids[g].url + "\\" target=\\"_blank\\">" + gradeLabels[g] + " Workbook</a><br>";\n' +
    '  });\n' +
    '  html += "</div>";\n' +
    '  document.getElementById("status").innerHTML = html;\n' +
    '}\n' +
    'function splitGrade(grade) {\n' +
    '  setStatus("info", "Splitting grade " + grade + "... This may take a moment.");\n' +
    '  google.script.run.withSuccessHandler(function(r) {\n' +
    '    if (r.success) {\n' +
    '      setStatus("success", "Split complete! " + r.tabsCopied + " tab(s) copied. <a href=\\"" + r.spreadsheetUrl + "\\" target=\\"_blank\\">Open new workbook</a>");\n' +
    '    } else { setStatus("error", "Error: " + r.error); }\n' +
    '  }).withFailureHandler(onError).splitWorkbookForGrade(grade, null);\n' +
    '}\n' +
    'function setupImportRange() {\n' +
    '  google.script.run.withSuccessHandler(function(ids) {\n' +
    '    var idMap = {};\n' +
    '    Object.keys(ids).forEach(function(g) { idMap[g] = ids[g].id; });\n' +
    '    if (Object.keys(idMap).length === 0) { setStatus("error", "No split workbooks found. Split at least one grade first."); return; }\n' +
    '    google.script.run.withSuccessHandler(function(r) {\n' +
    '      if (r.success) { setStatus("success", r.message); } else { setStatus("error", r.error); }\n' +
    '    }).withFailureHandler(onError).configureImportRangeLinks(idMap);\n' +
    '  }).getSplitWorkbookIds();\n' +
    '}\n' +
    'function setStatus(type, msg) { document.getElementById("status").innerHTML = "<div class=\\"status " + type + "\\">" + msg + "</div>"; }\n' +
    'function onError(err) { setStatus("error", err.message); }\n' +
    'loadPreview();\n' +
    '</script>\n' +
    '</body></html>';
}
