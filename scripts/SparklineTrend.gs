/**
 * ============================================================
 * CKLA Skills Tracking — Apps Script System
 * File: SparklineTrend.gs
 * Purpose: Phase 1 — Fill empty "Trend" columns on Summary
 *          Charts tabs with SPARKLINE formulas.
 * ============================================================
 */

// Summary Charts tab names
const SUMMARY_CHART_TABS = [
  '3. K Summary Charts',
  '5. Gr1 Summary Charts',
  '7. Gr2 Summary Charts'
];

// Sparkline chart options
const SPARKLINE_OPTIONS = '{"charttype","line"},{"color","#1a73e8"},{"linewidth",2}';

// First data row on Summary Charts tabs (rows 1–N are headers)
const SUMMARY_DATA_START_ROW = 2;


/**
 * Entry point: adds SPARKLINE formulas to the Trend column on
 * all three Summary Charts tabs.
 */
function addSparklineTrendsToAllSummaryCharts() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let totalSparklines = 0;

  SUMMARY_CHART_TABS.forEach(tabName => {
    const sheet = ss.getSheetByName(tabName);
    if (!sheet) return;

    totalSparklines += addSparklinesToSheet_(sheet);
  });

  SpreadsheetApp.getUi().alert(
    'Sparkline Trends Added',
    totalSparklines + ' SPARKLINE formula(s) added to Summary Charts tabs.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}


/**
 * Finds the "Trend" column header in row 1, then fills any
 * empty cells in that column (starting at SUMMARY_DATA_START_ROW)
 * with SPARKLINE formulas referencing unit percentage values in
 * the same row.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @returns {number} Number of sparkline formulas written
 */
function addSparklinesToSheet_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow < SUMMARY_DATA_START_ROW || lastCol < 2) return 0;

  // Scan row 1 for a column header containing "Trend"
  const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  let trendCol = -1;
  for (let c = 0; c < headerRow.length; c++) {
    if (String(headerRow[c]).toLowerCase().includes('trend')) {
      trendCol = c + 1; // Convert to 1-based
      break;
    }
  }

  if (trendCol === -1) return 0; // No Trend column found

  // Determine score columns: everything between the student info
  // columns and the Trend column (or end of sheet).
  // We assume score data starts at column 2 and ends at trendCol - 1.
  const scoreStartCol = 2;
  const scoreEndCol   = trendCol - 1;
  if (scoreEndCol < scoreStartCol) return 0;

  let sparklinesAdded = 0;
  const numRows = lastRow - SUMMARY_DATA_START_ROW + 1;

  for (let r = SUMMARY_DATA_START_ROW; r <= lastRow; r++) {
    const cell = sheet.getRange(r, trendCol);

    // Skip cells that already have content
    if (cell.getValue() !== '' || cell.getFormula() !== '') continue;

    // Build cell addresses for the score range in this row
    const startAddr = sheet.getRange(r, scoreStartCol).getA1Notation();
    const endAddr   = sheet.getRange(r, scoreEndCol).getA1Notation();
    const dataRange = startAddr + ':' + endAddr;

    const formula = '=SPARKLINE(' + dataRange + ',{' + SPARKLINE_OPTIONS + '})';
    cell.setFormula(formula);
    sparklinesAdded++;
  }

  return sparklinesAdded;
}
