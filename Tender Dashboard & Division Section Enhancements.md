# Tender Dashboard & Division Section Enhancements

## Objective

Implement the following UI and functionality updates in the **Tender Dashboard** and **Division** sections.

Follow the existing application architecture, UI design system, permissions, and data flow. Do not modify unrelated functionality.

---

# 1. Tender Dashboard – Project Stages

## 1.1 Add Remark Column

Navigate to:

**Tender Dashboard → Project Stages**

Add a new **Remark** column to the project table for **every Tender Sub-Stage**.

The column must be available in the project list regardless of which Tender Sub-Stage is currently selected.

### Tender Sub-Stages

The existing Tender workflow contains:

1. NIT Published
2. Bid Submission (Open)
3. Technical Evaluation
4. Financial Evaluation
5. Approval Process
6. LoA Issued
7. Agreement Signing
8. Work Order Issued

Each of these stages must contain the **Remark** column in its project table.

---

## 1.2 Purpose of Remark

The Remark field should explain **why a project is stuck or delayed at its current Tender Sub-Stage**.

Examples:

* Technical documents pending.
* Financial approval awaited.
* Bid clarification required.
* Approval from competent authority pending.
* Contractor documentation incomplete.

Do not hard-code these examples as selectable values unless the existing application already uses such a mechanism.

The remark should be project-specific.

---

## 1.3 Remark Behavior

Determine the implementation based on the existing project/tender data model.

### Requirements

* Each project should have its own remark for the current Tender Sub-Stage.
* Remark must remain associated with the appropriate project and stage.
* When a project moves to another Tender Sub-Stage, the remark should be handled according to the existing workflow/history architecture.
* Do not overwrite historical remarks if the application already maintains stage history.
* If the existing database structure does not support stage-specific remarks, **stop and ask before deciding how historical remarks should be stored**.

### Important

Do not assume whether the remark should be:

* Free-text,
* Dropdown-based,
* Mandatory,
* Optional,
* Editable by all users,
* Editable only by specific roles.

**Ask for clarification if the existing requirements or architecture do not define these behaviors.**

---

# 2. Division Section

## 2.1 Remove Card

In the **Division** section, remove the following card:

**Divisions with Projects**

The card should no longer appear in the Division section.

Do not remove any underlying API or database logic if it is still being used elsewhere.

---

# 3. Division Section – Remaining Cards

Keep the following existing cards:

* Total Projects
* Completed
* Delayed

---

## 3.1 Make Cards Clickable

Make each of the following cards clickable:

### Total Projects

On clicking the card:

* Display the corresponding project data below the cards.
* Show projects associated with the selected division/context.

### Completed

On clicking the card:

* Display the corresponding completed project data below the cards.
* Apply the appropriate existing completion/status filter.

### Delayed

On clicking the card:

* Display the corresponding delayed project data below the cards.
* Apply the appropriate existing delayed/status filter.

---

# 4. Card Interaction

Use a consistent interaction pattern for all three cards.

Expected behavior:

```text
Division Section
      │
      ├── Total Projects
      ├── Completed
      └── Delayed
              │
              ▼
        User clicks card
              │
              ▼
      Project data appears below
              │
              ▼
      Data filtered according
      to selected card
```

### Requirements

* Only the relevant project data should be displayed.
* Preserve existing division-level filtering.
* Do not display projects from unrelated divisions.
* Maintain existing pagination, sorting, search, and filtering functionality if already available.
* Clearly indicate which card/filter is currently active.

---

# 5. UI Requirements

* Maintain the existing design system.
* Preserve existing card styling.
* Add a clear clickable/hover state to the three remaining cards.
* Keep the project data section visually separated from the KPI cards.
* Maintain responsive behavior.
* Reuse existing table and card components wherever possible.
* Do not redesign unrelated parts of the Division section.

---

# 6. Backend & Data Requirements

Before introducing new APIs or database structures:

1. Inspect the existing project, Tender, Division, and stage-related data models.
2. Reuse existing fields and APIs wherever possible.
3. Only introduce new database fields/API endpoints when required.

For the Remark functionality, verify whether the existing schema already supports stage-specific remarks.

If it does not:

**Stop and ask for clarification before creating the database structure.**

---

# 7. Permissions

Follow the existing RBAC and user-permission system.

Do not introduce new permissions without confirmation.

For Remark editing, if the existing permission model does not clearly determine which roles can edit remarks:

**Ask before implementing the permission behavior.**

---

# 8. Testing Checklist

## Tender Dashboard

* [ ] Remark column appears in NIT Published.
* [ ] Remark column appears in Bid Submission (Open).
* [ ] Remark column appears in Technical Evaluation.
* [ ] Remark column appears in Financial Evaluation.
* [ ] Remark column appears in Approval Process.
* [ ] Remark column appears in LoA Issued.
* [ ] Remark column appears in Agreement Signing.
* [ ] Remark column appears in Work Order Issued.
* [ ] Remark is associated with the correct project.
* [ ] Remark is associated with the correct Tender Sub-Stage.

## Division Section

* [ ] Divisions with Projects card is removed.
* [ ] Total Projects card remains.
* [ ] Completed card remains.
* [ ] Delayed card remains.
* [ ] Total Projects card is clickable.
* [ ] Completed card is clickable.
* [ ] Delayed card is clickable.
* [ ] Clicking each card displays the appropriate project data.
* [ ] Existing division-level filtering remains functional.

## Regression Testing

* [ ] Existing Tender stage transfer functionality continues to work.
* [ ] Existing project filtering continues to work.
* [ ] Existing RBAC behavior remains unchanged.
* [ ] No unrelated dashboard functionality is affected.

---

# Implementation Rules

Follow these instructions strictly:

1. **Do not hallucinate.**
2. **Do not assume missing requirements.**
3. **Inspect the existing implementation before making architectural changes.**
4. **Reuse existing components, APIs, database fields, and patterns wherever possible.**
5. **Proceed phase by phase.**
6. **Ask before assuming.**
7. If a requirement cannot be implemented safely without deciding an unspecified behavior, **stop and ask for clarification instead of making an assumption.**
8. Do not modify unrelated functionality.
9. Preserve existing UI/UX and responsive behavior.
10. Complete testing for each phase before moving to the next phase.
