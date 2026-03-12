# CKLA Tracker — Site Implementation Guide

**Audience:** School site administrator or instructional coach setting up CKLA Tracker at a new school site  
**Estimated reading time:** 20–25 minutes  
**Last updated:** 2026  

---

## Table of Contents

1. [Prerequisites & Planning](#1-prerequisites--planning)
2. [Phase 1: Workbook Setup & Quick Wins (Day 1)](#2-phase-1-workbook-setup--quick-wins-day-1)
3. [Phase 2: Apps Script Input System (Week 1–2)](#3-phase-2-apps-script-input-system-week-12)
4. [Phase 3: Reporting & Dashboards (Week 3–4)](#4-phase-3-reporting--dashboards-week-34)
5. [Phase 4: Admin & Scaling (Week 5+)](#5-phase-4-admin--scaling-week-5)
6. [Ongoing Maintenance](#6-ongoing-maintenance)
7. [Troubleshooting & FAQ](#7-troubleshooting--faq)
8. [Quick Reference Card](#8-quick-reference-card)

---

## 1. Prerequisites & Planning

### What You Need Before Starting

Before you open a single spreadsheet, gather the following:

| Item | Why You Need It | Where to Get It |
|------|-----------------|-----------------|
| **Google Workspace account** (school-issued) | All workbooks live in Google Drive; Apps Scripts run in Google's cloud | Your district IT department |
| **CKLA curriculum unit list** | You'll name unit tabs to match assessment names (K Unit 1, Gr1 Unit 1, etc.) | Your CKLA curriculum coordinator |
| **Teacher roster** | Entered in the `1. Meta Data` tab (columns B–D, starting at row 13) | Your school office or SIS |
| **Student roster with demographics** | Entered per unit tab: Student #, School, Grade, Teacher, Student ID, Student Name (columns A–F) | Your school's Student Information System (SIS) |
| **GitHub access** (or shared Drive link) | To download the workbook templates and copy script code | [github.com/ckelley-adira/CKLATracker](https://github.com/ckelley-adira/CKLATracker) |

> **Tip:** Ask your district IT admin to confirm that Google Apps Script is enabled for your Workspace domain before you begin. Some districts restrict script execution — this must be unlocked for CKLA Tracker to work.

### Estimated Time by Phase

| Phase | Typical Time | Who Does It |
|-------|-------------|-------------|
| Phase 1 — Workbook setup & quick wins | 2–4 hours (Day 1) | Site admin |
| Phase 2 — Input automation | 1–2 weeks | Site admin + one teacher pilot |
| Phase 3 — Reporting | 1–2 weeks | Site admin |
| Phase 4 — Admin & scaling | 1–2 weeks (ongoing) | Site admin |

### Decision Points

Answer these questions before you begin to save time later:

1. **Which grades are you setting up?** The repo includes templates for Grade K (`CKLASkillsTracking_GradeK_FY26.xlsx`) and Grade 1 (`CKLASkillsTracking_Grade1_FY26.xlsx`). For Grade 2, start from the Grade 1 template: upload it to Google Sheets, then rename each unit tab to use the `Gr2` prefix (e.g., rename `Gr1 U1 Reading` → `Gr2 U1 Reading`). Update the `1. Meta Data` tab with the correct grade level and teacher roster. Scripts auto-detect unit tabs by name prefix (`K U`, `Gr1`, `Gr2`), so the renaming step is required for Grade 2 to work correctly.

2. **How many teachers per grade?** If you have more than 3 teachers per grade, plan to use Phase 2's per-teacher input sheets to reduce data-entry conflicts.

3. **Do you want Google Form entry?** Google Forms let teachers enter scores from a phone or tablet. This is optional but highly recommended for multi-classroom deployments. Decide before Phase 2.

4. **Which phases will you deploy this year?** Phase 1 alone gives you a functional tracking system. Phases 2–4 add automation and reporting — deploy them when you're ready, not all at once.

> **Tip:** Start with Phase 1 only for your first unit cycle. Get comfortable with the workbook before adding scripts.

---

## 2. Phase 1: Workbook Setup & Quick Wins (Day 1)

### Step 1 — Download the Workbook Templates

1. Go to [github.com/ckelley-adira/CKLATracker](https://github.com/ckelley-adira/CKLATracker).
2. Click the file you need:
   - `CKLASkillsTracking_GradeK_FY26.xlsx` (Kindergarten)
   - `CKLASkillsTracking_Grade1_FY26.xlsx` (Grade 1)
3. Click the **Download raw file** button (the download icon in the top-right of the file preview).
4. Save the `.xlsx` file to your computer.

> **Tip:** If your school already has these in a shared Google Drive folder, skip the download — just make a copy of the existing file instead (File → Make a copy).

### Step 2 — Upload to Google Sheets

1. Open [Google Drive](https://drive.google.com) in Chrome or Edge.
2. Drag the `.xlsx` file into your Drive folder, **or** click **+ New → File upload**.
3. Once uploaded, right-click the file and choose **Open with → Google Sheets**.
4. Google Sheets will convert it automatically. You should see all tabs at the bottom.
5. Rename the file to something like `CKLA Tracker — Grade K — [School Name] — FY26`.

> **Tip:** Do NOT edit the `.xlsx` file in Excel after uploading. Always work in the Google Sheets version to keep formulas and scripts working correctly.

### Step 3 — Configure the `1. Meta Data` Tab

The `1. Meta Data` tab is the control center for the workbook. Fill it in before entering any student data.

1. Click the `1. Meta Data` tab.
2. Enter your **school name**, **academic year**, and **grade level** in the designated cells (usually near the top of the sheet — look for clearly labeled fields).
3. Enter your **teacher roster** starting at **row 13, column B**:

| Column | What to Enter | Example |
|--------|---------------|---------|
| **B** | Teacher last name | Smith |
| **C** | Teacher first name | Jennifer |
| **D** | Grade level | K |

4. Add one teacher per row. The teacher names you enter here will appear in dropdown menus throughout the workbook.

> **Tip:** Enter teacher names exactly as they appear in your student roster (Last, First). Mismatches will cause reporting errors later.

### Step 4 — Enter Student Rosters in Unit Tabs

Each unit tab (e.g., `K U1 Phonological Awareness`) has a fixed student data area. Enter your roster in **columns A–F, starting at row 16**:

| Column | Field | Example |
|--------|-------|---------|
| **A** | Student # (sequential) | 1, 2, 3 … |
| **B** | School name | Lincoln Elementary |
| **C** | Grade | K |
| **D** | Teacher last name | Smith |
| **E** | Student ID | 12345 |
| **F** | Student Name (Last, First) | Rodriguez, Maria |

> **⚠️ Important:** Do **not** delete, reorder, sort, or overwrite student names after they've been entered. The scripts reference students by **row position** — this is a known architectural constraint of the current system. If row positions shift (due to sorting or deletion), script-submitted scores will be written to the wrong student. Always add new students at the bottom of the existing list; never insert rows in the middle.

- Columns G, H, and I contain **formulas** (Quintile, % Correct, Total Points). Do not edit these columns.
- Copy your student info to every unit tab for that grade. A quick way: enter the roster on the first unit tab, then select only **columns A–F** (student data only — do NOT include columns G–I which contain formulas), copy those rows starting from row 16, and paste into the same position in each additional unit tab. The formula columns (G–I) on each tab will populate automatically based on that tab's score entries.

### Step 5 — Apply Phase 1 Quick Wins

These one-time setup steps make the workbook cleaner and more teacher-friendly.

#### Hide Backend Tabs

Right-click each of these tabs and choose **Hide sheet**:
- `Extract`
- `Extract old` (if present)
- `Reference`
- `Staging`

Teachers do not need to see these tabs; hiding them reduces confusion.

#### Color-Code Tabs by Function

Right-click each tab, choose **Change color**, and apply:

| Color | Tab Type | Examples |
|-------|----------|---------|
| 🟠 Orange | Data entry (unit tabs) | K U1, K U2, Gr1 U1 |
| 🔵 Blue | Reports & summaries | Summary, Dashboard |
| ⚫ Gray | Backend/admin | Meta Data, Extract, Reference |

#### Add Data Validation to Score-Entry Cells

1. Select the score-entry columns (starting at column J) for all student rows.
2. Go to **Data → Data validation**.
3. Set the rule: **Number → is between → 0** and the maximum points for that unit.
4. Set "If invalid data" to **Show warning** (not reject — this prevents frustrating entry blocks).

#### Protect Formula Cells

1. Select **columns G, H, and I** (Quintile, % Correct, Total Points) for all student rows.
2. Go to **Data → Protect sheets and ranges**.
3. Click **+ Add a sheet or range**, then click **Set permissions**.
4. Choose **Only you** (or add other admins). This prevents accidental formula deletion.
5. Repeat for any summary rows at the bottom of each unit tab.

#### Convert Binary Score Columns to Checkboxes

For units with binary (0/1) scores — such as phonological awareness tasks:
1. Select the binary score cells.
2. Go to **Insert → Checkbox**.
3. Google Sheets will replace 0/1 entries with checkboxes (FALSE = not mastered, TRUE = mastered).

### Step 6 — Install Core Apps Scripts

Scripts power the CKLA Tools menu and all automated features. Follow these steps **exactly**:

1. In your Google Sheet, go to **Extensions → Apps Script**. A new browser tab opens.
2. Delete the placeholder `myFunction()` code in the default `Code.gs` file.
3. For each script file listed below, create a new file in Apps Script:
   - Click the **+** icon next to "Files" → choose **Script** (for `.gs` files) or **HTML** (for `.html` files).
   - Name the file exactly as listed (without the `.gs` or `.html` extension — Apps Script adds it automatically).
   - Copy the full contents from the corresponding file in the `scripts/` folder of the GitHub repo.
   - Paste into the Apps Script editor.
   - Click **Save** (Ctrl+S or Cmd+S).

**Core / Phase 1 scripts to install:**

| File in `scripts/` | Apps Script file name | What it does |
|--------------------|-----------------------|--------------|
| `CKLAConfig.gs` | `CKLAConfig` | Constants, menu builder, shared utilities |
| `ScoreEntry.gs` | `ScoreEntry` | Score submission backend with validation |
| `ScoreEntryUI.html` | `ScoreEntryUI` | Sidebar UI for score entry |
| `DashboardEngine.gs` | `DashboardEngine` | Summary refresh, student reports, dashboard stats |
| `ImportExport.gs` | `ImportExport` | CSV import/export, data validation, backup |
| `HeatMapFormatter.gs` | `HeatMapFormatter` | Green/yellow/red conditional formatting on unit tabs |
| `SparklineTrend.gs` | `SparklineTrend` | SPARKLINE trend formulas for summary charts |

4. After saving all files, **reload your Google Sheet** (close the Apps Script tab, then refresh the sheet). The **CKLA Tools** menu should appear in the menu bar.

> **Tip:** If the CKLA Tools menu doesn't appear after refreshing, go back to the Apps Script editor and check for red error indicators next to any file name. A syntax error in any one file will prevent the menu from loading.

### Step 7 — Run HeatMapFormatter and SparklineTrend

1. In your Google Sheet, click **CKLA Tools** in the menu bar.
2. Go to **Phase 1 Tools → Apply Heat Map to Roster Views**.
   - This applies green (high), yellow (middle), and red (low) conditional formatting to score columns on all unit tabs.
3. Go to **CKLA Tools → Phase 1 Tools → Add Sparkline Trends to Summary Charts**.
   - This inserts SPARKLINE formulas into the summary area so you can see trend lines at a glance.

> **Tip:** Re-run these any time you add new unit tabs or extend the student roster.

### Step 8 — Verify Setup

Before moving to Phase 2, confirm the following:
- [ ] The **CKLA Tools** menu is visible in the menu bar
- [ ] Unit tabs are color-coded and backend tabs are hidden
- [ ] Formula cells (G, H, I) are protected
- [ ] At least one unit tab has student data entered
- [ ] Heat map colors appear on score columns
- [ ] Sparkline trend cells appear in the summary area

---

## 3. Phase 2: Apps Script Input System (Week 1–2)

Phase 2 reduces manual data entry by adding a Navigation Hub, per-teacher input sheets, optional Google Form integration, and automated unit tab generation.

> **Reference:** See [`docs/phase2_onboarding.md`](phase2_onboarding.md) for detailed end-user workflow instructions to share with teachers.

### Step 1 — Install Phase 2 Scripts

Following the same process as Phase 1 (Extensions → Apps Script), add these four additional files:

| File in `scripts/` | Apps Script file name | What it does |
|--------------------|-----------------------|--------------|
| `FormIntegration.gs` | `FormIntegration` | Links Google Forms to the master sheet |
| `NavigationHub.gs` | `NavigationHub` | Builds the Navigation Hub first tab |
| `TeacherSheetSync.gs` | `TeacherSheetSync` | Creates and syncs per-teacher input sheets |
| `UnitTemplateEngine.gs` | `UnitTemplateEngine` | Generates new unit tabs from a template |

After saving, reload the sheet. You should now see **CKLA Tools → Phase 2 Tools** in the menu.

### Step 2 — Build the Navigation Hub

The Navigation Hub is a new first tab with one-click links to all unit tabs, tools, and reports.

1. Click **CKLA Tools → Phase 2 Tools → Build Navigation Hub**.
2. A new tab named `Navigation Hub` will be created and moved to the first position.
3. Drag it to the far-left position if it didn't end up there automatically.

### Step 3 — Create Per-Teacher Input Sheets

Per-teacher input sheets show each teacher only their own students and the current unit — reducing confusion and preventing accidental edits to other teachers' data.

1. Click **CKLA Tools → Phase 2 Tools → Create Teacher Input Sheet**.
2. A dialog will prompt you to select a teacher name (from the `1. Meta Data` roster).
3. Select the teacher and click **Create**. A new tab will appear with only that teacher's students.
4. Repeat for each teacher.
5. Share the workbook with each teacher (File → Share) with **Commenter** or **Editor** access as appropriate.

> **Tip:** For large schools, consider giving teachers Editor access only to their own input sheet tab and Viewer access to everything else. Use sheet-level protection (Data → Protect sheets and ranges) to enforce this.

### Step 4 — Set Up Google Forms (Optional)

Google Forms let teachers enter scores from any device, including phones and tablets. Responses flow automatically into the master sheet.

1. Click **CKLA Tools → Phase 2 Tools → Create Assessment Form**.
2. Select the unit and grade for which you want a form.
3. Click **Create**. A new Google Form will be created in your Drive and linked to the sheet.
4. Copy the form link and share it with the relevant teacher(s).

> **Tip:** Label each form clearly (e.g., "Grade K — Unit 1 Phonological Awareness Entry") so teachers don't confuse forms across units.

### Step 5 — Generate Unit Tabs from Templates

When a new assessment unit begins, generate a fresh unit tab automatically:

1. Click **CKLA Tools → Phase 2 Tools → Generate Unit Tab**.
2. Enter the unit name (e.g., `K U3 Listening Comprehension`).
3. Select the grade and teacher(s) whose roster should be pre-populated.
4. Click **Generate**. The new tab will appear, pre-formatted with the correct column headers, formula cells, and your student roster.

### Step 6 — Teacher Training

Before teachers start entering scores, walk them through the sidebar score entry workflow:

1. In the sheet, click **CKLA Tools → Open Score Entry Sidebar**.
2. The sidebar opens on the right side of the screen.
3. Walk teachers through: select Grade → select Unit → select their name → select a student → enter scores → click Submit.
4. Scores auto-advance to the next student after submission.

Share [`docs/phase2_onboarding.md`](phase2_onboarding.md) with teachers as a reference guide.

---

## 4. Phase 3: Reporting & Dashboards (Week 3–4)

Phase 3 turns raw assessment data into actionable reports for teachers, administrators, and instructional coaches.

> **Reference:** See [`docs/phase3_reporting.md`](phase3_reporting.md) for detailed usage instructions for each report type.

### Step 1 — Install Phase 3 Scripts

Add these three additional files in the Apps Script editor:

| File in `scripts/` | Apps Script file name | What it does |
|--------------------|-----------------------|--------------|
| `SkillDrillDown.gs` | `SkillDrillDown` | Skill-level analysis by assessment section |
| `TeacherActionReport.gs` | `TeacherActionReport` | One-page class summary with action items |
| `CohortComparison.gs` | `CohortComparison` | Compare groups by demographics |

After saving, reload the sheet. You should see **CKLA Tools → Phase 3 Reports** in the menu.

### Step 2 — Student Progress Report (Individual)

Generates a visual progress summary for a single student, including trend lines and mastery breakdown.

1. Click **CKLA Tools → Reports → Generate Student Report**.
2. Select the student's name from the dropdown.
3. Click **Generate**. A new sheet tab is created with the student's progress data.

### Step 3 — Skill Drill-Down Report

Shows performance broken down by assessment section (Comprehension, Vocabulary, Writing, etc.) for a class or grade.

1. Click **CKLA Tools → Phase 3 Reports → Skill Drill-Down**.
2. Select the grade, teacher, and unit.
3. Click **Run**. Results display in a new sheet showing section averages highlighted in green (≥70%), yellow (50–69%), or red (<50%).

### Step 4 — Teacher Action Report

A one-page summary for each teacher showing class metrics, students needing support, and auto-generated action items.

1. Click **CKLA Tools → Phase 3 Reports → Teacher Action Report**.
2. Select the teacher and unit.
3. Click **Generate Report**. The report appears in a new sheet.
4. Print it for your instructional coaching conversation: right-click the sheet tab → **Download as PDF**, or use **File → Print**.

> **Tip:** Action items are auto-generated based on: students below 60%, low class mastery rate, skill section gaps, and performance decline. Review them with the teacher and add your own notes before the coaching meeting.

### Step 5 — Cohort Comparison

Compares assessment performance across student subgroups (by ethnicity, multilingual learner status, English Learner status, etc.).

1. Click **CKLA Tools → Phase 3 Reports → Cohort Comparison**.
2. Select the grade and unit.
3. Choose the demographic grouping from the dropdown.
4. Click **Compare**. A chart and data table appear showing group averages and trend lines.

> **Tip:** The demographics used in Cohort Comparison come from your student roster (columns B–F of each unit tab). Make sure student demographic data is filled in accurately before running this report.

---

## 5. Phase 4: Admin & Scaling (Week 5+)

Phase 4 tools are designed for administrators managing multiple classrooms, grades, or partner schools.

> **Reference:** See [`docs/phase4_admin.md`](phase4_admin.md) for detailed usage instructions.

### Step 1 — Install Phase 4 Scripts

Add these four additional files in the Apps Script editor:

| File in `scripts/` | Apps Script file name | What it does |
|--------------------|-----------------------|--------------|
| `AuditTrail.gs` | `AuditTrail` | Logs every cell edit with user, timestamp, old/new value |
| `WorkbookSplitter.gs` | `WorkbookSplitter` | Splits the master workbook into per-grade files |
| `AdminConsole.gs` | `AdminConsole` | Centralized admin dashboard backend |
| `AdminConsoleUI.html` | `AdminConsoleUI` | Admin Console sidebar UI |

After saving, reload the sheet. You should see **CKLA Tools → Phase 4 Admin** in the menu.

### Step 2 — Initialize the Audit Trail

The Audit Trail logs every cell edit so you can track who changed what and when.

1. Click **CKLA Tools → Phase 4 Admin → Initialize Audit Trail**.
2. A hidden sheet called `Audit Log` will be created automatically.
3. From this point on, every edit is logged with: timestamp, user email, sheet name, cell address, old value, and new value.

> **Tip:** The Audit Log auto-archives when it reaches 10,000 rows. You do not need to manage it manually.

To view the audit log:
1. Click **CKLA Tools → Phase 4 Admin → View Audit Log**.
2. Use the filter controls to search by sheet, user, or date range.

### Step 3 — Open the Admin Console

The Admin Console is a sidebar dashboard giving you a high-level view of the entire system.

1. Click **CKLA Tools → Phase 4 Admin → Admin Console**.
2. The console opens as a sidebar with four tabs:
   - **Dashboard** — System status, tab counts, component health check
   - **Onboard** — Create new workbooks for partner schools
   - **Partners** — Manage existing school configurations
   - **Operations** — Run bulk operations across the whole workbook

### Step 4 — Split Workbooks Per Grade

If your school has grown beyond one workbook, or if you want separate files for each grade:

1. Click **CKLA Tools → Phase 4 Admin → Split Workbook by Grade** (or use the Operations tab in the Admin Console).
2. The tool creates separate Google Sheets files for Grade K, Grade 1, and Grade 2.
3. Each new file is linked back to the master using `IMPORTRANGE` formulas, so cross-grade summary data remains available in one place.

> **Tip:** Before splitting, make sure all unit tabs are named with the correct grade prefix (`K U`, `Gr1`, `Gr2`). The splitter uses these prefixes to assign tabs to the correct output file.

### Step 5 — Onboard a New Partner School

To set up CKLA Tracker at a second school site using the same admin account:

1. Open the **Admin Console** (CKLA Tools → Phase 4 Admin → Admin Console).
2. Click the **Onboard** tab.
3. Enter the new school's name, grade levels, and teacher roster.
4. Click **Create Workbook**. A new workbook will be generated in your Drive with the correct template, already pre-configured with the school's info.
5. Share the new workbook with the site admin at the partner school.

---

## 6. Ongoing Maintenance

Once the system is running, a small amount of weekly and yearly maintenance keeps everything accurate.

### Weekly Routines

| Task | How | When |
|------|-----|------|
| **Backup data sheets** | CKLA Tools → Data Tools → Backup Data Sheets | Every Friday |
| **Validate all data** | CKLA Tools → Data Tools → Validate All Data | After any bulk entry session |
| **Refresh all summaries** | CKLA Tools → Reports → Refresh All Summaries | After bulk score entry |

### Adding New Units or Assessments Mid-Year

1. Use **CKLA Tools → Phase 2 Tools → Generate Unit Tab** to create the new unit tab from the standard template.
2. Copy your student roster from an existing unit tab into the new tab (columns A–F, starting at row 16).
3. Re-run **CKLA Tools → Phase 1 Tools → Apply Heat Map** to add color formatting to the new tab.
4. If using Google Forms, create a new form for the new unit: **CKLA Tools → Phase 2 Tools → Create Assessment Form**.

### Start-of-Year Reset Process

At the beginning of each new school year:

1. **Archive the previous year's workbook.** Rename it (e.g., add "FY25 Archive") and move it to an archive folder. Do not delete it — you may need it for longitudinal comparisons.
2. **Download fresh templates** from the GitHub repo (or duplicate your existing workbook).
3. **Re-enter the teacher roster** in the `1. Meta Data` tab. Remove any teachers who have left and add new ones.
4. **Re-enter student rosters** in each unit tab. Do not copy rosters from the previous year — class assignments change.
5. **Re-run all Phase 1 quick wins** (heat map, sparklines, protection, validation) on the new workbook.
6. **Re-initialize the Audit Trail** if using Phase 4: CKLA Tools → Phase 4 Admin → Initialize Audit Trail.

> **Tip:** If your school keeps the same students from one year to the next (e.g., promoting from K to 1), you can export the prior year's student data using CKLA Tools → Data Tools → Export to CSV and import it as a starting roster. Update grade levels and teacher assignments before finalizing.

---

## 7. Troubleshooting & FAQ

### The CKLA Tools menu is not appearing

**Cause:** A syntax error in one of the script files, or the scripts haven't been saved yet.

**Fix:**
1. Go to **Extensions → Apps Script**.
2. Look for a red dot or exclamation mark next to any file in the left panel.
3. Click the file with the error to see the error message.
4. Fix the error (usually a missing quote, bracket, or curly brace) and re-save.
5. Close the Apps Script tab and reload your Google Sheet.

If there are no errors visible, try: in the Apps Script editor, click the **Run** menu → **Run function** → select `onOpen`. This manually triggers the menu builder.

### Google is asking me to authorize the scripts

**This is expected** the first time you run any CKLA Tools menu item. Google requires you to explicitly grant Apps Script access to your spreadsheet.

1. Click **Review permissions** when the authorization dialog appears.
2. Choose your Google account.
3. Click **Advanced → Go to CKLA Tracker (unsafe)**. The "unsafe" label appears because the script has not been submitted to Google for external verification — it does not mean the code is malicious. Only proceed if you obtained the script code from the trusted GitHub repository (`ckelley-adira/CKLATracker`) or your school's admin. If your organization requires script review before deployment, share the `scripts/` folder contents with your IT department for approval first.
4. Click **Allow**.
5. The script will now run. You should only need to do this once per Google account.

> **Tip:** If teachers are running scripts (e.g., submitting scores via the sidebar), each teacher will need to go through the authorization flow once on their own account.

### A teacher accidentally edited formula cells (columns G, H, or I)

**Symptoms:** The Overall %, Quintile, or Total Points column shows a number instead of a formula result, or the cell is blank.

**Fix:**
1. Press **Ctrl+Z** (or Cmd+Z on Mac) to undo — this works if the edit was recent.
2. If undo is not available, click the affected cell and re-enter the formula manually:
   - Column G (Quintile): look at an adjacent row for the correct formula pattern and copy it down.
   - Column H (% Correct): same — copy from an adjacent row.
   - Column I (Total Points): same.
3. After restoring the formula, re-protect those columns: **Data → Protect sheets and ranges**.

**Prevention:** After any incident, re-run protection on formula cells to prevent it from happening again.

### Script errors after adding a new unit tab

**Cause:** Unit tabs must follow the naming convention exactly: `K U` prefix for Kindergarten, `Gr1` prefix for Grade 1, `Gr2` prefix for Grade 2. Tabs with names that don't match these prefixes (and don't contain "Roster" or "Summary") may cause scripts to misidentify them.

**Fix:** Rename the tab to start with the correct prefix, then re-run the affected script.

### Scores appear to be in the wrong row

**Cause:** Student names were reordered, sorted, or deleted after entry, breaking the row-position reference used by scripts.

**Fix:** Do **not** sort or delete student rows mid-year. If you need to add a student, add them at the bottom of the list.

### The heat map colors disappeared after I added new rows

**Fix:** Re-run **CKLA Tools → Phase 1 Tools → Apply Heat Map to Roster Views** to reapply conditional formatting to the expanded range.

### Frequently Asked Questions

**Q: Can I use CKLA Tracker on a phone or tablet?**  
A: Google Sheets works in a mobile browser, but the sidebar score entry UI works best on a desktop or laptop. For mobile-friendly entry, set up Google Forms (Phase 2 → Create Assessment Form).

**Q: Can two teachers enter scores at the same time?**  
A: Yes, but they must enter scores in different tabs (their own per-teacher input sheets) to avoid conflicts. Do not have two people editing the same cell simultaneously.

**Q: How do I remove a student who has left the school?**  
A: Do not delete the row — leave it in place and simply stop entering scores for that student. Deleting rows shifts all rows below it and will break formulas and script references.

**Q: Can I add a new column for an extra assessment question?**  
A: Yes, but only in the score-entry columns (column J and beyond). Do not insert columns before column J. After adding a column, re-run data validation on the new column.

**Q: How do I share reports with parents?**  
A: Generate the student report (CKLA Tools → Reports → Generate Student Report), then right-click the report tab and choose **Download as PDF**. Share the PDF with the parent.

---

## 8. Quick Reference Card

### Task → Menu Path → Script File

| Task | Menu Path | Script File |
|------|-----------|-------------|
| Open score entry sidebar | CKLA Tools → Open Score Entry Sidebar | `ScoreEntry.gs`, `ScoreEntryUI.html` |
| Refresh all summaries | CKLA Tools → Reports → Refresh All Summaries | `DashboardEngine.gs` |
| Generate student report | CKLA Tools → Reports → Generate Student Report | `DashboardEngine.gs` |
| Backup data sheets | CKLA Tools → Data Tools → Backup Data Sheets | `ImportExport.gs` |
| Validate all data | CKLA Tools → Data Tools → Validate All Data | `ImportExport.gs` |
| Apply heat map formatting | CKLA Tools → Phase 1 Tools → Apply Heat Map | `HeatMapFormatter.gs` |
| Add sparkline trends | CKLA Tools → Phase 1 Tools → Add Sparkline Trends | `SparklineTrend.gs` |
| Build Navigation Hub | CKLA Tools → Phase 2 Tools → Build Navigation Hub | `NavigationHub.gs` |
| Create teacher input sheet | CKLA Tools → Phase 2 Tools → Create Teacher Input Sheet | `TeacherSheetSync.gs` |
| Create assessment form | CKLA Tools → Phase 2 Tools → Create Assessment Form | `FormIntegration.gs` |
| Generate unit tab | CKLA Tools → Phase 2 Tools → Generate Unit Tab | `UnitTemplateEngine.gs` |
| Skill Drill-Down | CKLA Tools → Phase 3 Reports → Skill Drill-Down | `SkillDrillDown.gs` |
| Teacher Action Report | CKLA Tools → Phase 3 Reports → Teacher Action Report | `TeacherActionReport.gs` |
| Cohort Comparison | CKLA Tools → Phase 3 Reports → Cohort Comparison | `CohortComparison.gs` |
| Initialize Audit Trail | CKLA Tools → Phase 4 Admin → Initialize Audit Trail | `AuditTrail.gs` |
| View Audit Log | CKLA Tools → Phase 4 Admin → View Audit Log | `AuditTrail.gs` |
| Admin Console | CKLA Tools → Phase 4 Admin → Admin Console | `AdminConsole.gs`, `AdminConsoleUI.html` |
| Split workbook by grade | CKLA Tools → Phase 4 Admin → Split Workbook by Grade | `WorkbookSplitter.gs` |

### Cross-References

| Document | What It Covers |
|----------|---------------|
| [`docs/phase2_onboarding.md`](phase2_onboarding.md) | End-user guide for Phase 2 input workflows (share with teachers) |
| [`docs/phase3_reporting.md`](phase3_reporting.md) | Detailed usage guide for all Phase 3 reports |
| [`docs/phase4_admin.md`](phase4_admin.md) | Full admin guide for audit trail, workbook splitting, and admin console |
| [`CKLA_Apps_Script_System.html`](../CKLA_Apps_Script_System.html) | Complete Apps Script code and architecture reference |
| [`ckla_skills_redesign.html`](../ckla_skills_redesign.html) | Full redesign audit, design decisions, and phased roadmap |

### Support

For technical issues with the CKLA Tracker system, contact your site administrator or open an issue at [github.com/ckelley-adira/CKLATracker/issues](https://github.com/ckelley-adira/CKLATracker/issues).

> **Tip:** When reporting an issue, include: the script file name (from the Quick Reference Card above), the exact error message, and what you were doing when the error appeared. This helps the developer diagnose and fix issues faster.

---

*CKLA Tracker — Site Implementation Guide · Version 3.0 · [github.com/ckelley-adira/CKLATracker](https://github.com/ckelley-adira/CKLATracker)*
