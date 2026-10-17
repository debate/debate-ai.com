-- Files lectures whose titles name World Schools (WSD) or ACC under those
-- lecture collections, which back the cards above the All Videos search box.
-- `classifyLecture` had no rule for either, so these sat on skill shelves and
-- both collections read as empty. Rounds (`style` set) are left alone: a
-- category is a lecture label, and "ACC" is also a round's tournament name.
-- The abbreviations match as whole words (`GLOB` is case-sensitive, hence
-- `upper`), so "accent" or "access" never lands in ACC. `admin_edited` keeps
-- a later `db:seed:videos` re-run from reverting the fix.
UPDATE videos
SET category = 'WSD', category_key = 'wsd', admin_edited = 1, updated_at = unixepoch()
WHERE style IS NULL
  AND (category_key IS NULL OR category_key <> 'wsd')
  AND ((' ' || upper(title) || ' ') GLOB '*[^A-Z0-9]WSD[^A-Z0-9]*'
    OR upper(title) LIKE '%WORLD SCHOOL%');
--> statement-breakpoint
UPDATE videos
SET category = 'ACC', category_key = 'acc', admin_edited = 1, updated_at = unixepoch()
WHERE style IS NULL
  AND (category_key IS NULL OR category_key <> 'acc')
  AND (category_key IS NULL OR category_key <> 'wsd')
  AND ((' ' || upper(title) || ' ') GLOB '*[^A-Z0-9]ACC[^A-Z0-9]*'
    OR upper(title) LIKE '%AMERICAN CONGRESSIONAL%');
