-- Phase B — Region & Division tables (spec §6/§7).
--
-- The user's Region_division.md provides two regions and 45 divisions. Per
-- their answers:
--   - Store division names EXACTLY as provided (their fixed list is authoritative
--     — Goplaganj, Purnea, Smastipur, Sitamarahi, Siwaan are intentional spellings).
--   - Keep the district table intact (no soft-remove). Add region + division
--     alongside — additive only, no destructive DB changes.
--   - Auto-map existing project.district_id → division_id by name match,
--     leave unmatched as NULL. Patna (old single district → 8 sub-divisions)
--     stays NULL; MD reassigns per project.

CREATE TABLE region (
  region_id   SERIAL PRIMARY KEY,
  region_name VARCHAR(60) UNIQUE NOT NULL
);

INSERT INTO region (region_name) VALUES ('South Bihar'), ('North Bihar');

CREATE TABLE division (
  division_id   SERIAL PRIMARY KEY,
  division_name VARCHAR(80) UNIQUE NOT NULL,
  region_id     INT NOT NULL REFERENCES region(region_id)
);

CREATE INDEX idx_division_region ON division(region_id);

-- South Bihar divisions (24) — verbatim from Region_division.md
INSERT INTO division (division_name, region_id) VALUES
  ('Arwal',            (SELECT region_id FROM region WHERE region_name = 'South Bihar')),
  ('Aurangabad',       (SELECT region_id FROM region WHERE region_name = 'South Bihar')),
  ('Banka',            (SELECT region_id FROM region WHERE region_name = 'South Bihar')),
  ('Bhagalpur',        (SELECT region_id FROM region WHERE region_name = 'South Bihar')),
  ('Bhojpur',          (SELECT region_id FROM region WHERE region_name = 'South Bihar')),
  ('Buxar',            (SELECT region_id FROM region WHERE region_name = 'South Bihar')),
  ('Gaya',             (SELECT region_id FROM region WHERE region_name = 'South Bihar')),
  ('Jamui',            (SELECT region_id FROM region WHERE region_name = 'South Bihar')),
  ('Jehanabad',        (SELECT region_id FROM region WHERE region_name = 'South Bihar')),
  ('Kaimur',           (SELECT region_id FROM region WHERE region_name = 'South Bihar')),
  ('Lakhisarai',       (SELECT region_id FROM region WHERE region_name = 'South Bihar')),
  ('Munger',           (SELECT region_id FROM region WHERE region_name = 'South Bihar')),
  ('Nalanda',          (SELECT region_id FROM region WHERE region_name = 'South Bihar')),
  ('Nawada',           (SELECT region_id FROM region WHERE region_name = 'South Bihar')),
  ('Patna Azimabad',   (SELECT region_id FROM region WHERE region_name = 'South Bihar')),
  ('Patna Bankipur',   (SELECT region_id FROM region WHERE region_name = 'South Bihar')),
  ('Patna Kankarbagh', (SELECT region_id FROM region WHERE region_name = 'South Bihar')),
  ('Patna Nutan',      (SELECT region_id FROM region WHERE region_name = 'South Bihar')),
  ('Patna West',       (SELECT region_id FROM region WHERE region_name = 'South Bihar')),
  ('Patna Patliputra', (SELECT region_id FROM region WHERE region_name = 'South Bihar')),
  ('Patna East',       (SELECT region_id FROM region WHERE region_name = 'South Bihar')),
  ('Patna City',       (SELECT region_id FROM region WHERE region_name = 'South Bihar')),
  ('Rohtas',           (SELECT region_id FROM region WHERE region_name = 'South Bihar')),
  ('Sheikhpura',       (SELECT region_id FROM region WHERE region_name = 'South Bihar'));

