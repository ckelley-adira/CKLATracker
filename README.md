# CKLA Skills Tracker — Christel House Indianapolis

A Google Sheets–based system for tracking **Core Knowledge Language Arts (CKLA)** skills assessments across **Kindergarten, Grade 1, and Grade 2** at Christel House Indianapolis. The system pairs structured Excel/Google Sheets workbooks with a Google Apps Script layer for sidebar-based score entry, bulk import/export, automated dashboards, and Phase 1 quick-win utilities.

See the [Redesign Plan](ckla_skills_redesign.html) for the full workflow audit, architecture details, and phased roadmap.

---

## Motivation

This tracker addresses the pain points of high-volume manual data entry, cognitive overload in spreadsheet navigation, lack of validation, and missing longitudinal analytics identified in the current system. See the [Redesign Plan](ckla_skills_redesign.html) for the detailed audit and recommendations.

---

## Repository Structure

| File / Path | Purpose |
|---|---|
| `CKLASkillsTracking_GradeK_FY26.xlsx` | Kinder assessment workbook — all K unit tabs, Roster View, Summary Charts |
| `CKLASkillsTracking_Grade1_FY26.xlsx` | Grade 1 assessment workbook — all Gr1 unit tabs, Roster View, Summary Charts |
| `CKLA_Apps_Script_System.html` | Apps Script system guide with embedded code (Sections 3–7) |
| `ckla_skills_redesign.html` | Full redesign audit: pain points, workflow analysis, roadmap, platform options |
| `scripts/CKLAConfig.gs` | Menu creation, constants, tab mapping, utility functions |
| `scripts/ScoreEntry.gs` | Backend: reads unit structure, finds student rows, writes scores |
| `scripts/ScoreEntryUI.html` | Sidebar UI: dynamic form with section grouping and validation |
| `scripts/DashboardEngine.gs` | Refreshes summary stats, generates student reports, updates charts |
| `scripts/ImportExport.gs` | Bulk CSV import, data export, backup utilities |
| `scripts/HeatMapFormatter.gs` | **Phase 1:** Applies green/yellow/red conditional formatting to Roster View tabs |
| `scripts/SparklineTrend.gs` | **Phase 1:** Fills empty Trend columns on Summary Charts with SPARKLINE formulas |

---

## Apps Script System

The five core script files provide a complete input and reporting layer on top of the existing Google Sheets workbooks. Install them into your Google Sheet's Apps Script editor (see [Installation](#installation)) to unlock the **CKLA Tools** menu.

| Script | Key Functions |
|---|---|
| `CKLAConfig.gs` | `onOpen()`, `getUnitTabs()`, `getTeachersForGrade()`, `getStudentsForTeacher()`, `findStudentRow()` |
| `ScoreEntry.gs` | `getUnitStructure()`, `getStudentScores()`, `submitScores()`, `submitColumnScores()` |
| `ScoreEntryUI.html` | Sidebar form served by `HtmlService` — cascading dropdowns, live validation, auto-advance |
| `DashboardEngine.gs` | `refreshAllSummaries()`, `getStudentSummaryData()`, `buildStudentReportHTML_()` |
| `ImportExport.gs` | `importCSVScores()`, `exportGradeData()`, `validateAllData()`, `backupDataSheets()` |

The script layer **writes to the same cells** teachers currently edit manually, so all existing AVERAGEIFS, COUNTIFS, quintile formulas, and summary charts continue to auto-recalculate with no structural changes required.

---

## Phase 1 Quick Wins

These improvements can be applied to the existing workbooks immediately, with no structural rebuild:

1. **Hide backend tabs** — Collapse unit tabs behind grade-level groups; expose only the navigation hub, Roster Views, and Summary Charts to teachers
2. **Color-code tabs** — Apply a consistent tab color scheme: blue for meta/setup, green for Kinder, orange for Grade 1, purple for Grade 2
3. **Heat map conditional formatting** — Green/yellow/red on Roster View percentage columns (use `HeatMapFormatter.gs` from the CKLA Tools → Phase 1 Tools menu)
4. **Protect formula cells** — Lock the AVERAGEIFS/COUNTIFS/quintile formula columns so only the score-entry columns (J onward) are editable
5. **Data validation** — Restrict score-entry cells to numeric values within the valid range (0 to points possible per question)
6. **SPARKLINE trend formulas** — Fill the empty Trend column on Summary Charts tabs with sparklines (use `SparklineTrend.gs` from the CKLA Tools → Phase 1 Tools menu)
7. **Checkbox conversion** — Convert 0/1 binary skill columns to Google Sheets checkboxes for faster entry

---

## Phased Roadmap

### Phase 1 — Quick Wins *(immediate)*
Hide tabs, color-code, heat map, protect formulas, data validation, sparklines, checkboxes. No structural changes — apply directly to existing workbooks.

### Phase 2 — Input Overhaul *(1–2 weeks)*
Deploy the Apps Script system. Sidebar-based score entry form, per-teacher input sheets, navigation hub tab, standardized unit templates, CSV import, and backup utilities.

### Phase 3 — Reporting & Dashboards *(2–4 weeks)*
Student progress reports (historical view across all units), skill drill-downs by section, teacher action summaries highlighting students below mastery thresholds. Built with Apps Script HTML Service — no external BI tools required.

### Phase 4 — Scale & Sustainability *(future)*
Split workbooks per grade for performance, add an audit trail for score edits, create an admin console for tab management, and evaluate migration to a web app (AppSheet, Airtable, or custom) if the spreadsheet model becomes unmanageable.

---

## Installation

To install the Apps Script files into a Google Sheet:

1. Open the CKLA Skills Tracking Google Sheet
2. Go to **Extensions → Apps Script**
3. Delete any existing code in `Code.gs` (the default file) and rename it to `CKLAConfig`
4. Paste the contents of `scripts/CKLAConfig.gs` into that file
5. Click the **+** button next to "Files" → **Script** → name it `ScoreEntry` → paste `scripts/ScoreEntry.gs`
6. Repeat for `DashboardEngine` (paste `scripts/DashboardEngine.gs`)
7. Repeat for `ImportExport` (paste `scripts/ImportExport.gs`)
8. Repeat for `HeatMapFormatter` (paste `scripts/HeatMapFormatter.gs`)
9. Repeat for `SparklineTrend` (paste `scripts/SparklineTrend.gs`)
10. Click **+** → **HTML** → name it `ScoreEntryUI` → paste `scripts/ScoreEntryUI.html`
11. Click **Save** (Ctrl+S / Cmd+S)
12. Reload the spreadsheet — a new **CKLA Tools** menu will appear in the menu bar
13. First run: click **CKLA Tools → Enter Assessment Scores** and authorize when prompted

> **Note on authorization:** The first time any function runs, Google will ask you to authorize the script. Click **Advanced → Go to CKLA Skills Tracking (unsafe) → Allow**. This is normal for custom Google Workspace scripts — it needs read/write access to your spreadsheet data.

---

## How to Use

- **Day-to-day entry:** Use the sidebar form (CKLA Tools → Enter Assessment Scores), or the converted checkbox grids in unit tabs
- **Admin users:** Follow the [Apps Script guide](CKLA_Apps_Script_System.html) to install and configure scripts
- See [ckla_skills_redesign.html](ckla_skills_redesign.html) for full workflow, architecture, pain points, and recommended improvements

---

## For Contributors

- Issues are tracked per phase
- Scripts are maintained in the `scripts/` folder for version control
- Please open issues for bugs, feature requests, and process improvements

---

## Credits

Prepared by **Christina Kelley**, Christel House Indianapolis — March 2026.
