# Phase 4 Admin Guide — CKLA Skills Tracker

Quick-start guide for admin features in Phase 4: audit trail, workbook splitting, and admin console.

---

## What's New in Phase 4

Phase 4 focuses on scalability and sustainability for multi-school deployments:

| Feature | What It Does | Who It's For |
|---|---|---|
| **Audit Trail** | Automatically logs every cell edit with timestamp, user, sheet, cell, old/new values | Admins, Data Teams |
| **Workbook Split Manager** | Split the master workbook into per-grade files for better performance | Admins |
| **Admin Console** | Centralized dashboard for system status, partner onboarding, and bulk operations | Admins |

---

## Getting Started

### 1. Initialize the Audit Trail

The audit trail tracks every cell edit in the workbook for accountability and error tracing:

1. Click **CKLA Tools → Phase 4 Admin → Initialize Audit Trail**
2. Authorize the script when prompted
3. The system will:
   - Create a hidden "Audit Log" sheet
   - Install an edit trigger that runs automatically
4. All future cell edits will be logged with timestamp, user email, sheet name, cell reference, and old/new values

> **Note:** The audit trail requires an installable trigger, which needs one-time authorization. The Audit Log sheet is hidden by default — use **Toggle Audit Log Visibility** to view it.

### 2. View the Audit Log

Review recent edits to the workbook:

1. Click **CKLA Tools → Phase 4 Admin → View Audit Log**
2. Use the filters to narrow results:
   - **Sheet** — Show edits to a specific tab only
   - **User** — Filter by user email
   - **Since** — Show edits after a specific date
   - **Limit** — Control how many entries to display (default: 200)
3. Click **Filter** to apply

> **Tip:** The audit log auto-archives when it exceeds 10,000 rows. Old entries are moved to a hidden "Audit Archive" sheet.

### 3. Split Workbooks by Grade

For large deployments, split the master workbook into separate per-grade files:

1. Click **CKLA Tools → Phase 4 Admin → Workbook Split Manager**
2. Review the preview showing tabs detected for each grade
3. Click **Split Grade K** (or 1 or 2) to create a new workbook
4. The new workbook will contain:
   - All unit tabs for that grade
   - Roster Views and Summary Charts
   - Shared tabs (Meta Data, Navigation Hub)
5. After splitting, click **Configure IMPORTRANGE Links** to set up cross-grade reporting

> **Important:** IMPORTRANGE formulas require one-time authorization in the target workbook. Click on the cell with a `#REF!` error and click "Allow access" when prompted.

### 4. Use the Admin Console

The Admin Console provides a centralized management interface:

1. Click **CKLA Tools → Phase 4 Admin → Admin Console**
2. Navigate between tabs:
   - **Dashboard** — System status, tab counts, component health
   - **Onboard** — Create new workbooks for partner schools
   - **Partners** — View and manage partner school configurations
   - **Operations** — Run bulk operations (refresh summaries, protect sheets, etc.)

---

## Partner School Onboarding

To set up a new partner school:

1. Open the **Admin Console** → **Onboard** tab
2. Enter the **School Name** and **Academic Year**
3. Select which **Grades** to include (K, 1, 2)
4. Optionally check **Copy existing student rosters** to pre-fill student data
5. Optionally enter a **Drive Folder** name to organize the new workbook
6. Click **Create Workbook**

The system will:
- Create a new Google Sheets workbook with the selected grade tabs
- Copy the Meta Data structure for school configuration
- Store the partner info for future reference

---

## Bulk Operations

The Admin Console provides one-click access to common admin tasks:

| Operation | What It Does |
|---|---|
| **Refresh All Summaries** | Recalculate all summary statistics across unit tabs |
| **Protect Formula Cells** | Lock header rows and formula columns so teachers can only edit score cells |
| **Hide Admin Sheets** | Hide internal sheets (Audit Log, Meta Data) from casual view |
| **Show Hidden Sheets** | Unhide all hidden sheets for admin access |
| **Validate All Data** | Check for out-of-range scores, non-numeric values, and orphaned rows |
| **Initialize Audit Trail** | Set up the edit-tracking audit log (one-time setup) |

---

## Frequently Asked Questions

**Q: Does the audit trail slow down the spreadsheet?**
A: No. The `onEdit` trigger runs asynchronously and writes to a separate sheet. It does not block user edits. If logging fails for any reason, the edit still completes normally.

**Q: Can I see who changed a specific cell?**
A: Yes. Use the Audit Log Viewer (**CKLA Tools → Phase 4 Admin → View Audit Log**) and filter by the sheet name. The log shows the exact cell reference, old value, and new value for every edit.

**Q: What happens when the audit log gets too large?**
A: The system automatically archives old entries when the log exceeds 10,000 rows. Archived entries are stored in a hidden "Audit Archive" sheet. You can also manually archive using **Clear Audit Log**.

**Q: Can I undo the workbook split?**
A: The split creates a copy — the original master workbook is not modified. You can delete the per-grade workbook at any time. The IMPORTRANGE links in the Cross-Grade Report tab will show `#REF!` errors if a split workbook is deleted.

**Q: Do partner schools need to install Apps Script separately?**
A: Yes. Each new workbook created through the Admin Console will need the Apps Script files installed. Follow the Installation section in the main README.

**Q: How do I check if the audit trail is working?**
A: Open the Admin Console dashboard — the "Audit Log" and "Audit Trigger" components should both show "Active". You can also make a test edit and check the Audit Log Viewer.

---

## Quick Reference: Phase 4 Menu

All Phase 4 tools are under **CKLA Tools → Phase 4 Admin**:

| Menu Item | Who Uses It | What It Does |
|---|---|---|
| Admin Console | Admin | Centralized management dashboard with onboarding and bulk operations |
| Initialize Audit Trail | Admin (one-time) | Set up the edit-tracking audit log and install trigger |
| View Audit Log | Admin / Data Team | View and filter recent edit history |
| Toggle Audit Log Visibility | Admin | Show or hide the Audit Log sheet |
| Clear Audit Log | Admin | Archive current entries and clear the log |
| Workbook Split Manager | Admin | Split master workbook into per-grade files with IMPORTRANGE links |

---

## Need Help?

- See the [Phase 2 Onboarding Guide](phase2_onboarding.md) for input workflows
- See the [Phase 3 Reporting Guide](phase3_reporting.md) for dashboard features
- See the [Apps Script System Guide](../CKLA_Apps_Script_System.html) for technical details
- Open an issue on GitHub for bugs or feature requests

---

*Prepared for Christel House Indianapolis — CKLA Skills Tracking Phase 4*
