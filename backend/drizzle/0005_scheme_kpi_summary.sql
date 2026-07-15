-- v_scheme_kpi_summary — one row per scheme with every aggregate the
-- MD Login popup's left-side KPI panel needs (spec §6). Supersedes
-- v_scheme_summary + v_scheme_chart for surfaces that want the full
-- picture; the older two views remain in place for existing Schemes-tab
-- callers.
--
-- Physical progress uses v_project_effective_physical (milestone-weighted
-- when available, plain field otherwise) to match the accuracy of
-- v_scheme_chart rather than reading project.physical_progress_pct raw.

CREATE OR REPLACE VIEW v_scheme_kpi_summary AS
SELECT
  s.scheme_id,
  s.scheme_name,
  COUNT(ps.project_id)                                                                          AS total,
  COUNT(*) FILTER (WHERE p.status = 'Completed')                                                AS completed,
  COUNT(*) FILTER (WHERE p.status = 'In Progress')                                              AS in_progress,
  COUNT(*) FILTER (WHERE p.status = 'Delayed')                                                  AS delayed,
  COUNT(*) FILTER (WHERE p.status = 'On Hold')                                                  AS on_hold,
  COUNT(*) FILTER (WHERE p.status = 'Not Started')                                              AS not_started,
  COALESCE(ROUND(AVG(ep.physical_progress_pct) FILTER (WHERE ps.project_id IS NOT NULL), 1), 0) AS avg_physical_pct,
  COALESCE(ROUND(AVG(p.financial_progress_pct) FILTER (WHERE ps.project_id IS NOT NULL), 1), 0) AS avg_financial_pct,
  COALESCE(SUM(p.aa_amount_cr), 0) :: NUMERIC(14, 2)                                            AS total_aa_cr,
  COALESCE(SUM(p.financial_progress_cr), 0) :: NUMERIC(14, 2)                                   AS total_financial_cr,
  COALESCE(ROUND(
    SUM(COALESCE(p.financial_progress_cr,0)) / NULLIF(SUM(COALESCE(p.aa_amount_cr,0)),0) * 100
  , 1), 0)                                                                                       AS financial_utilisation_pct
FROM scheme s
LEFT JOIN project_scheme ps                ON ps.scheme_id = s.scheme_id
LEFT JOIN project p                        ON p.project_id  = ps.project_id
LEFT JOIN v_project_effective_physical ep  ON ep.project_id = p.project_id
GROUP BY s.scheme_id, s.scheme_name;
