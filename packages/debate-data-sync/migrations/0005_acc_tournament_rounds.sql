-- Files every video whose title names the "ACC Debate Tournament" under the
-- ACC collection (`/videos/acc`). These are rounds, which 0004 left alone, so
-- they keep their `style` and gain the ACC category beside it. The seed and
-- publish paths now derive the same category (`classifyRoundCollection` in
-- `lecture-classifier.ts`), so a `db:seed:videos` re-run keeps it without
-- needing `admin_edited`. `LIKE` is case-insensitive for ASCII in SQLite.
UPDATE videos
SET category = 'ACC', category_key = 'acc', updated_at = unixepoch()
WHERE title LIKE '%ACC Debate Tournament%'
  AND (category_key IS NULL OR category_key <> 'acc');
