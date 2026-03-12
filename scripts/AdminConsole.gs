/**
 * ============================================================
 * CKLA Skills Tracking — Apps Script System
 * File: AdminConsole.gs
 * Purpose: Admin console for partner/school/year onboarding,
 *          sheet management, and bulk operations
 * Phase: 4
 * ============================================================
 */

// ======================== DIALOG =============================

/**
 * Show the Admin Console sidebar.
 */
function showAdminConsole() {
  var html = HtmlService
    .createHtmlOutputFromFile('AdminConsoleUI')
    .setTitle('Admin Console')
    .setWidth(380);
  SpreadsheetApp.getUi().showSidebar(html);
}


// ======================== SYSTEM STATUS ======================

/**
 * Get the current system status for the Admin Console dashboard.
 * Returns counts, configuration state, and health indicators.
 *
 * @returns {Object} System status object
 */
function getSystemStatus() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var allSheets = ss.getSheets();
  var sheetNames = allSheets.map(function(s) { return s.getName(); });

  // Count tabs by type
  var unitTabs = 0;
  var rosterTabs = 0;
  var summaryTabs = 0;
  var otherTabs = 0;

  sheetNames.forEach(function(name) {
    if (name.startsWith('K U') || name.startsWith('Gr1') || name.startsWith('Gr2')) {
      if (name.indexOf('Roster') !== -1) { rosterTabs++; }
      else if (name.indexOf('Summary') !== -1) { summaryTabs++; }
      else { unitTabs++; }
    } else {
      otherTabs++;
    }
  });

  // Check for key system components
  var hasMetaData = sheetNames.indexOf('1. Meta Data') !== -1;
  var hasNavHub = sheetNames.indexOf('Navigation Hub') !== -1;
  var hasAuditLog = sheetNames.indexOf('Audit Log') !== -1;
  var hasSubmissionLog = sheetNames.indexOf('Submission Log') !== -1;

  // Check for audit trigger
  var hasAuditTrigger = false;
  try {
    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'onEditAudit') {
        hasAuditTrigger = true;
        break;
      }
    }
  } catch (e) { /* ignore */ }

  // Get split workbook status
  var splitStatus = {};
  try {
    splitStatus = getSplitWorkbookIds();
  } catch (e) { /* WorkbookSplitter may not be loaded */ }

  // Get grade tab counts
  var gradeCounts = {};
  try {
    var gradeMap = getUnitTabs();
    for (var grade in gradeMap) {
      gradeCounts[grade] = gradeMap[grade].tabs.length;
    }
  } catch (e) { /* ignore */ }

  return {
    totalSheets: allSheets.length,
    unitTabs: unitTabs,
    rosterTabs: rosterTabs,
    summaryTabs: summaryTabs,
    otherTabs: otherTabs,
    gradeCounts: gradeCounts,
    components: {
      metaData: hasMetaData,
      navigationHub: hasNavHub,
      auditLog: hasAuditLog,
      auditTrigger: hasAuditTrigger,
      submissionLog: hasSubmissionLog
    },
    splitWorkbooks: splitStatus,
    spreadsheetName: ss.getName(),
    spreadsheetUrl: ss.getUrl()
  };
}


// ======================== PARTNER / SCHOOL SETUP =============

/**
 * Create a new workbook for a partner school and year.
 * Generates a complete CKLA tracking workbook from a template
 * structure, optionally copying from the current workbook.
 *
 * @param {Object} config - Setup configuration
 *   { schoolName, year, grades, copyRosters, folderName }
 * @returns {Object} { success, spreadsheetId, spreadsheetUrl, message }
 */
function createSchoolYearWorkbook(config) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var newName = 'CKLA Skills Tracking — ' + config.schoolName + ' ' + config.year;

    // Create new spreadsheet
    var newSS = SpreadsheetApp.create(newName);
    var newId = newSS.getId();

    // Copy Meta Data tab as template
    var metaSheet = ss.getSheetByName('1. Meta Data');
    if (metaSheet) {
      var newMeta = metaSheet.copyTo(newSS);
      newMeta.setName('1. Meta Data');
      // Clear student-specific data but keep structure
      // Update school name in the meta data
      newMeta.getRange('B1').setValue(config.schoolName);
      newMeta.getRange('B2').setValue(config.year);
    }

    // Copy grade-specific tabs
    var grades = config.grades || ['K', '1', '2'];
    var copiedTabs = [];

    grades.forEach(function(grade) {
      var tabs = getGradeTabList(grade);
      tabs.forEach(function(tabName) {
        var sourceSheet = ss.getSheetByName(tabName);
        if (sourceSheet) {
          var newSheet = sourceSheet.copyTo(newSS);
          newSheet.setName(tabName);

          // Optionally clear student data (keep structure, headers, formulas)
          if (!config.copyRosters) {
            clearStudentData_(newSheet);
          }
          copiedTabs.push(tabName);
        }
      });
    });

    // Remove default Sheet1
    var defaultSheet = newSS.getSheetByName('Sheet1');
    if (defaultSheet && newSS.getSheets().length > 1) {
      newSS.deleteSheet(defaultSheet);
    }

    // Move to folder if specified
    if (config.folderName) {
      moveToFolder_(newId, config.folderName);
    }

    // Store partner info in document properties
    savePartnerInfo_(config.schoolName, config.year, newId, newSS.getUrl());

    return {
      success: true,
      spreadsheetId: newId,
      spreadsheetUrl: newSS.getUrl(),
      message: 'Created workbook "' + newName + '" with ' + copiedTabs.length + ' tabs for grades ' + grades.join(', ')
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}


/**
 * Clear student data from a sheet while preserving structure.
 * Clears data rows (ROW.DATA_START onward) but keeps headers and formulas.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 */
