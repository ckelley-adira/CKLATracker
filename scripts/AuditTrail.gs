/**
 * ============================================================
 * CKLA Skills Tracking — Apps Script System
 * File: AuditTrail.gs
 * Purpose: Audit trail logging — tracks all cell edits with
 *          timestamp, user, sheet, cell, old/new values
 * Phase: 4
 * ============================================================
 */

// ======================== CONSTANTS ==========================

var AUDIT_SHEET_NAME = 'Audit Log';
var AUDIT_HEADERS = ['Timestamp', 'User', 'Sheet', 'Cell', 'Old Value', 'New Value'];
var AUDIT_MAX_ROWS = 10000;  // Max rows before auto-archiving

// ======================== INSTALLABLE TRIGGER =================

/**
 * Installable onEdit trigger for audit trail logging.
 * Captures every cell edit with timestamp, user email,
 * sheet name, cell reference, old value, and new value.
 *
 * Must be installed as an installable trigger (not simple)
 * to access Session.getActiveUser().
 *
 * Install via: initAuditTrail() or manually in
 * Edit → Current project's triggers → Add Trigger →
 * onEditAudit → From spreadsheet → On edit
 */
function onEditAudit(e) {
  try {
    if (!e || !e.range) return;

    var sheet = e.range.getSheet();
    var sheetName = sheet.getName();

    // Don't log edits to the Audit Log itself or Submission Log
    if (sheetName === AUDIT_SHEET_NAME || sheetName === 'Submission Log') return;

    var range = e.range;
    var cell = range.getA1Notation();
    var numRows = range.getNumRows();
    var numCols = range.getNumColumns();

    var oldValue;
    var newValue;

    if (numRows === 1 && numCols === 1) {
      // Single-cell edit: preserve existing behavior
      oldValue = (e.oldValue !== undefined && e.oldValue !== null) ? e.oldValue : '';
      newValue = range.getValue();
      if (newValue === undefined || newValue === null) newValue = '';
    } else {
      // Multi-cell edit: avoid misleading top-left-only value
      var summary = '[multi-cell edit: ' + numRows + 'x' + numCols + ' cells]';
      oldValue = summary;
      newValue = summary;
    }

    // Get user — requires installable trigger
    var user = '';
    try {
      user = Session.getActiveUser().getEmail();
    } catch (authErr) {
      user = 'unknown';
    }

    writeAuditEntry_(user, sheetName, cell, oldValue, newValue);
  } catch (err) {
    // Audit logging should never block user edits
    console.log('AuditTrail error: ' + err.message);
  }
}


// ======================== SETUP ==============================

/**
 * Initialize the Audit Log sheet and install the onEdit trigger.
 * Run this once to set up the audit trail system.
 *
 * Creates a hidden "Audit Log" sheet with headers and installs
 * the onEditAudit function as an installable trigger.
 */
function initAuditTrail() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Create or reset the Audit Log sheet
  var auditSheet = getOrCreateAuditSheet_(ss);

  // 2. Install the onEdit trigger if not already present
  var installed = installAuditTrigger_();

  // 3. Hide the audit sheet from casual view
  auditSheet.hideSheet();

  SpreadsheetApp.getUi().alert(
    'Audit Trail Initialized',
    'The Audit Log sheet has been created (hidden) and the edit trigger is ' +
    (installed ? 'now installed.' : 'already installed.') +
    '\n\nAll cell edits will be logged automatically.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}


/**
 * Get or create the Audit Log sheet with headers.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getOrCreateAuditSheet_(ss) {
  var sheet = ss.getSheetByName(AUDIT_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(AUDIT_SHEET_NAME);
    sheet.appendRow(AUDIT_HEADERS);
    sheet.getRange('1:1').setFontWeight('bold');
    sheet.setFrozenRows(1);

    // Set column widths for readability
    sheet.setColumnWidth(1, 170);  // Timestamp
    sheet.setColumnWidth(2, 200);  // User
    sheet.setColumnWidth(3, 150);  // Sheet
    sheet.setColumnWidth(4, 80);   // Cell
    sheet.setColumnWidth(5, 150);  // Old Value
    sheet.setColumnWidth(6, 150);  // New Value

    // Move to end of workbook
    ss.moveActiveSheet(ss.getNumSheets());
  }
  return sheet;
}


/**
 * Install the onEditAudit trigger if not already installed.
 * @returns {boolean} true if a new trigger was installed
 */
function installAuditTrigger_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onEditAudit') {
      return false; // Already installed
    }
  }

  ScriptApp.newTrigger('onEditAudit')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();

  return true;
}


