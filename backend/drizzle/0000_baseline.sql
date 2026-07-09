-- ============================================================
-- BUIDCO PROJECT MONITORING DASHBOARD — SCHEMA v7 (baseline)
-- Verbatim from BUIDCO_table.md. The custom migrator wraps this
-- file in a transaction, so BEGIN/COMMIT are intentionally omitted.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- LOOKUP TABLES
-- ============================================================

CREATE TABLE district (
  district_id   SERIAL PRIMARY KEY,
  district_name VARCHAR(60) UNIQUE NOT NULL
);

INSERT INTO district (district_name) VALUES
  ('Araria'),('Arwal'),('Aurangabad'),('Banka'),('Begusarai'),('Bhagalpur'),('Bhojpur'),('Buxar'),
  ('Darbhanga'),('East Champaran'),('Gaya'),('Gopalganj'),('Jamui'),('Jehanabad'),('Kaimur'),
  ('Katihar'),('Khagaria'),('Kishanganj'),('Lakhisarai'),('Madhepura'),('Madhubani'),('Munger'),
  ('Muzaffarpur'),('Nalanda'),('Nawada'),('Patna'),('Purnia'),('Rohtas'),('Saharsa'),('Samastipur'),
  ('Saran'),('Sheikhpura'),('Sheohar'),('Sitamarhi'),('Siwan'),('Supaul'),('Vaishali'),('West Champaran');

CREATE TABLE sector (
  sector_id   SERIAL PRIMARY KEY,
  sector_name VARCHAR(40) UNIQUE NOT NULL
);
INSERT INTO sector (sector_name) VALUES
  ('Crematorium'),('Sewerage'),('SWD'),('Water Supply'),('Others');

CREATE TABLE scheme (
  scheme_id   SERIAL PRIMARY KEY,
  scheme_name VARCHAR(60) UNIQUE NOT NULL
);
INSERT INTO scheme (scheme_name) VALUES
  ('Namami Gange'),('AMRUT 1.0'),('AMRUT 2.0'),('SAAT NISHCHAY'),('STATE FUNDED'),
  ('Pragati Yatra'),('Patna Smart City'),('MMSSVY');

-- ============================================================
-- CORE TABLE: project
-- ============================================================

