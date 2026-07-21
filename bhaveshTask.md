Objective:
Improve the mobile navigation by relocating all desktop top navbar action buttons into the mobile sidebar. All sidebar content should scroll together as a single container.

Requirements

1. Move Desktop Top Navigation Items
    * Remove the separate top action bar from the mobile view.
    * Append all desktop top navbar actions to the bottom of the mobile sidebar in a separate section.
    * Include the following items:
        * Input Sheet
        * MD Portfolio Briefing
        * MoM
        * O&M
        * KPI Guide
        * Audit Trail
        * Users
2. Create a Separate Sidebar Section
    * Add a section below the existing navigation menu (Overview, Sectors, Schemes, Projects, etc.).
    * Add a section title such as “Quick Actions” or “Management Tools”.
    * Preserve the existing icons, labels, styling, and click functionality for each action.
3. Single Scrollable Sidebar
    * The entire sidebar (navigation items + Quick Actions section) must be contained within one scrollable container.
    * When the user scrolls, both sections should scroll together seamlessly.
    * Do not create independent scroll areas for different sections.
4. Maintain Existing Functionality
    * Clicking any action should behave exactly as it does in the desktop version.
    * Do not change routes, permissions, or business logic.
    * Preserve active/selected states.
5. Responsive Behaviour
    * Desktop & Tablet: Keep the existing top navbar unchanged.
    * Mobile: Hide the desktop action bar and display these actions only inside the sidebar.
6. Sidebar Layout
    * Existing navigation menu appears first.
    * Divider or spacing.
    * Quick Actions section containing all top navbar buttons.
    * Entire sidebar remains responsive and easy to navigate.

Acceptance Criteria

* ✅ Desktop layout remains unchanged.
* ✅ Mobile top navbar contains only the logo and hamburger menu.
* ✅ All desktop action buttons appear at the bottom of the mobile sidebar.
* ✅ Navigation items and Quick Actions scroll together as a single scrollable list.
* ✅ No nested scrolling or overflow issues.
* ✅ Icons, labels, active states, and navigation functionality remain intact.
* ✅ Sidebar is fully responsive and works smoothly on all mobile screen sizes.