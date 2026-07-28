Tasks

Analyze the existing Download/Export implementation in both:

MD Portfolio Briefing
Projects page (Sidebar)

Understand the current dropdown behavior and export implementation before making any changes.

Improve the Download/Export dropdown to provide a more user-friendly experience across both modules.
Update the dropdown behavior so that:
Clicking the Download/Export button opens the dropdown.
Clicking anywhere outside the dropdown automatically closes it.
The dropdown closes automatically when an export option is selected.
The current requirement of clicking the same button again to close the dropdown is removed.
Apply the improved dropdown behavior consistently in:
MD Portfolio Briefing
Projects page (Sidebar)
Do not modify the existing PDF, Excel, or PowerPoint export formats in the Projects page (Sidebar). The enhancement in the Projects page should be limited to improving the Download/Export dropdown behavior only. The content, layout, formatting, and structure of all exported files must remain exactly as they are currently implemented.
In the MD Portfolio Briefing, update the PDF export layout so that the project details are displayed in the same block/card-based format as shown on the dashboard.
In the MD Portfolio Briefing, update the PowerPoint (PPT) export to follow the same block/card-based layout as the dashboard, maintaining consistency with the PDF export.
Ensure that both the PDF and PowerPoint (PPT) exports in the MD Portfolio Briefing accurately reflect the currently selected project and include only the currently selected (ticked) fields from the Fields filter.
Maintain a clean, professional, and readable layout in both export formats, using additional pages or slides where necessary to accommodate all project details without truncation or data loss.
Perform comprehensive testing to verify that:
The dropdown behaves correctly in all supported scenarios.
Clicking outside the dropdown closes it as expected.
PDF and PowerPoint exports in the MD Portfolio Briefing are generated successfully using the updated block/card-based layout.
The Projects page export formats (PDF, Excel, and PowerPoint) remain unchanged.
Existing filtering, field selection, export functionality, navigation, UI behavior, APIs, business logic, database operations, performance, and user workflows continue to function correctly.
No existing functionality, business logic, UI behavior, application flow, or any other feature is affected or changed by this implementation.