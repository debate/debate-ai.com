-- Files every "Dartmouth RR" round under College (style 4). Their titles carry
-- no "college"/"NDT"/"CEDA" keyword, so `parseDebateStyle` fell back to Policy.
-- `admin_edited` keeps a later `db:seed:videos` re-run from reverting the fix.
-- The round fields (tournament, round, teams, decision) are filled by the
-- model afterwards: POST /api/admin/videos/reclassify
-- (apps/debate-ai.com/lib/videos/reclassify-by-title.ts).
UPDATE videos
SET style = 4, admin_edited = 1, updated_at = unixepoch()
WHERE title LIKE '%Dartmouth RR%' AND (style IS NULL OR style <> 4);
--> statement-breakpoint
UPDATE youtube_round_videos
SET style = 4, updated_at = unixepoch()
WHERE title LIKE '%Dartmouth RR%' AND style <> 4;