-- North Bihar divisions (21) — verbatim from Region_division.md
INSERT INTO division (division_name, region_id) VALUES
  ('Araria',           (SELECT region_id FROM region WHERE region_name = 'North Bihar')),
  ('Begusarai',        (SELECT region_id FROM region WHERE region_name = 'North Bihar')),
  ('Darbhanga',        (SELECT region_id FROM region WHERE region_name = 'North Bihar')),
  ('Goplaganj',        (SELECT region_id FROM region WHERE region_name = 'North Bihar')),
  ('Katihar',          (SELECT region_id FROM region WHERE region_name = 'North Bihar')),
  ('Khagaria',         (SELECT region_id FROM region WHERE region_name = 'North Bihar')),
  ('Kishanganj',       (SELECT region_id FROM region WHERE region_name = 'North Bihar')),
  ('Madhepura',        (SELECT region_id FROM region WHERE region_name = 'North Bihar')),
  ('Madhubani',        (SELECT region_id FROM region WHERE region_name = 'North Bihar')),
  ('Muzaffarpur',      (SELECT region_id FROM region WHERE region_name = 'North Bihar')),
  ('West Champaran',   (SELECT region_id FROM region WHERE region_name = 'North Bihar')),
  ('East Champaran',   (SELECT region_id FROM region WHERE region_name = 'North Bihar')),
  ('Purnea',           (SELECT region_id FROM region WHERE region_name = 'North Bihar')),
  ('Saharsa',          (SELECT region_id FROM region WHERE region_name = 'North Bihar')),
  ('Smastipur',        (SELECT region_id FROM region WHERE region_name = 'North Bihar')),
  ('Saran',            (SELECT region_id FROM region WHERE region_name = 'North Bihar')),
  ('Sheohar',          (SELECT region_id FROM region WHERE region_name = 'North Bihar')),
  ('Sitamarahi',       (SELECT region_id FROM region WHERE region_name = 'North Bihar')),
  ('Siwaan',           (SELECT region_id FROM region WHERE region_name = 'North Bihar')),
  ('Supaul',           (SELECT region_id FROM region WHERE region_name = 'North Bihar')),
  ('Vaishali',         (SELECT region_id FROM region WHERE region_name = 'North Bihar'));

ALTER TABLE project
  ADD COLUMN division_id INT REFERENCES division(division_id);

CREATE INDEX idx_project_division ON project(division_id) WHERE division_id IS NOT NULL;

-- Auto-backfill: map existing district_id → division_id by name.
-- Districts with exact spelling matches map straight through.
-- Five have variant spellings in the new list (Gopalganj/Goplaganj,
-- Purnia/Purnea, Samastipur/Smastipur, Sitamarhi/Sitamarahi, Siwan/Siwaan).
-- Patna maps to NULL (splits into 8 sub-divisions — MD reassigns per project).
-- Any district with no match ends up with NULL division_id.
UPDATE project p
SET division_id = d.division_id
FROM district dis, division d
WHERE p.district_id = dis.district_id
  AND d.division_name = (
    CASE dis.district_name
      WHEN 'Gopalganj'  THEN 'Goplaganj'
      WHEN 'Purnia'     THEN 'Purnea'
      WHEN 'Samastipur' THEN 'Smastipur'
      WHEN 'Sitamarhi'  THEN 'Sitamarahi'
      WHEN 'Siwan'      THEN 'Siwaan'
      WHEN 'Patna'      THEN NULL
      ELSE dis.district_name
    END
  );

-- Division-wise summary view (spec §7). Mirrors v_district_summary but joins
-- through division → region so both are queryable at once. Unlike the
-- district view this shows ALL divisions (no HAVING > 0) so the MD can see
-- every division on the summary page even before Patna projects are
-- reassigned.
CREATE OR REPLACE VIEW v_division_summary AS
SELECT
  dv.division_id,
  dv.division_name,
  dv.region_id,
  r.region_name,
  COUNT(p.project_id)                                                       AS total,
  COUNT(*) FILTER (WHERE p.status = 'Completed')                            AS completed,
  COUNT(*) FILTER (WHERE p.status = 'In Progress')                          AS in_progress,
  COUNT(*) FILTER (WHERE p.status = 'Delayed')                              AS delayed,
  ROUND(
    COUNT(*) FILTER (WHERE p.status = 'Completed')::NUMERIC
    / NULLIF(COUNT(p.project_id), 0) * 100, 0
  )                                                                          AS completion_rate_pct
FROM division dv
JOIN region r ON r.region_id = dv.region_id
LEFT JOIN project p ON p.division_id = dv.division_id
GROUP BY dv.division_id, dv.division_name, dv.region_id, r.region_name
ORDER BY r.region_name, dv.division_name;

-- Region-wise summary view — rolls up divisions by region for the summary
-- page's top-level "which region needs attention" tiles.
CREATE OR REPLACE VIEW v_region_summary AS
SELECT
  r.region_id,
  r.region_name,
  COUNT(DISTINCT dv.division_id)                                            AS division_count,
  COUNT(p.project_id)                                                       AS total,
  COUNT(*) FILTER (WHERE p.status = 'Completed')                            AS completed,
  COUNT(*) FILTER (WHERE p.status = 'In Progress')                          AS in_progress,
  COUNT(*) FILTER (WHERE p.status = 'Delayed')                              AS delayed
FROM region r
LEFT JOIN division dv ON dv.region_id = r.region_id
LEFT JOIN project p ON p.division_id = dv.division_id
GROUP BY r.region_id, r.region_name
ORDER BY r.region_name;