function clearStudentData_(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow >= ROW.DATA_START && lastCol > 0) {
    var numRows = lastRow - ROW.DATA_START + 1;
    sheet.getRange(ROW.DATA_START, 1, numRows, lastCol).clearContent();
  }
}


/**
 * Save partner school info to document properties.
 */
function savePartnerInfo_(schoolName, year, spreadsheetId, spreadsheetUrl) {
  var props = PropertiesService.getDocumentProperties();
  var partners = JSON.parse(props.getProperty('PARTNERS') || '[]');

  partners.push({
    school: schoolName,
    year: year,
    spreadsheetId: spreadsheetId,
    spreadsheetUrl: spreadsheetUrl,
    created: new Date().toISOString()
  });

  props.setProperty('PARTNERS', JSON.stringify(partners));
}


/**
 * List all configured partner schools.
 * @returns {Array<Object>} Partner configurations
 */
function listPartnerSchools() {
  var props = PropertiesService.getDocumentProperties();
  return JSON.parse(props.getProperty('PARTNERS') || '[]');
}


/**
 * Remove a partner school entry by index.
 * @param {number} index
 * @returns {Object} { success, message }
 */
function removePartnerSchool(index) {
  var props = PropertiesService.getDocumentProperties();
  var partners = JSON.parse(props.getProperty('PARTNERS') || '[]');

  if (index < 0 || index >= partners.length) {
    return { success: false, error: 'Invalid partner index' };
  }

  var removed = partners.splice(index, 1)[0];
  props.setProperty('PARTNERS', JSON.stringify(partners));

  return {
    success: true,
    message: 'Removed ' + removed.school + ' (' + removed.year + ')'
  };
}


// ======================== SHEET MANAGEMENT ====================

/**
 * Protect formula columns and header rows across all unit tabs.
 * Allows only the data-entry columns (J onward, rows DATA_START+)
 * to be edited by non-admin users.
 *
 * @returns {Object} { success, protectedCount }
 */
function protectAllSheets() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var gradeMap = getUnitTabs();
    var protectedCount = 0;

    for (var grade in gradeMap) {
      gradeMap[grade].tabs.forEach(function(tabName) {
        var sheet = ss.getSheetByName(tabName);
        if (!sheet) return;

        // Protect the entire sheet
        var protection = sheet.protect().setDescription('CKLA Auto-Protection: ' + tabName);

        // Allow editing only in data cells (row DATA_START+, column FIRST_QUESTION+)
        var lastRow = sheet.getLastRow();
        var lastCol = sheet.getLastColumn();

        if (lastRow >= ROW.DATA_START && lastCol >= COL.FIRST_QUESTION) {
          var editableRange = sheet.getRange(
            ROW.DATA_START,
            COL.FIRST_QUESTION,
            lastRow - ROW.DATA_START + 1,
            lastCol - COL.FIRST_QUESTION + 1
          );
          protection.setUnprotectedRanges([editableRange]);
        }

        // Remove all other editors (warning only — requires domain admin)
        protection.setWarningOnly(true);
        protectedCount++;
      });
    }

    return { success: true, protectedCount: protectedCount };
  } catch (err) {
    return { success: false, error: err.message };
  }
}


/**
 * Hide all admin/internal sheets (Audit Log, Submission Log,
 * Meta Data, etc.) from casual view.
 *
 * @returns {Object} { success, hiddenCount }
 */
function hideAdminSheets() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var adminSheets = [
      'Audit Log', 'Audit Archive', 'Submission Log',
      '1. Meta Data'
    ];

    var hidden = 0;
    adminSheets.forEach(function(name) {
      var sheet = ss.getSheetByName(name);
      if (sheet && !sheet.isSheetHidden()) {
        sheet.hideSheet();
        hidden++;
      }
    });

    return { success: true, hiddenCount: hidden };
  } catch (err) {
    return { success: false, error: err.message };
  }
}


/**
 * Show all hidden admin sheets.
 * @returns {Object} { success, shownCount }
 */
function showAdminSheets() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var shown = 0;

    ss.getSheets().forEach(function(sheet) {
      if (sheet.isSheetHidden()) {
        sheet.showSheet();
        shown++;
      }
    });

    return { success: true, shownCount: shown };
  } catch (err) {
    return { success: false, error: err.message };
  }
}


// ======================== BULK OPERATIONS ====================

/**
 * Run a bulk operation across the workbook.
 *
 * @param {string} operation - Operation to run:
 *   'refresh_dashboards' — Refresh all summary calculations
 *   'protect_sheets' — Apply sheet protection to all unit tabs
 *   'hide_admin' — Hide admin/internal sheets
 *   'show_admin' — Show all hidden sheets
 *   'validate_data' — Run data validation across all tabs
 *   'init_audit' — Initialize the audit trail
 * @returns {Object} Result of the operation
 */
function runBulkOperation(operation) {
  switch (operation) {
    case 'refresh_dashboards':
      try {
        refreshAllSummaries();
        return { success: true, message: 'All summaries refreshed.' };
      } catch (e) {
        return { success: false, error: e.message };
      }

    case 'protect_sheets':
      return protectAllSheets();

    case 'hide_admin':
      return hideAdminSheets();

    case 'show_admin':
      return showAdminSheets();

    case 'validate_data':
      try {
        validateAllData();
        return { success: true, message: 'Data validation complete. Check the alert for results.' };
      } catch (e) {
        return { success: false, error: e.message };
      }

    case 'init_audit':
      try {
        initAuditTrail();
        return { success: true, message: 'Audit trail initialized.' };
      } catch (e) {
        return { success: false, error: e.message };
      }

    default:
      return { success: false, error: 'Unknown operation: ' + operation };
  }
}