// ======================== LOGGING ============================

/**
 * Write a single audit entry to the Audit Log sheet.
 * Creates the sheet if it doesn't exist.
 *
 * @param {string} user - User email
 * @param {string} sheetName - Sheet where the edit occurred
 * @param {string} cell - Cell reference in A1 notation
 * @param {*} oldValue - Previous cell value
 * @param {*} newValue - New cell value
 */
function writeAuditEntry_(user, sheetName, cell, oldValue, newValue) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var auditSheet = ss.getSheetByName(AUDIT_SHEET_NAME);

  if (!auditSheet) {
    auditSheet = getOrCreateAuditSheet_(ss);
  }

  auditSheet.appendRow([
    new Date(),
    user,
    sheetName,
    cell,
    String(oldValue),
    String(newValue)
  ]);

  // Auto-archive if over max rows
  var rowCount = auditSheet.getLastRow();
  if (rowCount > AUDIT_MAX_ROWS) {
    archiveAuditLog_();
  }
}


// ======================== VIEWING ============================

/**
 * Show the Audit Log viewer dialog.
 * Displays recent audit entries in a filterable HTML dialog.
 */
function showAuditLogDialog() {
  var html = buildAuditLogHTML_();
  var dialog = HtmlService
    .createHtmlOutput(html)
    .setWidth(750)
    .setHeight(500)
    .setTitle('Audit Log Viewer');
  SpreadsheetApp.getUi().showModalDialog(dialog, 'Audit Log Viewer');
}


/**
 * Get audit log entries with optional filtering.
 * Called from the Audit Log dialog.
 *
 * @param {Object} filters - Optional filters: { sheet, user, since, limit }
 * @returns {Array<Object>} Array of audit log entries
 */
function getAuditLogEntries(filters) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var auditSheet = ss.getSheetByName(AUDIT_SHEET_NAME);
  if (!auditSheet || auditSheet.getLastRow() < 2) {
    return [];
  }

  filters = filters || {};
  var limit = filters.limit || 200;

  var lastRow = auditSheet.getLastRow();
  var numRows = lastRow - 1; // Exclude header
  var data = auditSheet.getRange(2, 1, numRows, AUDIT_HEADERS.length).getValues();

  // Filter and convert to objects (newest first)
  var entries = [];
  for (var i = data.length - 1; i >= 0 && entries.length < limit; i--) {
    var row = data[i];
    var entry = {
      timestamp: row[0] instanceof Date ? row[0].toISOString() : String(row[0]),
      user: String(row[1]),
      sheet: String(row[2]),
      cell: String(row[3]),
      oldValue: String(row[4]),
      newValue: String(row[5])
    };

    // Apply filters
    if (filters.sheet && entry.sheet !== filters.sheet) continue;
    if (filters.user && entry.user.indexOf(filters.user) === -1) continue;
    if (filters.since) {
      var sinceDate = new Date(filters.since);
      var entryDate = new Date(entry.timestamp);
      if (entryDate < sinceDate) continue;
    }

    entries.push(entry);
  }

  return entries;
}


/**
 * Build the Audit Log viewer HTML.
 */
