# Overview Page & Active Project Enhancements

## Objective

Modify the **Overview Page** by removing the specified KPI cards and replacing them with new KPI cards.

Also update the **Active Project – Current Stage** interaction so that clicking the **Concept** stage opens the Project Register with the appropriate stage filter applied.

---

# 1. Overview Page – KPI Cards

## 1.1 Remove Existing Cards

Remove the following cards from the Overview Page:

- Total Agreement
- Total Financials
- Financial Utilization
- Avg Financial Progress
- Avg Physical Progress

### Requirements

- Remove these cards from the UI.
- Remove their associated calculations/API calls only if they are no longer used anywhere else.
- Do not remove backend fields or APIs that are still required by other modules.
- Preserve the existing card layout and spacing.

---

# 2. Add New KPI Cards

Add the following cards to the Overview Page:

1. **Total Sanctioned**
2. **Total Expenditure**
3. **Work Contract**
4. **Service Contract**

---

## 2.1 Total Sanctioned

Display the total sanctioned amount across the applicable projects.

### Requirements

- Use the existing sanctioned amount data source if available.
- Do not create a new calculation if an existing backend/API calculation already provides the required value.
- Format the amount consistently with existing financial KPI cards.

---

## 2.2 Total Expenditure

Display the total expenditure across the applicable projects.

### Requirements

- Use the existing expenditure data source if available.
- Follow the existing financial amount formatting.
- Ensure the value is calculated consistently with the application's existing financial logic.

---

## 2.3 Work Contract

Display the number of projects having:

```text
Contract Type = Work Contract