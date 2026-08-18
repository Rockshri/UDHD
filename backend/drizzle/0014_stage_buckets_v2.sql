-- v_stage_buckets was reading from the legacy project.project_stage column
-- (US spelling: 'Conceptualization'). Since Phase A the source of truth is
-- project.project_stage_v2 (British spelling: 'Conceptualisation'). The old
-- view returned stale counts — often zero on new projects — which the
-- Overview page's "Active Projects — Current Stage" tiles surfaced as
-- wrong numbers.
--
-- This recreates the view against project_stage_v2. Same 5 pipeline
-- buckets as before (Concept → Pre-Tender → Tender → Construction → O&M);
-- Design + Other are intentionally NOT bucketed here because the tile
-- layout is a 5-stage pipeline metaphor. Projects in those stages will
-- simply not contribute to any tile — surface them elsewhere if needed.
--
-- Tender bucket keeps its work-type fallback so legacy rows tagged
-- 'Tender Work' / 'Tender Service' still land in the Tender tile.

CREATE OR REPLACE VIEW v_stage_buckets AS
SELECT stage,
       COUNT(*)                                    AS project_count,
       ROUND(SUM(COALESCE(aa_amount_cr, 0)), 2)     AS total_aa_cr
FROM (
  SELECT project_id, aa_amount_cr, 'Conceptualization' AS stage
    FROM project WHERE project_stage_v2 = 'Conceptualisation'
  UNION ALL
  SELECT project_id, aa_amount_cr, 'Pre-Tender'
    FROM project WHERE project_stage_v2 = 'Pre-Tender'
  UNION ALL
  SELECT project_id, aa_amount_cr, 'Tender'
    FROM project WHERE project_stage_v2 = 'Tender'
                    OR work_type IN ('Tender Work', 'Tender Service')
  UNION ALL
  SELECT project_id, aa_amount_cr, 'Construction'
    FROM project WHERE project_stage_v2 = 'Construction'
  UNION ALL
  SELECT project_id, aa_amount_cr, 'O&M'
    FROM project WHERE project_stage_v2 = 'O&M'
) buckets
GROUP BY stage;
