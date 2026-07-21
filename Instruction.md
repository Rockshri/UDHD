# Feature Enhancements & Bug Fixes

## Objective
Implement the following UI enhancements, functional changes, and bug fixes across the application. Ensure all existing functionality remains intact and no regressions are introduced.

---

# 1. Project Navigation – Add One Pager Popout

## Requirement
In the **Project** section of the left navigation panel, implement the same **One Pager** popout functionality that currently exists in the **Scheme** section.

### Current Behavior
- The **Scheme** section allows users to click on any scheme and open a **One Pager** popout.
- The **Project** section does not provide this functionality.

### Expected Behavior
- When a user clicks on any project in the **Project** section of the left navigation panel:
  - Open the **One Pager** popout.
  - The UI, behavior, styling, animations, and user experience should be identical to the existing implementation in the **Scheme** section.
  - Display the selected project's data in the One Pager.

### Acceptance Criteria
- One Pager opens from the Project section.
- Uses the same component and design as the Scheme implementation.
- Loads the correct project data.
- No impact on the existing Scheme functionality.

---

# 2. Input Sheet – Add "ALL Fields" Tab

## Requirement
Create a new tab named **"ALL Fields"** in the Input Sheet.

### Placement
Insert the new tab immediately to the **left of the "Fixed Inputs"** tab.

Example:

```
ALL Fields | Fixed Inputs | Variable Inputs
```

### Functionality
The **ALL Fields** tab should display every input field available from both:

- Fixed Inputs
- Variable Inputs

The fields should be consolidated into a single unified view.

### Requirements
- Include every field from both sections.
- Preserve field labels and existing validations.
- Maintain field order wherever practical.
- Editing a field here should update the corresponding underlying data exactly as it does in the original tabs.
- No duplication or synchronization issues.

### Acceptance Criteria
- New tab is visible.
- Contains all fields from Fixed Inputs.
- Contains all fields from Variable Inputs.
- Data remains synchronized across all tabs.

---

# 3. CoS / EoT Logic Enhancement

## Requirement
Add a **Time Linked** field within the **CoS** section and implement dependency logic between **CoS** and **EoT**.

### New Field
**Field Name**
- Time Linked

**Type**
- Yes / No

### Business Logic

#### Case 1: Time Linked = YES
- CoS and EoT become dependent.
- Any calculations, validations, or updates should treat both sections as linked.
- Changes in one should appropriately affect the other according to existing business rules.

#### Case 2: Time Linked = NO
- CoS and EoT should function independently.
- Updates in one section must not affect the other.

### Acceptance Criteria
- Time Linked field is added to the CoS section.
- Dependency logic behaves correctly.
- Existing workflows continue to function without regression.

---

# 4. Remove Deprecated Field

## Requirement
Remove the following field from the Input Sheet.

### Location
```
Input Sheet
    → Phases and Dates
```

### Field to Remove
```
EXPECTED COMPLETION (RAW TEXT)
```

### Requirements
- Remove the field from the UI.
- Remove associated validations, if any.
- Remove unused references if no longer required.
- Ensure existing calculations continue to work correctly after removal.

### Acceptance Criteria
- Field no longer appears in the UI.
- No broken references or runtime errors.
- Existing functionality remains unaffected.

---

# Testing Checklist

## Project One Pager
- [ ] One Pager opens from Project navigation.
- [ ] Correct project data is displayed.
- [ ] UI matches Scheme implementation.
- [ ] Existing Scheme functionality remains unchanged.

## ALL Fields Tab
- [ ] New tab appears before Fixed Inputs.
- [ ] All Fixed Input fields are present.
- [ ] All Variable Input fields are present.
- [ ] Editing values updates the underlying data correctly.
- [ ] No duplicate or missing fields.

## CoS / EoT
- [ ] Time Linked field is visible.
- [ ] YES correctly links CoS and EoT.
- [ ] NO keeps them independent.
- [ ] Existing calculations remain accurate.

## Input Sheet
- [ ] EXPECTED COMPLETION (RAW TEXT) is removed.
- [ ] No UI issues.
- [ ] No console errors.
- [ ] No broken dependencies.

---

# General Requirements

- Preserve existing functionality.
- Do not introduce regressions.
- Maintain responsive UI.
- Follow the existing design system and coding standards.
- Reuse existing components wherever possible.
- Perform regression testing before marking the task as complete.