/**
 * ============================================================
 * CKLA Skills Tracking — Apps Script System
 * File: NavigationHub.gs
 * Purpose: Phase 2 — Build and maintain a navigation hub tab
 *          with quick-access links to all key tabs and tools.
 * ============================================================
 */

// Navigation Hub tab name (should be the first visible tab)
const NAV_HUB_TAB = 'Navigation Hub';

// Layout constants for the hub
const NAV = {
  TITLE_ROW: 1,
  SUBTITLE_ROW: 2,
  SECTION_START: 4,      // First section row
  LINK_COL: 2,           // Column B: link text
  DESC_COL: 3,           // Column C: description
  STATUS_COL: 4,         // Column D: status indicator
  HEADER_COLOR: '#1a73e8',
  SECTION_BG: '#e8f0fe',
  LINK_COLOR: '#1a73e8',
  ALT_ROW_BG: '#f8f9fa'
};


/**
 * Build or refresh the Navigation Hub tab.
 * Creates the tab if it doesn't exist, then populates it with
 * hyperlinks to all unit tabs, roster views, summary charts,
 * and tool shortcuts.
 */
function buildNavigationHub() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(NAV_HUB_TAB);

  // Create the tab if it doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet(NAV_HUB_TAB, 0); // Insert as first tab
  } else {
    sheet.clear();
    sheet.clearConditionalFormatRules();
  }

  // Set column widths
  sheet.setColumnWidth(1, 30);   // A: spacer
  sheet.setColumnWidth(2, 280);  // B: link
  sheet.setColumnWidth(3, 320);  // C: description
  sheet.setColumnWidth(4, 120);  // D: status

  var currentRow = 1;

  // ===================== TITLE ==============================
  sheet.getRange(currentRow, 2, 1, 3).merge();
  sheet.getRange(currentRow, 2)
    .setValue('CKLA Skills Tracking — Navigation Hub')
    .setFontSize(16)
    .setFontWeight('bold')
    .setFontColor(NAV.HEADER_COLOR);
  currentRow++;

  sheet.getRange(currentRow, 2, 1, 3).merge();
  sheet.getRange(currentRow, 2)
    .setValue('Quick access to all tabs, views, and tools. Updated: ' +
             Utilities.formatDate(new Date(), 'America/Indiana/Indianapolis', 'MMM d, yyyy'))
    .setFontSize(11)
    .setFontColor('#5f6368');
  currentRow += 2;

  // ===================== GRADE SECTIONS =====================
  var gradeMap = getUnitTabs();
  var gradeLabels = {
    'K': { name: 'Kindergarten', color: '#34a853', rosterTab: '2. K Roster View', summaryTab: '3. K Summary Charts' },
    '1': { name: 'Grade 1', color: '#ea8600', rosterTab: '4. Gr1 Roster View', summaryTab: '5. Gr1 Summary Charts' },
    '2': { name: 'Grade 2', color: '#9334e6', rosterTab: '6. Gr2 Roster View', summaryTab: '7. Gr2 Summary Charts' }
  };

  Object.keys(gradeLabels).forEach(function(grade) {
    var info = gradeLabels[grade];
    var tabs = gradeMap[grade] ? gradeMap[grade].tabs : [];

    // Section header
    currentRow = addSectionHeader_(sheet, currentRow, info.name + ' — Unit Tabs', info.color);

    // Roster View link
    if (ss.getSheetByName(info.rosterTab)) {
      currentRow = addNavLink_(sheet, currentRow, info.rosterTab,
        'Class roster with mastery percentages per unit', '📊');
    }

    // Summary Charts link
    if (ss.getSheetByName(info.summaryTab)) {
      currentRow = addNavLink_(sheet, currentRow, info.summaryTab,
        'Aggregated summary statistics and trend charts', '📈');
    }

    // Unit tab links
    tabs.forEach(function(tabName) {
      var unitSheet = ss.getSheetByName(tabName);
      var studentCount = 0;
      if (unitSheet) {
        var lastRow = unitSheet.getLastRow();
        if (lastRow >= ROW.DATA_START) {
          studentCount = lastRow - ROW.DATA_START + 1;
        }
      }
      var desc = studentCount > 0
        ? 'Assessment scores — ' + studentCount + ' students'
        : 'Assessment scores — no data yet';
      currentRow = addNavLink_(sheet, currentRow, tabName, desc, '📝');
    });

    currentRow++; // Spacer row between grades
  });

  // ===================== TOOLS SECTION ======================
  currentRow = addSectionHeader_(sheet, currentRow, 'Tools & Utilities', '#5f6368');

  // These are not sheet links — they're informational rows
  var tools = [
    ['CKLA Tools → Enter Assessment Scores', 'Open sidebar form for score entry', '✏️'],
    ['CKLA Tools → Reports → Refresh All Summaries', 'Force-recalculate all summary statistics', '🔄'],
    ['CKLA Tools → Reports → Generate Student Report', 'Per-student performance report across units', '📋'],
    ['CKLA Tools → Data Tools → Import Scores from CSV', 'Bulk import scores from CSV data', '📥'],
    ['CKLA Tools → Data Tools → Validate All Data', 'Check for out-of-range or invalid scores', '✅'],
    ['CKLA Tools → Data Tools → Backup Data Sheets', 'Create a timestamped backup copy', '💾'],
    ['CKLA Tools → Phase 2 Tools → Form Manager', 'Create and manage Google Form integrations', '📝'],
    ['CKLA Tools → Phase 2 Tools → Build Navigation Hub', 'Rebuild this navigation page', '🏠']
  ];

  tools.forEach(function(tool) {
    sheet.getRange(currentRow, NAV.LINK_COL)
      .setValue(tool[2] + '  ' + tool[0])
      .setFontSize(11)
      .setFontColor('#3c4043');
    sheet.getRange(currentRow, NAV.DESC_COL)
      .setValue(tool[1])
      .setFontSize(10)
      .setFontColor('#5f6368');
    if (currentRow % 2 === 0) {
      sheet.getRange(currentRow, NAV.LINK_COL, 1, 3)
        .setBackground(NAV.ALT_ROW_BG);
    }
    currentRow++;
  });

  // ===================== META DATA LINK =====================
  currentRow++;
  currentRow = addSectionHeader_(sheet, currentRow, 'Administration', '#d93025');

  if (ss.getSheetByName('1. Meta Data')) {
    currentRow = addNavLink_(sheet, currentRow, '1. Meta Data',
      'Teacher rosters, school info, grade assignments', '⚙️');
  }
  if (ss.getSheetByName('Submission Log')) {
    currentRow = addNavLink_(sheet, currentRow, 'Submission Log',
      'Audit trail of all score submissions', '📜');
  }

  // Freeze the title row
  sheet.setFrozenRows(3);

  // Move to the first position if not already there
  ss.setActiveSheet(sheet);
  ss.moveActiveSheet(1);

  SpreadsheetApp.getUi().alert(
    'Navigation Hub Ready',
    'The Navigation Hub tab has been built with links to all ' +
    'unit tabs, views, and tools.\n\nIt has been moved to the first tab position.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}


/**
 * Navigate to a specific tab by name.
 * Called from custom menu or hyperlink triggers.
 *
 * @param {string} tabName - Sheet name to navigate to
 */
function navigateToTab(tabName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(tabName);
  if (sheet) {
    ss.setActiveSheet(sheet);
  }
}


// ===================== INTERNAL HELPERS ======================

/**
 * Add a section header row to the navigation hub.
 * @returns {number} Next available row
 */
function addSectionHeader_(sheet, row, title, color) {
  sheet.getRange(row, NAV.LINK_COL, 1, 3)
    .merge()
    .setValue(title)
    .setFontSize(12)
    .setFontWeight('bold')
    .setFontColor('white')
    .setBackground(color)
    .setVerticalAlignment('middle');
  sheet.setRowHeight(row, 30);
  return row + 1;
}


/**
 * Add a navigation link row (hyperlink to a sheet tab).
 * @returns {number} Next available row
 */
function addNavLink_(sheet, row, tabName, description, icon) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetUrl = ss.getUrl() + '#gid=' + ss.getSheetByName(tabName).getSheetId();

  sheet.getRange(row, NAV.LINK_COL)
    .setValue(icon + '  ' + tabName)
    .setFontSize(11)
    .setFontColor(NAV.LINK_COLOR)
    .setFontLine('underline');

  // Set hyperlink using HYPERLINK formula
  sheet.getRange(row, NAV.LINK_COL)
    .setFormula('=HYPERLINK("' + sheetUrl + '","' + icon + '  ' + tabName + '")');

  sheet.getRange(row, NAV.DESC_COL)
    .setValue(description)
    .setFontSize(10)
    .setFontColor('#5f6368');

  // Alternating row background
  if (row % 2 === 0) {
    sheet.getRange(row, NAV.LINK_COL, 1, 3)
      .setBackground(NAV.ALT_ROW_BG);
  }

  return row + 1;
}