function buildAuditLogHTML_() {
  return '<!DOCTYPE html>\n' +
    '<html><head>\n' +
    '<style>\n' +
    '  body { font-family: "Google Sans", Roboto, sans-serif; margin: 16px; }\n' +
    '  h2 { color: #1a73e8; margin-bottom: 8px; }\n' +
    '  .filters { display: flex; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }\n' +
    '  .filters label { font-size: 12px; color: #5f6368; }\n' +
    '  .filters input, .filters select { padding: 6px; border: 1px solid #dadce0; border-radius: 4px; font-size: 13px; }\n' +
    '  button { background: #1a73e8; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; }\n' +
    '  button:hover { background: #1557b0; }\n' +
    '  table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }\n' +
    '  th { background: #f1f3f4; padding: 8px 6px; text-align: left; border-bottom: 2px solid #dadce0; position: sticky; top: 0; }\n' +
    '  td { padding: 6px; border-bottom: 1px solid #e8eaed; }\n' +
    '  tr:hover { background: #f8f9fa; }\n' +
    '  .old-val { color: #d93025; text-decoration: line-through; }\n' +
    '  .new-val { color: #137333; font-weight: 500; }\n' +
    '  .empty { color: #9aa0a6; font-style: italic; text-align: center; padding: 40px; }\n' +
    '  #log-table { max-height: 380px; overflow-y: auto; }\n' +
    '</style>\n' +
    '</head><body>\n' +
    '<h2>Audit Log</h2>\n' +
    '<div class="filters">\n' +
    '  <div><label>Sheet</label><br><input id="fSheet" placeholder="All sheets"></div>\n' +
    '  <div><label>User</label><br><input id="fUser" placeholder="All users"></div>\n' +
    '  <div><label>Since</label><br><input id="fSince" type="date"></div>\n' +
    '  <div><label>Limit</label><br><input id="fLimit" type="number" value="200" min="10" max="5000" style="width:70px"></div>\n' +
    '  <div style="align-self:end"><button onclick="loadLog()">Filter</button></div>\n' +
    '</div>\n' +
    '<div id="log-table"><p class="empty">Loading...</p></div>\n' +
    '<script>\n' +
    'function loadLog() {\n' +
    '  var filters = {\n' +
    '    sheet: document.getElementById("fSheet").value || null,\n' +
    '    user: document.getElementById("fUser").value || null,\n' +
    '    since: document.getElementById("fSince").value || null,\n' +
    '    limit: parseInt(document.getElementById("fLimit").value) || 200\n' +
    '  };\n' +
    '  google.script.run.withSuccessHandler(renderLog).withFailureHandler(onError).getAuditLogEntries(filters);\n' +
    '}\n' +
    'function renderLog(entries) {\n' +
    '  var container = document.getElementById("log-table");\n' +
    '  if (!entries || entries.length === 0) {\n' +
    '    container.innerHTML = "<p class=\\"empty\\">No audit entries found.</p>";\n' +
    '    return;\n' +
    '  }\n' +
    '  var html = "<table><thead><tr><th>Timestamp</th><th>User</th><th>Sheet</th><th>Cell</th><th>Old</th><th>New</th></tr></thead><tbody>";\n' +
    '  entries.forEach(function(e) {\n' +
    '    var ts = new Date(e.timestamp).toLocaleString();\n' +
    '    html += "<tr><td>" + ts + "</td><td>" + esc(e.user) + "</td><td>" + esc(e.sheet) + "</td><td>" + esc(e.cell) + "</td>";\n' +
    '    html += "<td class=\\"old-val\\">" + esc(e.oldValue) + "</td><td class=\\"new-val\\">" + esc(e.newValue) + "</td></tr>";\n' +
    '  });\n' +
    '  html += "</tbody></table>";\n' +
    '  container.innerHTML = html;\n' +
    '}\n' +
    'function esc(s) { var d = document.createElement("div"); d.textContent = s || ""; return d.innerHTML; }\n' +
    'function onError(err) { document.getElementById("log-table").innerHTML = "<p class=\\"empty\\">Error: " + err.message + "</p>"; }\n' +
    'loadLog();\n' +
    '</script>\n' +
    '</body></html>';
}