CREATE TABLE project (
  project_id                   TEXT PRIMARY KEY,
  project_name                 VARCHAR(300) NOT NULL,

  sector_id                    INT REFERENCES sector(sector_id),
  city                         VARCHAR(100),
  district_id                  INT REFERENCES district(district_id),
  contractor                   VARCHAR(200),
  pd                           VARCHAR(120),
  main_work                    TEXT,
  physical_work_progress_note  TEXT,
  project_stage                VARCHAR(20) CHECK (project_stage IN
                                 ('Conceptualization','Pre-Tender','Tender','Construction','O&M')),
  work_type                    VARCHAR(20) CHECK (work_type IN
                                 ('Tender Work','Tender Service','Pre-Monsoon','Construction','Others')),
  sponsoring_dept              VARCHAR(150),
  implementing_agency          VARCHAR(150),
  sanction_date                DATE,
  project_brief                TEXT,

  current_phase                VARCHAR(20) CHECK (current_phase IN
                                 ('Conceptualization','Design','Pre-Tender','Tender','Construction','O&M','Completed')),
  status                       VARCHAR(20) NOT NULL DEFAULT 'Not Started' CHECK (status IN
                                 ('Not Started','In Progress','Completed','On Hold','Delayed')),
  planned_end_date             DATE,
  revised_end_date             DATE,
  delay_reason                 TEXT,
  dept_stuck_at                VARCHAR(150),
  expected_completion_date     DATE,
  expected_completion_raw      TEXT,

  priority                     VARCHAR(6) CHECK (priority IN ('High','Medium','Low','N/A')),
  sanctioned_cost_cr           NUMERIC(12,2),
  aa_amount_cr                 NUMERIC(12,2),
  agreement_amount_cr          NUMERIC(12,2),
  physical_progress_pct        NUMERIC(5,2),
  financial_progress_cr        NUMERIC(12,2),
  financial_progress_pct       NUMERIC(5,2),
  scheduled_progress_pct       NUMERIC(5,2),

  agreement_number             VARCHAR(80),
  agreement_date               DATE,
  appointed_date               DATE,
  contract_value_cr            NUMERIC(12,2),
  mob_advance_issued_cr        NUMERIC(12,2),
  mob_advance_recovered_cr     NUMERIC(12,2),
  advance_outstanding_cr       NUMERIC(12,2),
  retention_money_held_cr      NUMERIC(12,2),
  pbg_number                   VARCHAR(80),
  pbg_amount_cr                NUMERIC(12,2),
  pbg_expiry_date              DATE,
  pbg_issuing_bank             VARCHAR(120),
  emd_amount_cr                NUMERIC(12,2),
  emd_ref_number               VARCHAR(80),
  emd_date                     DATE,
  total_payments_cr            NUMERIC(12,2),
  last_payment_date            DATE,
  last_ra_bill_no              VARCHAR(60),

  geo_tagging_url              TEXT,

  remark                       TEXT,
  management_action_legacy     TEXT,

  om_applicable                BOOLEAN DEFAULT FALSE,
  om_start_date                DATE,
  om_period_months             NUMERIC(5,1),
  om_end_date                  DATE,
  om_agency                    VARCHAR(150),
  om_status_override           VARCHAR(20) CHECK (om_status_override IN
                                 ('Not Started','Ongoing','Expiring Soon','Expired','Handed Over to ULB')),
  om_remarks                   TEXT,

  mpr_month                    VARCHAR(20),
  fund_received_cr             NUMERIC(12,2),
  expenditure_central_raw      TEXT,
  expenditure_state_raw        TEXT,
  manpower_engaged_raw         TEXT,
  main_component_scope         TEXT,
  progress_prev_month_raw      TEXT,
  progress_this_month_raw      TEXT,
  mpr_remark                   TEXT,

  cos_eot_type                 VARCHAR(50),
  cos_eot_status               VARCHAR(50),
  cos_eot_date                 DATE,
  cos_eot_remark               TEXT,

  last_updated                 TIMESTAMPTZ,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- MILESTONE-WEIGHTED PHYSICAL PROGRESS
-- ============================================================

CREATE TABLE project_milestone (
  milestone_id    SERIAL PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES project(project_id) ON DELETE CASCADE,
  milestone_name  VARCHAR(200) NOT NULL,
  weight_pct      NUMERIC(5,2) NOT NULL CHECK (weight_pct > 0 AND weight_pct <= 100),
  planned_date    DATE,
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (project_id, milestone_name)
);

CREATE TABLE milestone_progress (
  mp_id                  SERIAL PRIMARY KEY,
  milestone_id           INT NOT NULL REFERENCES project_milestone(milestone_id) ON DELETE CASCADE,
  project_id             TEXT NOT NULL REFERENCES project(project_id) ON DELETE CASCADE,
  snap_month             DATE NOT NULL,
  progress_pct           NUMERIC(5,2) NOT NULL CHECK (progress_pct BETWEEN 0 AND 100),
  weighted_contribution  NUMERIC(6,3),
  note                   TEXT,
  created_at             TIMESTAMPTZ DEFAULT now(),
  UNIQUE (milestone_id, snap_month)
);

-- ============================================================
-- CHILD TABLES
-- ============================================================

CREATE TABLE project_scheme (
  project_id  TEXT REFERENCES project(project_id) ON DELETE CASCADE,
  scheme_id   INT  REFERENCES scheme(scheme_id),
  PRIMARY KEY (project_id, scheme_id)
);

CREATE TABLE cos_eot_item (
  cos_id             SERIAL PRIMARY KEY,
  project_id         TEXT NOT NULL REFERENCES project(project_id) ON DELETE CASCADE,
  cos_number         VARCHAR(20),
  cos_date           DATE,
  category           VARCHAR(30) CHECK (category IN
                       ('SCOPE ADDITION','SCOPE DELETION','DESIGN CHANGE','QUANTITY VARIATION','OTHERS')),
  cos_amount_cr      NUMERIC(12,2),
  variation_pct      NUMERIC(6,2),
  eot_number         VARCHAR(20),
  eot_days_granted   INT DEFAULT 0,
  time_linked        BOOLEAN DEFAULT FALSE,
  original_end_date  DATE,
  new_end_date       DATE,
  revised_date       DATE,
  created_at         TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE management_action_item (
  item_id        SERIAL PRIMARY KEY,
  project_id     TEXT NOT NULL REFERENCES project(project_id) ON DELETE CASCADE,
  topic          TEXT NOT NULL,
  status         VARCHAR(10) NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','Closed')),
  deadline_date  DATE,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE geo_photo (
  photo_id     SERIAL PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES project(project_id) ON DELETE CASCADE,
  url          TEXT NOT NULL,
  caption      TEXT,
  photo_date   DATE,
  source_type  VARCHAR(10) CHECK (source_type IN ('url','file')),
  file_name    VARCHAR(200)
);

-- ============================================================
-- STANDALONE FEATURE TABLES
-- ============================================================

CREATE TABLE pre_monsoon_item (
  item_id        SERIAL PRIMARY KEY,
  topic          TEXT NOT NULL,
  priority       VARCHAR(6) CHECK (priority IN ('High','Medium','Low','N/A')),
  deadline_date  DATE,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE minutes_of_meeting (
  mom_id         SERIAL PRIMARY KEY,
  meeting_date   DATE NOT NULL,
  meeting_title  VARCHAR(200) NOT NULL,
  venue          VARCHAR(150),
  chairperson    VARCHAR(120),
  attendees      TEXT,
  project_id     TEXT REFERENCES project(project_id),
  agenda         TEXT,
  decisions      TEXT,
  mom_status     VARCHAR(20) NOT NULL DEFAULT 'Action Pending' CHECK (mom_status IN
                   ('Action Pending','In Progress','Resolved','Deferred')),
  remarks        TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE mom_action_point (
  action_id        SERIAL PRIMARY KEY,
  mom_id           INT NOT NULL REFERENCES minutes_of_meeting(mom_id) ON DELETE CASCADE,
  description      TEXT NOT NULL,
  owner            VARCHAR(120),
  due_date         DATE,
  status           VARCHAR(10) NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','Closed')),
  resolution_date  DATE
);

-- ============================================================
-- AUTH & AUDIT
-- ============================================================

CREATE TABLE app_user (
  user_id         SERIAL PRIMARY KEY,
  username        VARCHAR(60) UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  full_name       VARCHAR(120),
  role            VARCHAR(10) NOT NULL CHECK (role IN ('MD','Admin','Viewer')),
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  last_login      TIMESTAMPTZ
);

CREATE TABLE audit_log (
  audit_id                INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id              TEXT REFERENCES project(project_id),
  user_id                 INT REFERENCES app_user(user_id),
  user_label              VARCHAR(120) NOT NULL,
  role_label              VARCHAR(20),
  action                  VARCHAR(10) NOT NULL CHECK (action IN ('Created','Updated','Deleted')),
  project_name_snapshot   VARCHAR(300),
  changed_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_log_change (
  change_id     SERIAL PRIMARY KEY,
  audit_id      INT NOT NULL REFERENCES audit_log(audit_id) ON DELETE CASCADE,
  field_key     VARCHAR(60) NOT NULL,
  field_label   VARCHAR(120),
  before_value  TEXT,
  after_value   TEXT
);

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION fn_touch_last_updated()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_project_touch
BEFORE UPDATE ON project
FOR EACH ROW EXECUTE FUNCTION fn_touch_last_updated();

CREATE OR REPLACE FUNCTION fn_check_milestone_weights()
RETURNS TRIGGER AS $$
DECLARE
  v_project  TEXT := COALESCE(NEW.project_id, OLD.project_id);
  v_sum      NUMERIC;
BEGIN
  SELECT COALESCE(SUM(weight_pct), 0) INTO v_sum
    FROM project_milestone WHERE project_id = v_project;

  IF v_sum > 0 AND ABS(v_sum - 100) > 0.5 THEN
    RAISE EXCEPTION 'Milestone weights for project % must sum to 100 (currently %)', v_project, v_sum;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_check_milestone_weights
AFTER INSERT OR UPDATE OR DELETE ON project_milestone
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION fn_check_milestone_weights();

CREATE OR REPLACE FUNCTION fn_milestone_weighted_contribution()
RETURNS TRIGGER AS $$
DECLARE
  v_weight NUMERIC(5,2);
BEGIN
  SELECT weight_pct INTO v_weight
    FROM project_milestone WHERE milestone_id = NEW.milestone_id;
  NEW.weighted_contribution := ROUND(NEW.progress_pct * v_weight / 100, 3);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_milestone_weighted
BEFORE INSERT OR UPDATE ON milestone_progress
FOR EACH ROW EXECUTE FUNCTION fn_milestone_weighted_contribution();

-- ============================================================
-- MILESTONE / PHYSICAL-PROGRESS VIEWS
-- ============================================================

CREATE OR REPLACE VIEW v_milestone_history AS
SELECT
  mp.project_id,
  pm.milestone_id,
  pm.milestone_name,
  pm.weight_pct,
  mp.snap_month,
  mp.progress_pct,
  mp.weighted_contribution
FROM milestone_progress mp
JOIN project_milestone pm ON pm.milestone_id = mp.milestone_id
ORDER BY mp.project_id, pm.sort_order, mp.snap_month;

CREATE OR REPLACE VIEW v_project_physical_history AS
SELECT
  project_id,
  snap_month,
  ROUND(SUM(weighted_contribution), 2) AS weighted_physical_pct
FROM milestone_progress
GROUP BY project_id, snap_month
ORDER BY project_id, snap_month;

CREATE OR REPLACE VIEW v_project_physical_rollup AS
SELECT DISTINCT ON (project_id)
  project_id,
  snap_month              AS latest_month,
  weighted_physical_pct
FROM v_project_physical_history
ORDER BY project_id, snap_month DESC;

CREATE OR REPLACE VIEW v_project_effective_physical AS
SELECT
  p.project_id,
  COALESCE(r.weighted_physical_pct, p.physical_progress_pct, 0) AS physical_progress_pct,
  (r.weighted_physical_pct IS NOT NULL)                         AS is_milestone_weighted,
  r.latest_month
FROM project p
LEFT JOIN v_project_physical_rollup r ON r.project_id = p.project_id;

-- ============================================================
-- KPI & CHART VIEWS
-- ============================================================

CREATE OR REPLACE VIEW v_overview_kpis AS
SELECT
  COUNT(*)                                                          AS total,
  COUNT(*) FILTER (WHERE p.status = 'Completed')                    AS completed,
  COUNT(*) FILTER (WHERE p.status = 'In Progress')                  AS in_progress,
  COUNT(*) FILTER (WHERE p.status = 'Delayed')                      AS delayed,
  COUNT(*) FILTER (WHERE p.status = 'On Hold')                      AS on_hold,
  COUNT(*) FILTER (WHERE p.status = 'Not Started')                  AS not_started,
  ROUND(SUM(COALESCE(p.aa_amount_cr,0)), 2)                         AS total_aa_cr,
  ROUND(SUM(COALESCE(p.agreement_amount_cr,0)), 2)                  AS total_agreement_cr,
  ROUND(SUM(COALESCE(p.financial_progress_cr,0)), 2)                AS total_financial_cr,
  ROUND(SUM(ep.physical_progress_pct)  / NULLIF(COUNT(*),0), 1)     AS avg_physical_pct,
  ROUND(SUM(COALESCE(p.financial_progress_pct,0)) / NULLIF(COUNT(*),0), 1) AS avg_financial_pct,
  ROUND(
    SUM(COALESCE(p.financial_progress_cr,0)) / NULLIF(SUM(COALESCE(p.aa_amount_cr,0)),0) * 100
  , 1)                                                               AS financial_utilisation_pct
FROM project p
JOIN v_project_effective_physical ep ON ep.project_id = p.project_id;

CREATE OR REPLACE VIEW v_schedule_vs_actual AS
SELECT
  (SELECT avg_physical_pct FROM v_overview_kpis)                                     AS avg_actual_pct,
  ROUND(AVG(scheduled_progress_pct) FILTER (WHERE scheduled_progress_pct > 0), 1)     AS avg_scheduled_pct_raw,
  COUNT(*) FILTER (WHERE scheduled_progress_pct > 0)                                  AS projects_with_schedule,
  COALESCE(
    ROUND(AVG(scheduled_progress_pct) FILTER (WHERE scheduled_progress_pct > 0), 1),
    (SELECT avg_physical_pct FROM v_overview_kpis)
  )                                                                                    AS avg_scheduled_pct_effective
FROM project;

CREATE OR REPLACE VIEW v_stage_buckets AS
SELECT stage,
       COUNT(*)                                     AS project_count,
       ROUND(SUM(COALESCE(aa_amount_cr,0)), 2)       AS total_aa_cr
FROM (
  SELECT project_id, aa_amount_cr, 'Conceptualization' AS stage FROM project WHERE project_stage = 'Conceptualization'
  UNION ALL
  SELECT project_id, aa_amount_cr, 'Pre-Tender'        FROM project WHERE project_stage = 'Pre-Tender'
  UNION ALL
  SELECT project_id, aa_amount_cr, 'Tender'            FROM project
    WHERE project_stage = 'Tender' OR work_type IN ('Tender Work','Tender Service')
  UNION ALL
  SELECT project_id, aa_amount_cr, 'Construction'      FROM project WHERE project_stage = 'Construction'
  UNION ALL
  SELECT project_id, aa_amount_cr, 'O&M'               FROM project WHERE project_stage = 'O&M'
) buckets
GROUP BY stage;

CREATE OR REPLACE VIEW v_work_type_counts AS
SELECT
  COUNT(*) FILTER (WHERE work_type = 'Tender Work')                            AS tender_works,
  COUNT(*) FILTER (WHERE work_type = 'Tender Service')                         AS tender_services,
  COUNT(*) FILTER (WHERE work_type = 'Pre-Monsoon')                            AS pre_monsoon,
  COUNT(*) FILTER (WHERE work_type = 'Pre-Monsoon' AND priority = 'High')      AS pre_monsoon_critical
FROM project;

CREATE OR REPLACE VIEW v_financial_securities AS
SELECT
  ROUND(SUM(COALESCE(mob_advance_issued_cr,0)), 2)      AS total_mob_advance_cr,
  ROUND(SUM(COALESCE(advance_outstanding_cr,0)), 2)     AS total_advance_outstanding_cr,
  ROUND(SUM(COALESCE(retention_money_held_cr,0)), 2)    AS total_retention_cr,
  ROUND(SUM(COALESCE(pbg_amount_cr,0)), 2)              AS total_pbg_cr,
  ROUND(SUM(COALESCE(emd_amount_cr,0)), 2)              AS total_emd_cr,
  COUNT(*) FILTER (WHERE pbg_expiry_date IS NOT NULL AND pbg_expiry_date < CURRENT_DATE) AS pbg_expired_count
FROM project;

CREATE OR REPLACE VIEW v_pbg_expiry_alerts AS
SELECT project_id, project_name, district_id, city, pbg_expiry_date,
       (pbg_expiry_date - CURRENT_DATE) AS days_left
FROM project
WHERE pbg_expiry_date IS NOT NULL
  AND (pbg_expiry_date - CURRENT_DATE) BETWEEN 0 AND 30
ORDER BY days_left;

CREATE OR REPLACE VIEW v_om_status AS
SELECT
  p.project_id, p.project_name, p.om_agency,
  p.om_start_date AS start_date,
  COALESCE(p.om_end_date, p.om_start_date + (p.om_period_months || ' months')::INTERVAL) AS end_date,
  GREATEST(1, (COALESCE(p.om_end_date, p.om_start_date + (p.om_period_months || ' months')::INTERVAL)::DATE
               - p.om_start_date))                                                        AS total_days,
  GREATEST(0, CURRENT_DATE - p.om_start_date)                                              AS elapsed_days,
  (COALESCE(p.om_end_date, p.om_start_date + (p.om_period_months || ' months')::INTERVAL)::DATE
   - CURRENT_DATE)                                                                          AS days_left,
  LEAST(100, GREATEST(0, ROUND(
    GREATEST(0, CURRENT_DATE - p.om_start_date)::NUMERIC
    / NULLIF(GREATEST(1, (COALESCE(p.om_end_date, p.om_start_date + (p.om_period_months || ' months')::INTERVAL)::DATE
                          - p.om_start_date)), 0) * 100
  )))                                                                                        AS pct_elapsed,
  COALESCE(
    p.om_status_override,
    CASE
      WHEN CURRENT_DATE < p.om_start_date THEN 'Not Started'
      WHEN (COALESCE(p.om_end_date, p.om_start_date + (p.om_period_months || ' months')::INTERVAL)::DATE
            - CURRENT_DATE) < 0 THEN 'Expired'
      WHEN (COALESCE(p.om_end_date, p.om_start_date + (p.om_period_months || ' months')::INTERVAL)::DATE
            - CURRENT_DATE) <= 30 THEN 'Expiring Soon'
      ELSE 'Ongoing'
    END
  )                                                                                          AS status
FROM project p
WHERE p.status = 'Completed' AND p.om_applicable = TRUE AND p.om_start_date IS NOT NULL;

CREATE OR REPLACE VIEW v_om_expiry_alerts AS
SELECT * FROM v_om_status WHERE status = 'Expiring Soon' ORDER BY days_left;

CREATE OR REPLACE VIEW v_scheme_chart AS
SELECT
  s.scheme_id, s.scheme_name,
  COUNT(ps.project_id)                                                              AS project_count,
  COALESCE(ROUND(AVG(ep.physical_progress_pct) FILTER (WHERE ps.project_id IS NOT NULL), 1), 0)  AS avg_physical_pct,
  COALESCE(ROUND(AVG(p.financial_progress_pct) FILTER (WHERE ps.project_id IS NOT NULL), 1), 0)  AS avg_financial_pct
FROM scheme s
LEFT JOIN project_scheme ps ON ps.scheme_id = s.scheme_id
LEFT JOIN project p ON p.project_id = ps.project_id
LEFT JOIN v_project_effective_physical ep ON ep.project_id = p.project_id
GROUP BY s.scheme_id, s.scheme_name;

CREATE OR REPLACE VIEW v_status_donut AS
SELECT status, COUNT(*) AS project_count
FROM project
GROUP BY status;

CREATE OR REPLACE VIEW v_scheme_summary AS
SELECT s.scheme_id, s.scheme_name,
       COUNT(ps.project_id)                                                     AS total,
       COUNT(*) FILTER (WHERE p.status = 'Completed')                            AS completed,
       COUNT(*) FILTER (WHERE p.status = 'In Progress')                          AS in_progress,
       COUNT(*) FILTER (WHERE p.status = 'Delayed')                              AS delayed
FROM scheme s
LEFT JOIN project_scheme ps ON ps.scheme_id = s.scheme_id
LEFT JOIN project p ON p.project_id = ps.project_id
GROUP BY s.scheme_id, s.scheme_name;

CREATE OR REPLACE VIEW v_sector_summary AS
SELECT sec.sector_id, sec.sector_name,
       COUNT(p.project_id)                                    AS total,
       COUNT(*) FILTER (WHERE p.status = 'Completed')          AS completed,
       COUNT(*) FILTER (WHERE p.status = 'In Progress')        AS in_progress,
       COUNT(*) FILTER (WHERE p.status = 'Delayed')            AS delayed
FROM sector sec
LEFT JOIN project p ON p.sector_id = sec.sector_id
GROUP BY sec.sector_id, sec.sector_name;

CREATE OR REPLACE VIEW v_district_summary AS
SELECT d.district_id, d.district_name,
       COUNT(p.project_id)                                          AS total,
       COUNT(*) FILTER (WHERE p.status = 'Completed')                AS completed,
       COUNT(*) FILTER (WHERE p.status = 'Delayed')                  AS delayed,
       ROUND(COUNT(*) FILTER (WHERE p.status = 'Completed')::NUMERIC
             / NULLIF(COUNT(p.project_id),0) * 100, 0)                AS completion_rate_pct
FROM district d
LEFT JOIN project p ON p.district_id = d.district_id
GROUP BY d.district_id, d.district_name
HAVING COUNT(p.project_id) > 0
ORDER BY total DESC;

CREATE OR REPLACE VIEW v_cos_eot_records AS
SELECT
  c.cos_id, c.project_id, p.project_name, p.sector_id, p.district_id,
  c.cos_number, c.cos_date, c.category, c.cos_amount_cr, c.variation_pct,
  c.eot_number, c.eot_days_granted, c.time_linked,
  c.original_end_date, c.new_end_date, c.revised_date
FROM cos_eot_item c
JOIN project p ON p.project_id = c.project_id
ORDER BY c.cos_date DESC NULLS LAST;

CREATE OR REPLACE VIEW v_project_cos_eot_rollup AS
SELECT
  project_id,
  COUNT(*)                                                       AS cos_count,
  COALESCE(SUM(eot_days_granted), 0)                             AS total_eot_days,
  MAX(COALESCE(revised_date, new_end_date))                      AS latest_revised_end_date,
  BOOL_OR(revised_date IS NOT NULL OR new_end_date IS NOT NULL)  AS has_cos_eot
FROM cos_eot_item
GROUP BY project_id;

CREATE OR REPLACE VIEW v_project_delay_status AS
SELECT
  p.project_id, p.project_name, p.status, p.planned_end_date,
  CASE WHEN COALESCE(r.has_cos_eot, FALSE)
       THEN COALESCE(p.revised_end_date, r.latest_revised_end_date)
       ELSE NULL END                                                          AS effective_revised_end_date,
  CASE
    WHEN p.planned_end_date IS NULL THEN NULL
    WHEN p.status = 'Completed' THEN 0
    ELSE GREATEST(0, CURRENT_DATE - p.planned_end_date)
  END                                                                          AS total_delay_days,
  CASE
    WHEN p.planned_end_date IS NULL OR p.status = 'Completed' THEN 0
    WHEN COALESCE(r.has_cos_eot, FALSE) AND COALESCE(p.revised_end_date, r.latest_revised_end_date) IS NOT NULL
      THEN LEAST(
             GREATEST(0, COALESCE(p.revised_end_date, r.latest_revised_end_date) - p.planned_end_date),
             GREATEST(0, CURRENT_DATE - p.planned_end_date)
           )
    ELSE 0
  END                                                                          AS covered_by_eot_days,
  CASE
    WHEN p.planned_end_date IS NULL OR p.status = 'Completed' THEN 0
    WHEN COALESCE(r.has_cos_eot, FALSE) AND COALESCE(p.revised_end_date, r.latest_revised_end_date) IS NOT NULL
      THEN GREATEST(0, CURRENT_DATE - COALESCE(p.revised_end_date, r.latest_revised_end_date))
    ELSE GREATEST(0, CURRENT_DATE - p.planned_end_date)
  END                                                                          AS uncovered_delay_days
FROM project p
LEFT JOIN v_project_cos_eot_rollup r ON r.project_id = p.project_id;

CREATE OR REPLACE VIEW v_outstanding_gaps AS
SELECT project_id, project_name, sector_id, district_id, priority, remark, status
FROM project
WHERE remark IS NOT NULL AND TRIM(remark) <> '' AND status <> 'Completed';

CREATE OR REPLACE VIEW v_management_action_summary AS
SELECT
  p.project_id, p.project_name,
  COUNT(m.item_id)                                       AS total_items,
  COUNT(*) FILTER (WHERE m.status = 'Open')                AS open_items,
  COUNT(*) FILTER (WHERE m.status = 'Closed')               AS closed_items
FROM project p
JOIN management_action_item m ON m.project_id = p.project_id
GROUP BY p.project_id, p.project_name;

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_project_status         ON project(status);
CREATE INDEX idx_project_district       ON project(district_id);
CREATE INDEX idx_project_sector         ON project(sector_id);
CREATE INDEX idx_project_stage          ON project(project_stage);
CREATE INDEX idx_project_work_type      ON project(work_type);
CREATE INDEX idx_project_pbg_expiry     ON project(pbg_expiry_date) WHERE pbg_expiry_date IS NOT NULL;
CREATE INDEX idx_project_om_applicable  ON project(om_applicable) WHERE om_applicable = TRUE;
CREATE INDEX idx_project_remark_nonnull ON project(project_id) WHERE remark IS NOT NULL AND remark <> '';
CREATE INDEX idx_cos_eot_project        ON cos_eot_item(project_id);
CREATE INDEX idx_mgmt_action_project    ON management_action_item(project_id);
CREATE INDEX idx_mgmt_action_open       ON management_action_item(project_id) WHERE status = 'Open';
CREATE INDEX idx_mom_project            ON minutes_of_meeting(project_id);
CREATE INDEX idx_audit_project          ON audit_log(project_id);
CREATE INDEX idx_project_scheme_scheme  ON project_scheme(scheme_id);
CREATE INDEX idx_milestone_project      ON project_milestone(project_id);
CREATE INDEX idx_mp_project_month       ON milestone_progress(project_id, snap_month);
CREATE INDEX idx_mp_milestone           ON milestone_progress(milestone_id);
