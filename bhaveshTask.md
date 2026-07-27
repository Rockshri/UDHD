Task 1: Add Back Navigation to the Forgot Password Flow
In the Forgot Password workflow, after the user proceeds to the OTP Verification page (where the verification code is entered), provide a Back option.
The Back action should navigate the user to the previous step where they entered their Username / Employee ID.
Preserve any previously entered username so the user does not need to re-enter it.
Ensure the back navigation does not interrupt or reset the forgot password flow unless explicitly required.
Do not affect the existing authentication, OTP generation, verification process, or any other functionality.
Task 2: Implement Role-Based User Deletion
Implement role-based user deletion according to the existing RBAC hierarchy.
In the Users module, after logging into the dashboard, navigate to the user listing.
Under the Action column, clicking Edit should display a Delete button.
The Delete button must only be visible and functional for users who have permission to delete based on the role hierarchy.
Enforce the following deletion permissions:
MD can delete Admin, PD, and Viewer users.
Admin can delete PD and Viewer users.
PD can delete Viewer users.
Users must not be able to delete users of the same role or any higher role.
Enforce the same permission checks on both the frontend and backend to prevent unauthorized deletion.
Display an appropriate confirmation dialog before deleting a user.
After successful deletion, refresh the user list and display a success notification.
Display an appropriate error message if the user does not have permission to perform the deletion.
Development Constraints
Analyze the existing authentication, forgot password flow, RBAC implementation, and user management module before making any changes.
Preserve the existing architecture, UI design, routing, authentication, authorization, APIs, and all current functionality.
Make only the minimum necessary changes required to implement these features.
Reuse existing components, services, middleware, and role-based authorization wherever possible.
Do not rename files, functions, variables, routes, database models, or modify unrelated code.
Ensure all existing features continue to work without regression.
Do not hallucinate or assume implementation details. If any requirement is unclear or any existing logic conflicts with these changes, analyze the codebase and ask for clarification before proceeding.