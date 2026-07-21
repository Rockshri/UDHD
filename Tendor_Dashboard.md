# Tender Dashboard Module

## Objective

Implement a dedicated **Tender Dashboard** module to monitor and manage projects that are in the **Tender** stage. The module should automatically track project progression through predefined Tender sub-stages, provide dashboard analytics, and allow authorized users to manually move projects between sub-stages.

The implementation should follow the existing application design language, maintain responsive behavior, and integrate with the current Project Management workflow.

---

# 1. Tender Project Stage Hierarchy

## Parent Project Stage

The following Project Stage already exists:

- Tender

Extend this stage by introducing **Tender Sub-Stages**.

## Tender Sub-Stages

The Tender stage shall consist of the following ordered workflow:

1. NIT Published
2. Bid Submission (Open)
3. Technical Evaluation
4. Financial Evaluation
5. Approval Process
6. LoA Issued
7. Agreement Signing
8. Work Order Issued

### Requirements

- Maintain the above order as the official Tender workflow.
- Every Tender project must always belong to exactly one Tender Sub-Stage.
- Store the current Tender Sub-Stage in the database.
- Preserve the Tender stage as the parent Project Stage.

---

# 2. Automatic Project Transfer

## Input Sheet Integration

When creating or updating a project:

If:

```text
Project Stage = Tender
```

Then:

- Automatically create the project inside the Tender Dashboard.
- Automatically assign the project to the first Tender Sub-Stage.

Initial Sub-Stage:

```text
NIT Published
```

Requirements:

- No manual action should be required.
- The transfer should occur immediately after saving the project.
- Existing project creation workflow should remain unaffected.

---

# 3. Left Navigation Panel

Add a new navigation item.

## Placement

Insert:

**Tender Dashboard**

Below:

- Pre-Monsoon Preparation

Add a visual separator between the two modules to clearly distinguish them.

Example:

```text
Projects
Schemes
Reports
...

----------------------------

Pre-Monsoon Preparation

----------------------------

Tender Dashboard
```

Requirements:

- Follow existing navigation styling.
- Preserve responsive behavior.
- Highlight the active menu item.

---

# 4. Tender Dashboard Popup

When the user clicks **Tender Dashboard**, open a **large modal/pop-up**.

## Popup Requirements

- Approximately 95% viewport width.
- Responsive.
- Scrollable.
- Match the existing design system.
- Maintain current typography, spacing, and theme.

---

# 5. Popup Navigation Tabs

Inside the Tender Dashboard popup, create two navigation tabs.

## Tabs

1. Dashboard
2. Project Stages

The tabs should follow the application's existing tab component design.

---

# 6. Dashboard Tab

The Dashboard tab provides an overview of Tender progress.

## KPI Cards

Create one KPI card for each Tender Sub-Stage.

Cards:

- NIT Published
- Bid Submission (Open)
- Technical Evaluation
- Financial Evaluation
- Approval Process
- LoA Issued
- Agreement Signing
- Work Order Issued

Each KPI card should display:

- Total number of projects currently in that Tender Sub-Stage.

Example:

```text
Technical Evaluation

18 Projects
```

---

## Interactive Cards

Each KPI card should be clickable.

When clicked:

Display a table beneath the KPI cards containing all projects currently in that selected Tender Sub-Stage.

Example columns:

- Project Name
- Division
- Department
- Agreement Number
- Contractor
- Current Tender Sub-Stage
- Last Updated

Follow the application's existing table design.

---

# 7. Project Stages Tab

This tab allows manual movement of projects through the Tender workflow.

## Stage Navigation

Display all Tender Sub-Stages horizontally in workflow order.

Example:

```text
NIT Published → Bid Submission → Technical Evaluation →
Financial Evaluation → Approval Process →
LoA Issued → Agreement Signing → Work Order Issued
```

The current stage should be visually highlighted.

---

## Project Selection

For each Tender Sub-Stage:

Display all projects currently assigned to that stage.

Users should be able to:

- Select one or multiple projects.

---

## Stage Transfer

Provide the following actions:

### Transfer to Next Stage

Button:

```text
Transfer to Next Stage
```

Behavior:

- Move selected project(s) to the immediate next Tender Sub-Stage.

---

### Transfer to Previous Stage

Button:

```text
Transfer to Previous Stage
```

Behavior:

- Move selected project(s) to the immediate previous Tender Sub-Stage.

---

## Validation Rules

- Prevent transferring beyond the first stage.
- Prevent transferring beyond the last stage.
- Refresh dashboard statistics immediately after transfer.
- Update the database transactionally.
- Record transfer timestamps where applicable.

---

# 8. Completion of Tender Workflow

The final Tender Sub-Stage is:

```text
Work Order Issued
```

Once a project successfully reaches this stage:

- The Tender workflow is considered complete.
- The project becomes eligible to enter the Construction stage.

---

# 9. Input Sheet Restrictions

Within the Input Sheet:

Disable manual selection of the following Project Stages:

- Construction
- O&M

These stages must remain disabled until the Tender workflow has been successfully completed.

## Enable Condition

Construction should become selectable only after:

- The project reaches the final Tender Sub-Stage (**Work Order Issued**).

After Construction is completed (as per existing workflow), O&M may then become available according to the application's project lifecycle.

Requirements:

- Prevent manual bypassing of the Tender workflow.
- Enforce validation on both frontend and backend.
- Prevent unauthorized API updates.

---

# 10. Data Synchronization

Any Tender Sub-Stage update must automatically synchronize across:

- Tender Dashboard
- Project Details
- Input Sheet
- Dashboard KPIs
- Reports
- Analytics
- Search Results
- Export functionality

The displayed Tender Sub-Stage must always remain consistent throughout the application.

---

# 11. Permissions

Only users with appropriate permissions should be allowed to:

- Transfer projects between Tender Sub-Stages.
- Modify Tender workflow status.

Users without permission should have read-only access.

Integrate with the existing Role-Based Access Control (RBAC) system.

---

# 12. UI Requirements

- Maintain existing design language.
- Maintain responsive layouts.
- Use existing typography and spacing.
- Preserve accessibility.
- Match current modal, table, and card components.
- Avoid unnecessary UI redesign.

---

# 13. Backend Requirements

Update the backend to support:

- Tender Sub-Stage entity/field.
- Automatic project assignment.
- Stage transfer APIs.
- Validation rules.
- Transaction handling.
- Audit/history tracking (if available).
- Permission validation.
- Dashboard aggregation APIs.

---

# 14. Testing Checklist

## Automatic Workflow

- Project automatically enters Tender Dashboard when Project Stage = Tender.
- Initial Tender Sub-Stage is set to **NIT Published**.

## Dashboard

- KPI cards display correct project counts.
- Clicking a KPI card displays only projects from that selected Tender Sub-Stage.
- Dashboard updates immediately after stage transfers.

## Stage Management

- Transfer to next stage.
- Transfer to previous stage.
- Multiple project transfer.
- Boundary validation (first and last stage).

## Input Sheet

- Construction remains disabled before Tender completion.
- O&M remains disabled until eligible.
- Stages become available only after successful workflow progression.

## Security

- Validate permissions for stage transfers.
- Prevent unauthorized API manipulation.
- Verify backend enforcement of workflow rules.

## Regression Testing

Ensure all existing Project Management, Dashboard, Reporting, and User Management functionality continues to work without regression.