-- Add per-scheme money aggregates to v_scheme_chart so the Schemes page
-- can render an "Alloted / Spent / Utilisation" strip per card.
--
-- Alloted = SUM(agreement_amount_cr)  (per the user's answer to the design question)
-- Spent   = SUM(financial_progress_cr)
--
-- The nullable numerics coalesce to 0 so cards with schemes containing
-- projects that never had these fields set still render a valid figure.

CREATE OR REPLACE VIEW v_scheme_chart AS
SELECT
  s.scheme_id,
  s.scheme_name,
  COUNT(ps.project_id)                                                              AS project_count,
  COALESCE(ROUND(AVG(ep.physical_progress_pct) FILTER (WHERE ps.project_id IS NOT NULL), 1), 0)  AS avg_physical_pct,
  COALESCE(ROUND(AVG(p.financial_progress_pct) FILTER (WHERE ps.project_id IS NOT NULL), 1), 0)  AS avg_financial_pct,
  COALESCE(SUM(p.agreement_amount_cr),  0) :: NUMERIC(14, 2)                        AS total_agreement_cr,
  COALESCE(SUM(p.financial_progress_cr), 0) :: NUMERIC(14, 2)                       AS total_financial_cr
FROM scheme s
LEFT JOIN project_scheme ps ON ps.scheme_id = s.scheme_id
LEFT JOIN project p ON p.project_id = ps.project_id
LEFT JOIN v_project_effective_physical ep ON ep.project_id = p.project_id
GROUP BY s.scheme_id, s.scheme_name;
