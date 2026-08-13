Task 1: Analyze the Complete Project Before Implementation
Analyze the entire project end-to-end, including frontend, backend, database, existing workflows, and related project functionality.
Implement all the changes mentioned below without affecting any existing functionality, design, data, permissions, or project-related features.
Make only the necessary changes and ensure existing modules continue to work as expected.
Task 2: Correct Sector Dashboard Data Display
Navigate to Sector from the left-side panel and analyze the current behavior.
Currently, the Sector block and Projects block are displaying the same table data.
Update the functionality so that:
Clicking the Sector block displays sector-specific data in the table.
The table should contain the appropriate sector-level details instead of project-level data.
Clicking the Projects block should continue to display project-related data as it currently does.
Ensure that the existing table design, filters, pagination, and other functionality remain unaffected.
Task 3: Add Import Project and Download Template Functionality
Navigate to Input Sheet → Add New Project.
Beside the existing Create Project button, add two new buttons:
Import Project
Download Template
3.1 Download Template
Use the Excel template provided at:
C:\Users\spine\OneDrive\Desktop\Buidco\UDHD\frontend\src\assets
When the user clicks Download Template, download the provided Excel template directly.
The downloaded template must retain the same structure, headers, formatting, and required fields as the source template.
Do not create a different template if the provided template can be reused.
3.2 Import Project
Add functionality to upload an Excel file through the Import Project button.
The uploaded Excel file must follow the same structure and format as the Download Template.
Validate the uploaded Excel file before creating any project.
3.3 Mandatory Field Validation
Check all mandatory fields required for creating a project.
Compare the required project fields with the columns/data provided in the uploaded Excel file.
Validate that:
All mandatory columns are present.
Mandatory fields contain valid data.
The uploaded file follows the expected template structure.
Invalid or missing data is clearly identified.
3.4 Project Creation and Database Saving
If all mandatory fields are present and valid:
Process the Excel data.
Create the project(s) using the imported data.
Save the project data into the existing database.
Use the existing project-creation logic wherever possible to avoid duplicate or inconsistent functionality.
If any mandatory field/column is missing or invalid:
Do not create the incomplete project.
Display a clear error message identifying the missing/invalid required field(s).
Clearly inform the user which required fields need to be filled before importing again.
3.5 Import Validation and Existing Functionality
Ensure imported projects follow the same validations, business rules, permissions, and database structure as projects created manually through Create Project.
Handle Excel upload errors gracefully.
Prevent duplicate or partial project creation if the import fails validation.
Ensure existing Create Project, Input Sheet, project listing, filtering, downloading, and other application functionality is not affected.
Test the complete flow from Download Template → Fill Excel → Import Project → Validate → Create Project → Save to Database → Display Project.