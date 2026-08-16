-- Retire the standalone_management_action table.
--
-- Introduced in 0011 when the Management Action flow was briefly meant to
-- be project-independent. Per Management-action-Remarks-Enhancements.md
-- §1, Management Actions must be project-associated (Add flow now requires
-- a Project selection). management_action_item covers every use case, so
-- the standalone table is dead code.
--
-- Any test rows that lived here are dropped. Confirmed with the user
-- before applying.

DROP TABLE IF EXISTS standalone_management_action;
