# CLAUDE.md — `school-rank`

Package `@debate-ai/school-rank`. School ranks, fuzzy search and wordmark
logos. Entry `src/index.ts` (data, search, stats; no image imports), png URLs
at `@debate-ai/school-rank/wordmarks`, tests in `test/`. README is the
user-facing doc (top 10s, coverage, trademark disclaimer, use cases).

## What lives where

- `src/data/colleges-usnews.ts`: U.S. News 2027 National Universities 1-100
  (108 rows) + wordmark colleges outside it (rank `null`).
- `src/data/high-schools-usnews.ts`: U.S. News 2026-27 public high school
  ranks, only those a source published (1-20 complete, then partial). Fifth
  column = Niche spelling when name matching misses.
- Niche public/private high school lists are **not** copied: they're imported
  from `@debate-ai/rankings/src/schools/academic-category-data`.
- `src/data/wordmarks.ts`: png file → school. A test fails if a png in
  `debate-icons/colleges` or `high-schools` is missing here.

## Things that bite

- **Never invent a rank.** A `null` `usNewsRank` means "not sourced", and the
  README says so. U.S. News does not rank private high schools at all.
- Wordmark coverage numbers in the README are pinned by
  `test/schools.test.ts`. Update both when adding a logo.
- A matched U.S. News school takes the U.S. News name; the Niche name becomes
  an alias, and its id stays based on the Niche name.
