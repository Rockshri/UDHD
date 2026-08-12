# Project Import & Export Enhancement

## Objective

Improve the Project Management module by introducing **bulk project import** and **export** capabilities to eliminate the need for manual project entry through the Input Sheet. The existing Input Sheet functionality should remain unchanged while providing an additional, more efficient workflow for bulk operations.

The implementation should be carried out **phase by phase**, without making assumptions, and any missing information should be requested before implementation.

---

# Scope

This enhancement includes:

- Bulk project import through Excel.
- Project export in multiple formats.
- Scheme-wise export functionality.
- Multi-project selection for export.
- UI updates.
- Navigation cleanup.

---

# 1. Bulk Project Import

## Objective

Manual project creation using the Input Sheet is time-consuming for large datasets.

Provide an additional option to import projects in bulk using an Excel file.

**Important:**

The existing **Input Sheet must remain available**.

The new import feature should be an **additional option**, not a replacement.

---

## Import Options

Provide a new action:

- Import Projects

This option should allow users to upload an Excel file containing multiple projects.

---

## Excel Template

The import must follow a predefined Excel template.

**Do not assume the Excel structure.**

### Before implementation:

Pause development and ask for the Excel template.

Example request:

> Please provide the Excel template that should be used for project import. I will use that exact structure for validation, column mapping, and data import.

Do not create or infer column mappings without the provided template.

---

## Import Validation

After receiving the template, implement:

- Column validation
- Required field validation
- Data type validation
- Duplicate project detection (where applicable)
- Error reporting for invalid rows
- Successful import summary

Only valid records should be imported.

Invalid rows should be clearly reported to the user.

---

# 2. Preserve Existing Input Sheet

The current Input Sheet must continue to work exactly as it does today.

Requirements:

- No existing functionality should be removed.
- Manual project creation must remain available.
- Import is an additional workflow.

---

# 3. Project Export

Provide the ability to export project data using the same Excel format that is used for import.

Supported export formats:

- Excel (.xlsx)
- PDF
- PowerPoint (.ppt/.pptx)

---

## Export Placement

Place the export options inside the existing **Hamburger Menu**.

Suggested structure:

```text
Export
 ├── Excel
 ├── PDF
 └── PowerPoint
```

Follow the existing application design language.

---

# 4. Excel Export Format

The exported Excel file should match the approved import template.

Requirements:

- Same column order
- Same headers
- Same formatting (where applicable)
- Compatible with the bulk import feature

This ensures users can:

- Export existing projects
- Modify the file
- Re-import it without additional formatting

---

# 5. Scheme-wise Export

Provide the ability to export projects based on a selected Scheme.

Workflow:

1. Select a Scheme.
2. Display all projects under that Scheme.
3. Allow users to select one or multiple projects.
4. Export only the selected projects.

---

## Project Selection

Provide a checkbox for every project.

Capabilities:

- Select individual projects.
- Select multiple projects.
- Select all projects (if supported by the existing table component).

Only the selected projects should be included in the exported file.

---

# 6. Supported Export Formats

The following formats should support project export where technically feasible:

- Excel
- PDF
- PowerPoint

Ensure exported content is structured, readable, and consistent with the application's reporting style.

---

# 7. UI Requirements

- Maintain the existing application design.
- Preserve responsiveness.
- Follow existing spacing, typography, and component styling.
- Reuse existing modal, table, and menu components whenever possible.

---

# 8. Backend Requirements

Update the backend to support:

- Bulk project import
- Excel parsing
- Validation
- Error reporting
- Export generation
- Scheme-wise filtering
- Multi-project export
- Permission validation
- Audit logging (if already supported)

---

# 9. Testing Checklist

## Import

- Upload valid Excel file.
- Upload invalid Excel file.
- Required field validation.
- Duplicate record handling.
- Invalid row reporting.
- Successful import summary.

## Export

- Export all projects.
- Export selected projects.
- Export scheme-wise projects.
- Export to Excel.
- Export to PDF.
- Export to PowerPoint.
- Verify exported Excel matches the approved template.



## Regression Testing

Verify that:

- Existing Input Sheet functionality remains unchanged.
- Existing project creation continues to work.
- Existing dashboards, reports, and workflows continue to function correctly.

---

# Implementation Guidelines

Follow these instructions strictly throughout implementation:

- **Do not hallucinate.**
- **Do not assume missing requirements or data structures.**
- **Proceed phase by phase.**
- **Pause and ask for clarification whenever required information is missing.**
- **Do not implement the Excel import/export until the exact Excel template has been provided.**
- **Reuse existing architecture, coding standards, UI components, and design patterns wherever possible.**
- **Ensure all new functionality is fully integrated without introducing regressions.**