// ======================== MAINTENANCE ========================

/**
 * Archive old audit log entries to a separate sheet.
 * Keeps only the most recent AUDIT_MAX_ROWS / 2 entries.
 */
function archiveAuditLog_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var auditSheet = ss.getSheetByName(AUDIT_SHEET_NAME);
  if (!auditSheet) return;

  var lastRow = auditSheet.getLastRow();
  if (lastRow <= AUDIT_MAX_ROWS / 2) return;

  // Create or get archive sheet
  var archiveName = 'Audit Archive';
  var archiveSheet = ss.getSheetByName(archiveName);
  if (!archiveSheet) {
    archiveSheet = ss.insertSheet(archiveName);
    archiveSheet.appendRow(AUDIT_HEADERS);
    archiveSheet.getRange('1:1').setFontWeight('bold');
    archiveSheet.hideSheet();
    ss.moveActiveSheet(ss.getNumSheets());
  }

  // Move older rows to archive
  var keepRows = Math.floor(AUDIT_MAX_ROWS / 2);
  var archiveRows = lastRow - 1 - keepRows; // Exclude header

  if (archiveRows > 0) {
    var archiveData = auditSheet.getRange(2, 1, archiveRows, AUDIT_HEADERS.length).getValues();
    var archiveStart = archiveSheet.getLastRow() + 1;
    archiveSheet.getRange(archiveStart, 1, archiveData.length, AUDIT_HEADERS.length).setValues(archiveData);

    // Delete archived rows from main sheet
    auditSheet.deleteRows(2, archiveRows);
  }
}


/**
 * Clear the audit log (with confirmation).
 * Archives ALL current entries before clearing.
 */
function clearAuditLog() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.alert(
    'Clear Audit Log',
    'This will archive all current entries and clear the Audit Log.\n\nContinue?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  // Archive all entries (not just older ones)
  archiveAllAuditEntries_();

  ui.alert('Audit log cleared. All entries have been moved to the Audit Archive sheet.');
}


/**
 * Archive ALL current audit log entries to the archive sheet,
 * then clear the main Audit Log. Unlike archiveAuditLog_() which
 * only moves older rows, this moves everything.
 */
function archiveAllAuditEntries_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var auditSheet = ss.getSheetByName(AUDIT_SHEET_NAME);
  if (!auditSheet || auditSheet.getLastRow() < 2) return;

  var archiveName = 'Audit Archive';
  var archiveSheet = ss.getSheetByName(archiveName);
  if (!archiveSheet) {
    archiveSheet = ss.insertSheet(archiveName);
    archiveSheet.appendRow(AUDIT_HEADERS);
    archiveSheet.getRange('1:1').setFontWeight('bold');
    archiveSheet.hideSheet();
    ss.moveActiveSheet(ss.getNumSheets());
  }

  var numRows = auditSheet.getLastRow() - 1; // Exclude header
  if (numRows > 0) {
    var data = auditSheet.getRange(2, 1, numRows, AUDIT_HEADERS.length).getValues();
    var archiveStart = archiveSheet.getLastRow() + 1;
    archiveSheet.getRange(archiveStart, 1, data.length, AUDIT_HEADERS.length).setValues(data);
    auditSheet.deleteRows(2, numRows);
  }
}


/**
 * Show or hide the Audit Log sheet.
 * Toggles visibility for admin access.
 */
function toggleAuditLogVisibility() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var auditSheet = ss.getSheetByName(AUDIT_SHEET_NAME);
  if (!auditSheet) {
    SpreadsheetApp.getUi().alert('No Audit Log sheet found. Run "Initialize Audit Trail" first.');
    return;
  }

  if (auditSheet.isSheetHidden()) {
    auditSheet.showSheet();
    SpreadsheetApp.getUi().alert('Audit Log sheet is now visible.');
  } else {
    auditSheet.hideSheet();
    SpreadsheetApp.getUi().alert('Audit Log sheet is now hidden.');
  }
}
