# Phase 3 Reporting Guide — CKLA Skills Tracker

Quick-start guide for using the Phase 3 reporting and dashboard features.

---

## What's New in Phase 3

Phase 3 adds four reporting features to transform raw assessment data into actionable insights:

| Feature | What It Does | Who It's For |
|---|---|---|
| **Student Progress (Individual)** | Per-student view with visual progress bars, trend analysis, and mastery breakdown | Teachers, Parents |
| **Skill Drill-Down by Section** | Performance breakdown by assessment section (Comprehension, Vocabulary, Writing, etc.) across units | Teachers, Interventionists |
| **Teacher Action Report** | One-pager with class summary, flagged students, skill gaps, and auto-generated action items | Teachers, Data Teams |
| **Cohort Comparison Charts** | Compare performance across demographic groups (ethnicity, MLL, EL) with trend lines | Admins, Data Teams |

---

## Getting Started

### 1. Individual Student Progress

View any student's performance across all units with a visual dashboard:

1. Click **CKLA Tools → Phase 3 Reports → Student Progress (Individual)**
2. Select a **Grade** from the dropdown
3. Select a **Student** from the list
4. Click **Show Progress** to see:
   - Trend indicator (Improving, Declining, or Stable)
   - Mastery breakdown tiles (At Mastery / Approaching / Below)
   - Visual progress bars for each unit
   - Detailed score table with quintile levels

### 2. Skill Drill-Down by Section

Identify persistent skill gaps across your class:

1. Click **CKLA Tools → Phase 3 Reports → Skill Drill-Down by Section**
2. Select a **Grade** and optional **Teacher** filter
3. Click **Generate Drill-Down** to see per-section performance for each unit
4. Click **Show Weakest Skills Summary** to see sections ranked by average score (weakest first)

> **Reading the results:** Sections highlighted in red (< 60% average) indicate areas where most students are struggling. Use this to prioritize re-teaching or intervention.

### 3. Teacher Action Report

Generate a comprehensive one-pager for data team meetings:

1. Click **CKLA Tools → Phase 3 Reports → Teacher Action Report**
2. Select a **Grade** and **Teacher**
3. Click **Generate Report** to see:
   - **Class Summary** — Total students, class average, tier counts
   - **Unit Breakdown** — Per-unit averages with color coding
   - **Flagged Students** — Students below 60% on any unit, with details
   - **Skill Gaps** — Assessment sections averaging below 70%
   - **Action Items** — Auto-generated recommendations based on your data

### 4. Cohort Comparison Charts

Compare performance across demographic groups:

1. Click **CKLA Tools → Phase 3 Reports → Cohort Comparison Charts**
2. Select a **Grade** and **Demographic Field** (Ethnicity, MLL, EL, etc.)
3. Click **Generate Comparison** to see:
   - Performance table by group across all units
   - Trend summary showing first-to-last unit change per group

> **Note:** Demographic fields are read from the Meta Data tab. If no demographic columns are found, contact your admin to add them.

---

## Frequently Asked Questions

**Q: Do Phase 3 reports change any data in my workbook?**
A: No. All Phase 3 features are read-only — they analyze existing data and display it in dialogs. No cells are modified.

**Q: Can I print the reports?**
A: The dialogs display in-browser. You can use your browser's print function (Ctrl+P / Cmd+P) while a dialog is open. The Student Progress report is designed for printable output.

**Q: What if a report shows "No data found"?**
A: This means no scores have been entered for the selected grade/teacher/student. Enter scores first using the Score Entry sidebar or any Phase 2 input method.

**Q: How are skill gaps identified?**
A: A skill gap is flagged when a section's class average is below 70%. This threshold identifies areas where the majority of students need additional support.

**Q: How are action items generated?**
A: Action items are auto-generated based on:
- Number of students below 60% (triggers intervention recommendation)
- Class mastery rate below 50% (triggers re-teaching recommendation)
- Detected skill gaps (triggers strategy review recommendation)
- Performance decline between units (triggers investigation recommendation)

---

## Quick Reference: Phase 3 Menu

All Phase 3 tools are under **CKLA Tools → Phase 3 Reports**:

| Menu Item | Who Uses It | What It Does |
|---|---|---|
| Student Progress (Individual) | Teacher / Parent | Individual student dashboard with progress bars and trends |
| Skill Drill-Down by Section | Teacher / Interventionist | Section-level performance breakdown across units |
| Teacher Action Report | Teacher / Data Team | One-pager with summary, flags, gaps, and action items |
| Cohort Comparison Charts | Admin / Data Team | Demographic group comparison with trend analysis |

---

## Need Help?

- See the [Phase 2 Onboarding Guide](phase2_onboarding.md) for input workflows
- See the [Apps Script System Guide](../CKLA_Apps_Script_System.html) for technical details
- Open an issue on GitHub for bugs or feature requests

---

*Prepared for Christel House Indianapolis — CKLA Skills Tracking Phase 3*
