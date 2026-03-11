/**
 * ============================================================
 * CKLA Skills Tracking — Apps Script System
 * File: HeatMapFormatter.gs
 * Purpose: Phase 1 — Apply green/yellow/red conditional
 *          formatting to Roster View tabs based on unit
 *          mastery percentages.
 * ============================================================
 */

// Roster View tab names
const ROSTER_VIEW_TABS = [
  '2. K Roster View',
  '4. Gr1 Roster View',
  '6. Gr2 Roster View'
];

// Formatting thresholds (0–1 range; script auto-detects 0–100)
const HEAT_MAP = {
  GREEN:  { min: 0.80, bg: '#e6f4ea', fg: '#137333' },
  YELLOW: { min: 0.60, bg: '#fef7e0', fg: '#856404' },
  RED:    {            bg: '#fce8e6', fg: '#c5221f' }
};

// First student data row on Roster View tabs (rows 1–N are headers)
const ROSTER_DATA_START_ROW = 17;

// Student info columns to skip (A through I = columns 1–9)
const ROSTER_FIRST_SCORE_COL = 10;


/**
 * Entry point: applies heat-map conditional formatting to all
 * three Roster View tabs.
 */
function applyHeatMapToAllRosterViews() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let tabsFormatted = 0;

  ROSTER_VIEW_TABS.forEach(tabName => {
    const sheet = ss.getSheetByName(tabName);
    if (!sheet) return;

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    if (lastRow < ROSTER_DATA_START_ROW || lastCol < ROSTER_FIRST_SCORE_COL) return;

    applyHeatMapToSheet_(sheet, ROSTER_DATA_START_ROW, ROSTER_FIRST_SCORE_COL, lastCol);
    tabsFormatted++;
  });

  SpreadsheetApp.getUi().alert(
    'Heat Map Applied',
    'Green/yellow/red conditional formatting applied to ' + tabsFormatted + ' Roster View tab(s).',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}


/**
 * Applies 3-tier conditional formatting (green/yellow/red) to
 * the score columns of a single Roster View sheet.
 *
 * Handles both 0–1 and 0–100 percentage formats by sampling
 * actual cell values in the first score column.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} startRow  First data row (skip headers)
 * @param {number} startCol  First score column index (1-based)
 * @param {number} endCol    Last column index (1-based)
 */
function applyHeatMapToSheet_(sheet, startRow, startCol, endCol) {
  const lastRow = sheet.getLastRow();
  if (lastRow < startRow) return;

  // Sample values to detect 0-1 vs 0-100 format
  const sampleRange = sheet.getRange(startRow, startCol, Math.min(10, lastRow - startRow + 1), 1);
  const sampleValues = sampleRange.getValues().flat().filter(v => typeof v === 'number' && v !== 0);
  const usePercent100 = sampleValues.some(v => v > 1);

  const multiplier = usePercent100 ? 100 : 1;
  const greenMin  = HEAT_MAP.GREEN.min  * multiplier;
  const yellowMin = HEAT_MAP.YELLOW.min * multiplier;

  const numRows = lastRow - startRow + 1;
  const numCols = endCol - startCol + 1;
  const range   = sheet.getRange(startRow, startCol, numRows, numCols);

  // Clear existing conditional format rules on this sheet
  sheet.clearConditionalFormatRules();

  const rules = [];

  // Green rule: value >= 0.80 (or 80)
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberGreaterThanOrEqualTo(greenMin)
      .setBackground(HEAT_MAP.GREEN.bg)
      .setFontColor(HEAT_MAP.GREEN.fg)
      .setRanges([range])
      .build()
  );

  // Yellow rule: value >= 0.60 (or 60) AND < 0.80 (or 80)
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberBetween(yellowMin, greenMin - (usePercent100 ? 1 : 0.001))
      .setBackground(HEAT_MAP.YELLOW.bg)
      .setFontColor(HEAT_MAP.YELLOW.fg)
      .setRanges([range])
      .build()
  );

  // Red rule: value < 0.60 (or 60) — applies to any positive value below yellow
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberLessThan(yellowMin)
      .setBackground(HEAT_MAP.RED.bg)
      .setFontColor(HEAT_MAP.RED.fg)
      .setRanges([range])
      .build()
  );

  sheet.setConditionalFormatRules(rules);
}
