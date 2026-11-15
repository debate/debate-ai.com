# Ideas for New Contributors


###  **Real-time Debate Rooms with WebSockets**

- **Description**: Implement live debate rooms where multiple users can join and debate in real-time with typing indicators, presence, and instant message delivery
- **Tech Stack**: WebSockets (Socket.io or native WS), Redis for pub/sub, React/Vue frontend
- **Difficulty**: Medium-High
- **Good First Issue**: Start with basic room creation/joining, then add real-time messaging

### **AI-Powered Argument Analysis & Feedback**

- **Description**: Build a feature that analyzes debate arguments for logical fallacies, evidence quality, and rhetorical strength, providing constructive feedback
- **use the llm in debate-speech-writer**
- **Difficulty**: High
- **Good First Issue**: Implement fallacy detection for common fallacies (ad hominem, straw man, false dichotomy)

---

## Additional Ideas (Bonus)

### 6\.  **Offline Support**

- Service workers, IndexedDB for offline drafting, push notifications for debate updates

### 7\. **Voice Debate Mode**

- Speech-to-text for arguments, text-to-speech for reading opponent arguments, voice activity detection

### 8\. **Debate Coaching AI Persona**

- Configurable AI personas (Socratic, Devil's Advocate, Fact-Checker) for practice sessions

### 9\. **Evidence Library & Citation Manager**

- Shared evidence database, auto-citation formatting, source credibility scoring

### 10\. **Analytics Dashboard for Debaters**

- Personal stats: win rate, fallacy frequency, argument length, topic expertise, improvement trends

1. ability to challenge legends - and speculators bet
2. random pair webcam debate matching on mutual pref topics





### 📚 CARDS: Crowdsourced Annotated Research for Debating Solutions

- **Auto-Highlight Agents:** agents highlight and underline as many words as needed on a slider, multiple options
- **Full-text search:** across thousands of tagged, annotated evidence cards spanning policy, LD, PF, and college formats
- **AI-powered annotation:** one-click summaries, warrant extensions, and logic-flaw detection per card
- **Three reading modes**: plain text, highlighted tags, and underline-only for fast cutting
- **Citation auto-formatter:** and one-click flow integration — paste directly into your speech doc
- **Mobile-responsive:** with full-screen card overlays for reading on the go
- **Auto-Research Outlines**: agents outline the topic to keyphrases and monitor for new quotes

<p align="center">
    <img src="https://i.imgur.com/1NBeQij.png" width="300" >
</p>

### ⚖️ FIAT: Forum for Issue Analysis on Topic

- **Recommendation Agents**: AI assists with research, summarization, flaw detection, and comparative quote analysis
- **Judge Decision**: agents prompts recommend multiple judge decision options, speech to flow, quote to response options
- **Multi-column flow spreadsheet**: format-specific speech columns for PF, LD, Policy, and NDT with inline editing
- **Shareable round URLs**: every round gets a permanent link; share with judges or teammates instantly
- **Round management**: tournament setup, team pairing, judge assignments, and round notes in one place
- **Speech docs**: full markdown editor per speech with email sharing to judges and coaches
-  **Smart timers**: format-aware prep and speech timers with audio/visual alerts and auto-advance
- **Collaboration**: invite judges and spectators by email; view-only and edit roles supported
- **Archive system**: save, browse, and restore any past round with full flow history
- **Mobile-optimized**: responsive design with swipe navigation between speech columns

<p align="center">
    <img src="https://i.imgur.com/eIQB4Sp.png" width="300"  >
</p>

### 🎥 LEARN: Lectures from Educators, Archive of Rounds & Notes

- **~1,400 college NDT rounds**: dating back to 1995, averaging 50+ new rounds per year, including recent TOC and NDT eliminations
- **~350 Public Forum rounds**: (2015–present), **~125 Policy rounds**: (2003–present), **~100 LD rounds** (2019–present)
- **~1000 instructional videos**: across 20 categories: topic lectures, camp coaching, kritik theory, counterplans, impact calc, novice intro, speaking & delivery, and more
- **~150 hand-curated top picks**: the highest-value rounds and lectures selected for study
- Searchable grid with filter by title, channel, year, or view count; inline YouTube playback with thumbnails
- **200-term Debate Dictionary**: with plain-English definitions for theory, kritik, and procedural jargon
- **26 years of national champion records**: (2000–2025) across NDT, Policy, LD, and PF
- **Team Rankings**: TOC bid list + DebateDrills Elo dual ranking system

<p align="center">
    <img width="300" src="https://i.imgur.com//LJ5hBjh.png" /> 
</p>

### 🔎 STREAM: Search with Top Result Extraction & Answer Model

- **Web Search**: 70+ popular sites search across 10 categories: Web Search, Academic, Videos, Images, Files, News, etc
- **Article Preview**: Extract, format with APA cite, and summarize articles, PDFs, Youtube, and URLs before reading them
- **User Choice of LLM**: OpenAI, Claude, Gemini, Groq, Ollama, Anthropic, etc
- **File Upload Support**: Ask questions about PDFs, URLs, DOCX, Google Docs, and Youtube
- **Search History**: All searches saved with memories, except for privacy mode
- **Follow-up Questions**: Generate follow-up questions to ask language models

<p align="center">
    <img width="300" src="https://i.imgur.com/pDvMC1Q.png" />
</p>

### 📝 REASON: Research Editor for Annotated Summaries in Outline Notation

- **[Debate Editor](https://github.com/debate/debate-editor)** ProseMirror engine, packing
roughly 500 editing commands into ~30 thematic groups. Highlights (full 50+ feature list in the
[package README](./packages/debate-editor/README.md#debate-editor-features)):
- **Structured outline**: pockets, hats, blocks, tags, cards, analytics, and undertags as first-class node types, with footnotes, tables, and live/transcluded zones
- **Lossless `.docx` and `.cmir` round-trip**: Verbatim Word interop plus a native gzip save format, including encrypted-`.docx` decryption and damaged-file salvage
- **Bulk conversion & compression**, automatic style cleanup on import, and a headless `cardmirror-read` CLI/MCP tool for AI-assistant access to files outside the app
- **One-click structural styles**: Pocket, Hat, Block, Tag, Analytic, Undertag, plus citation/underline/emphasis marks and acronym-aware variants
- **Highlight, shading, and font-color pickers** with standardization commands, a paintbrush mode, and highlight locking
- **Card numbering**, multiple **condense modes**, and a full editing-utilities set (shrink/regrow, short cites, live-zone refresh, heading move/copy/delete)
- **Real-time collaboration** (CRDT-backed via Loro) with share codes, invite links, and version recovery — plus an account-linked **contacts list** (requests, blocking, presence) to share a live card straight to a contact's account
- **Speech-doc targeting**: mark a doc as the live send target and send content at cursor or at end, with a persistent send history
- **Flow integration**: send cards or headings straight to a Flow column or cell, or pull content back
- **Dropzone card exchange**, **Quick Cards**, and a unified command-bar search across cards, commands, settings, and ~50 other site tools
- **AI tools**: ask-about-selection, AI-generated citations, translation, and AI-assisted text/formatting repair
- **Flashcards** with spaced-repetition review, a **card cutter** panel, voice dictation, and a reading-marker mode
- **Runtime plugin registry**, a 12-category menu bar, customizable keybindings, and per-user preferences synced to account settings
- **Native desktop/mobile wrapper**  running the identical editor with no browser chrome

## Crowdsourced Research, Community & Practice features

The live feature list lives in [`README.md`](./README.md#features) — one entry per tool, every link checked against the running app. Keep it in sync with the catalogs that decide what the app actually ships:

- `packages/debate-webview/src/routes/tools/tool-groups.ts` — `ALL_TOOLS` (the `/tools` catalog, the command palette and favorites)
- `packages/debate-webview/src/lib/feature-catalog.ts` — `APP_FEATURES` (the `/practice/features` page)
- `packages/debate-webview/src/routes/index.ts` — `PAGE_ROUTES` / `CLIENT_ROUTES` (the route table both catalogs point at)

## Fallacy hints in Word-Count Speeches (Completed 2026-11-05, branch `claude/gifted-babbage-e3a5i3`)

Slice of the IDEAS.md "AI-Powered Argument Analysis & Feedback" idea: surface the existing offline `detectFallacies` heuristic in the UI.

- [x] `FallacyHints` panel component (`packages/debate-practice-drills/src/panels/FallacyHints.tsx`), shown under each speech in `WordCountRoundsPanel`, with Vitest in `WordCountRoundsPanel.test.tsx`
- [x] Documented in `features/rounds/word-count-rounds.mdx`
- [x] Hints on the unsent draft in the Practice vs AI room (2026-11-07, branch `claude/gifted-babbage-59uqvl`): `FallacyHints` moved to `packages/debate-speech-writer/src/ui/` and mounted in `DebateRoom`, with Vitest (`debate-room.test.tsx`, `FallacyHints.test.tsx`); documented in `practice-vs-ai.mdx` (features + internals)
- [x] Hints on the outline of each AI Outcome Responses candidate (2026-11-09, branch `claude/gifted-babbage-j5jsq8`): `FallacyHints` mounted in `CandidateCard` (`packages/debate-round/src/dialogs/AiOutcomeResponsesDialog.tsx`), with Vitest in `AiOutcomeCandidateCard.test.tsx`; documented in `ai-outcome-responses.mdx`. Environment note: the 7 `debate-round` test files that import `debate-rankings` / `@debate-ai/editor` fail without the git submodules; `bun run typecheck` stops at `@debate-ai/editor#build` for the same reason
- [x] Hints under each pasted transcript in the Speech Transcript Summaries extraction form (2026-11-09, branch `claude/gifted-babbage-dgqcux`): `FallacyHints` mounted in `FlowSummariesPanel`, with Vitest in `FlowSummariesPanel.test.tsx`; documented in `flow-summaries.mdx`
- [x] Hints under each pasted speech in the AI Judge Decision panel and under the speech draft in Online Debate Versus AI (2026-11-11, branch `claude/gifted-babbage-3ibl21`, PR #1647): `FallacyHints` mounted in `SpeechJudgeSection` and `AiVersusRoundPanel` (`packages/debate-practice-drills/src/panels/`), with Vitest in `JudgeDecisionPanel.test.tsx` and `AiVersusRoundPanel.test.tsx`; documented in `ai-versus-rounds.mdx`, `practice-tools.mdx` and `dev-docs/internals/judge-paradigm-selections.mdx`
- [ ] Follow-up (deferred): show hints in remaining text surfaces (editor speech docs, `ebb` flow cells — both in upstream-synced packages); evidence-quality and rhetorical-strength feedback via the LLM; persist fallacy counts for a fallacy-frequency stat (needs a schema decision)

## Debate Coaching AI Persona (Completed 2026-11-11, branch `claude/gifted-babbage-7huvxp`, PR #1641)

Slice 1 of IDEAS.md bonus idea 8, "Configurable AI personas (Socratic, Devil's Advocate, Fact-Checker) for practice sessions". Goal: pick how the AI coach talks when you ask for AI feedback in AI Coach Mode (`/coaching?section=ai-coach`).

Non-goals: personas for the team coach Q&A or the practice-vs-AI coach; saving the choice to the account; custom persona authoring.

- [x] `coach/coach-personas.ts` in `debate-speech-writer` (Standard, Socratic, Devil's Advocate, Fact-Checker; shared "critique the argument, never the debater" guardrail; unknown ids fall back to Standard), exported from the package index
- [x] `buildCoachFeedbackAiSystemPrompt(personaId)` in `debate-practice-drills` `round/coach-feedback-ai.ts`; `requestCoachFeedback` sends it (Standard keeps the old prompt byte for byte)
- [x] Optional `aiFeedbackPersonaId` on `CoachingSessionRecord` (additive, syncs with the record); the coaching-notes download names the style
- [x] **Coaching style for AI feedback** picker (toggle buttons, `aria-pressed`) and a persona badge on the feedback in `CoachingSessionsPanel`
- [x] Vitest: `coach-personas.test.ts`, `coach-feedback-ai.test.ts`, `coach-feedback-client.test.ts`, `coachingSessions.test.ts`, `CoachingSessionsPanel.test.tsx`
- [x] Docs: `features/ai-coaching/coaching-sessions.mdx` (Coaching style) and new `dev-docs/internals/coaching-sessions.mdx`
- [x] Verified: `bun run typecheck` (32/32), `bun run test` (1108 files / 15079 tests pass), `bun run build:web` pass (after `git submodule update --init`); PR #1641
- [x] Personas for the team coach Q&A (2026-11-11, branch `claude/gifted-babbage-jb3rg3`) — see "Coaching style for Ask the coach" below
- [x] Remember the choice per account: AI Coach Mode (2026-11-11, see "Remember the AI Coach Mode coaching style per account" below; synced as a tool-record collection rather than a `user_settings` column, so no schema change)
- [ ] Follow-up (deferred): ~~personas for the practice-vs-AI coach~~ (done 2026-11-15, see "Coaching style for the Practice vs AI Coach debrief"); ~~remember the "Ask the coach" choice~~ (done 2026-11-14); custom coaching personas

## Coaching style for "Ask the coach" (Completed 2026-11-11, branch `claude/gifted-babbage-jb3rg3`, PR #1667)

Slice 2 of IDEAS.md bonus idea 8 (and the "add tools where needed in the UI" part of the standing request): the Team Coach Q&A on Coach Materials (`CoachMaterialsPanel`, "Ask the coach") gets the same Standard / Socratic / Devil's Advocate / Fact-Checker picker AI Coach Mode has.

Non-goals: practice-vs-AI coach; remembering the choice (per device or account); changes to the grounding rules. Doesn't touch Settings / saved-data files (open PR #1662 is repairing those).

Acceptance criteria:
- [x] `buildTeamCoachAiSystemPrompt(personaId)` in `debate-speech-writer` `coach/team-coach-ai.ts` appends the persona after the grounding rules; Standard / missing / unknown id keeps `TEAM_COACH_AI_SYSTEM_PROMPT` byte for byte; exported from the package index
- [x] `requestTeamCoachAnswer` takes an optional `personaId` and sends it as the system prompt (not as a body field)
- [x] Optional `personaId` on `CoachConversationTurn`, stored by `appendCoachConversationTurn` only for non-Standard styles (additive; syncs with the `coachConversation` collection)
- [x] **Coaching style** picker (toggle buttons, `aria-pressed`, description + "Every style answers only from your materials") and a "<name> coach" badge on styled turns in `CoachMaterialsPanel`
- [x] Vitest: `team-coach-ai.test.ts`, `team-coach-client.test.ts`, `coachConversation.test.ts`, `CoachMaterialsPanel.test.tsx` (51 tests in the 5 coach files pass)
- [x] Docs: `features/ai-coaching/coach-materials.mdx` and `dev-docs/internals/coach-materials.mdx` (behaviour + new Known gap: the choice isn't remembered)
- [x] Verification, against the `master` this branch is level with: `bun run typecheck` 31/32 tasks pass. The one failure, `@debate-ai/ai-web`, is the `saved-data-restore.ts` / `saved-data-items.test.ts` break that PR #1662 fixes. `bun run test`: 1122 files / 15240 tests pass, 3 tests fail in those same two saved-data test files. `bun run build:web` fails on `master` with `MISSING_EXPORT introspectPostgresTables` (#1662 fixes it). With #1662's one-line stub applied locally and not committed, the build passes, so the MDX edits compile. No lint script is configured

## Remember the AI Coach Mode coaching style per account (Completed 2026-11-11, branch `claude/gifted-babbage-pahdkv`, PR #1668, merged 2026-11-12)

Slice of the standing request (user settings saved in SQL and linked to users; better tool UI) and the "remember the choice per account" follow-up of the Debate Coaching AI Persona entry above. AI Coach Mode's **Coaching style for AI feedback** picker resets to Standard on every page load and every device.

Goal: the picked style is saved in this browser and, when signed in, to the account (`saved_tool_records`, no schema change), so it is the starting style on every device.

Scope:
- `state/coachPersonaPreferences.ts` in `debate-speech-writer`: one record per picker surface (`{ id, personaId, updatedAt }`), SSR/corrupt-storage safe, unknown persona ids read back as Standard
- One `TOOL_RECORD_COLLECTIONS` entry (`coachPersonaPreferences`, Coaching section, `/coaching`) so the existing auto-sync watcher carries it to the account
- `CoachingSessionsPanel` starts on the saved style, saves on change, and follows a `storage` event (another tab or an account merge)

Non-goals: the Coach Materials "Ask the coach" picker (open PR #1667 adds it; it can pass its own surface id later); a Settings row for it; custom personas.

Acceptance criteria:
- [x] Picking a style persists it; reopening AI Coach Mode starts on it
- [x] Missing / corrupt / unknown stored values fall back to Standard without throwing
- [x] Signed in, the preference syncs through the generic tool-record sync (catalog entry + id-field pin)
- [x] A `storage` event for the key updates the open picker
- [x] Vitest: store, panel, catalog (`coachPersonaPreferences.test.ts`, 3 new cases in `CoachingSessionsPanel.test.tsx`, `coachPersonaPreferences: "id"` pin in `tool-record-catalog.test.ts`)
- [x] Verified against the `master` of 2026-11-11 (after `git submodule update --init` and `node scripts/sync-upstream.mjs` in `debate-editor` / `debate-tournaments`). No lint script is configured. Every failure below is pre-existing and fixed by open PR #1662:
  - `bun run typecheck`: 31/32 tasks pass. The failing task is `@debate-ai/ai-web`, in `saved-data-restore.ts` / `saved-data-items.test.ts`
  - `bun run test`: 1125 files / 15303 tests pass, 19 skipped. 3 tests fail in `saved-data-items.test.ts` and `saved-data-restore.test.ts`, and fail the same way with this change set aside
  - `bun run build:web`: fails with `MISSING_EXPORT introspectPostgresTables`. With #1662's one-line stub applied locally (not committed) it passes (4/4 tasks)
- [x] Docs: `features/ai-coaching/coaching-sessions.mdx`, `dev-docs/internals/coaching-sessions.mdx`, `dev-docs/internals/tool-data-sync.mdx`

Implementation plan:
- [x] Store module + export from the package index
- [x] Catalog entry + `EXPECTED_ID_FIELDS` pin
- [x] Panel wiring
- [x] Tests, docs, verification
- [x] Follow-up done 2026-11-14 (branch `claude/gifted-babbage-p1au8q`): Coach Materials' "Ask the coach" picker reads and saves the `"team-coach"` surface — see "Remember the Ask the coach coaching style per account" below
- [x] Follow-up (done 2026-11-15): the practice-vs-AI coach picker gets its own surface id (`"practice-vs-ai"`)
  - Re-verified after merging `master` (2026-11-12): `bun run build:web` passes (4/4); typecheck / test fail only on the saved-data files, which #1662 (now merged) fixes

## Remember the "Ask the coach" coaching style per account (Completed 2026-11-14, branch `claude/gifted-babbage-p1au8q`)

Slice of the standing request (user settings saved in SQL and linked to users; tools where needed in the UI; better tool UI) and the ready follow-up of "Remember the AI Coach Mode coaching style per account" above. Coach Materials' **Coaching style** picker reset to Standard on every page load and device.

Goal: the "Ask the coach" style is saved in this browser and, signed in, to the account (`saved_tool_records` through the existing `coachPersonaPreferences` collection, no schema change), independently of AI Coach Mode's choice.

Non-goals: a Settings row for coaching styles; the practice-vs-AI coach; custom personas; changing the last-write-wins merge.

Acceptance criteria:
- [x] Picking a style in "Ask the coach" saves it under the `"team-coach"` surface; reopening Coach Materials starts on it
- [x] AI Coach Mode's `"ai-coach-feedback"` choice is untouched by it
- [x] Corrupt stored value starts on Standard without throwing
- [x] A `storage` event for `coachPersonaPreferences` (another tab, account merge) updates the open picker
- [x] Vitest: 3 new cases in `packages/debate-speech-writer/test/CoachMaterialsPanel.test.tsx`
- [x] Docs: `features/ai-coaching/coach-materials.mdx`, `dev-docs/internals/coach-materials.mdx` (Known gap replaced), `dev-docs/internals/coaching-sessions.mdx`
- [x] PR #1720. Verified on 2026-11-14 against `master` `bfd1c81` (after `git submodule update --init`, `bun install` and `node scripts/sync-upstream.mjs` in `debate-editor` / `debate-tournaments`). No lint script is configured:
  - `bun run typecheck`: 31/31 tasks pass
  - `bun run test`: 1177 files / 15846 tests pass (5 files / 19 tests skipped)
  - `bunx turbo build --filter=@debate-ai/web`: passes. `bun run build:web` itself fails before building anything with `No package found with name '@debate-ai/ai-web'`: the app package is now `@debate-ai/web` (follow-up below)

Follow-ups:
- [x] (done 2026-11-15) the practice-vs-AI coach picker gets its own surface id (`"practice-vs-ai"`)
- [ ] (deferred, needs product decision) a Settings → General row listing remembered coaching styles, so users can see / reset them alongside other saved data
- [x] (done on `master` before 2026-11-15; re-verified: the root scripts filter `@debate-ai/web`) Fix the stale root scripts: `build:web` / `dev:web` in the root `package.json` filter `@debate-ai/ai-web`, but `apps/debate-web` publishes as `@debate-ai/web`, so `bun run build:web` fails with "No package found". Check CI (`.github/workflows`) and `CLAUDE.md`, which point at the same scripts

## Sync the Settings → Sound effects level to the account (Completed 2026-11-14, branch `claude/gifted-babbage-g7tk9d`, PR #1726)

Slice of the standing request (user settings saved in SQL and linked to users; better tool UI). **Settings → Sound & speech → Sound effects** (All / Minimal / Off) lived only in one browser's `localStorage` (`sound-effect-level`), and the storage-key coverage guard (`storage-key-coverage.test.ts`) never saw it because its constant is `SOUND_EFFECT_LEVEL_KEY`, not `STORAGE_KEY`.

Goal: signed in, the level follows the account through the existing tool-record sync (`saved_tool_records`, no schema change, no new route); signed out it stays on the device as before.

Non-goals: widening the coverage guard's regex (follow-up below); syncing the read-aloud voice or on-device model choices; a `user_settings` column.

Acceptance criteria:
- [x] `soundEffectLevel` catalog entry (Practice section, `/settings`) with a codec (`account-sync/sound-effect-level-codec.ts`) that wraps the one JSON string as a single `level` record; unknown / corrupt values are no records, and an empty merge writes `null` (read as the default)
- [x] `@debate-ai/timer` stores the level JSON-encoded, stores **All effects** explicitly (so a reset replaces another device's level instead of being re-pushed over), still reads a bare pre-sync value, and upgrades it to JSON on first subscribe
- [x] An account merge (`storage` event) updates the open Settings picker
- [x] The Settings row says where the level is saved (shared `describeToolStorage` copy)
- [x] Vitest: `sound-effect-level-codec.test.ts` (new), `sound-effect-preferences.test.ts`, `sound-effects-section.test.tsx` (new), `soundEffectLevel: "id"` pin in `tool-record-catalog.test.ts`
- [x] Docs: `features/ui-navigation/user-settings.mdx` ("Sound effects follow your account"), `dev-docs/internals/tool-data-sync.mdx` (Practice section)
- [x] `/settings` added to the `debate-videos` `tool-record-sync-catalog.test.ts` destination allowlist (a routed page in the command palette; it holds this setting's picker)
- [x] Verified 2026-11-14 against `master` `8bb028d` (after `git submodule update --init`, `bun install`, `node scripts/sync-upstream.mjs` in `debate-editor` / `debate-tournaments`). No lint script is configured:
  - `bun run typecheck`: 31/31 tasks pass
  - `bun run test`: 1179 files / 15873 tests pass (5 files / 19 tests skipped)
  - `bunx turbo build --filter=@debate-ai/web`: 4/4 tasks pass (`bun run build:web` filter fix is open PR #1721)
- [x] PR #1726 (commits `e063202`, `f572d71`)

Follow-ups:
- [x] ~~(ready, small) `storage-key-coverage.test.ts` only matches constants named exactly `STORAGE_KEY`~~ — done 2026-11-14, see "Audit every `*_KEY` localStorage store" below
- [ ] (needs product decision) sync the read-aloud voice choice the same way, or declare it device-local (voices differ per device)

## Audit every `*_KEY` localStorage store for account sync (Completed 2026-11-14, branch `claude/gifted-babbage-63g3lb`)

Slice of the standing request (user settings and tool data saved in SQL and linked to users) and the follow-up of PR #1726. The coverage guard `packages/debate-search-evidence/test/account-sync/storage-key-coverage.test.ts` only saw constants named exactly `STORAGE_KEY`, so ~45 stores under other names (`SOUND_EFFECT_LEVEL_KEY`, `DRAFT_KEY`, `CLIP_INDEX_KEY`, `SECTION_KEY`, …) could stay browser-only without anything failing.

Goal: a new `localStorage` store under any `SOME_NAME_KEY = "…"` constant fails the guard until it is synced or declared device-local.

Non-goals: moving any store to the account (each is a product call); scanning `apps/` (the guard covers `packages/*/src`, as before); stores whose key is an inline literal or a template string.

Acceptance criteria:
- [x] Pattern widened to every `*_KEY = "…"` constant; `*API_KEY` names (credentials) are skipped by name
- [x] Every newly seen key classified with a reason: `SYNCED_ELSEWHERE` (`newsStreamViewerState`, `debate-videos:speech-starts`), `DEVICE_LOCAL` (drafts, caches, layout/section state, recorder choices, sample data, desktop flow app, admin cursor, debug flag), new `MIGRATED_LEGACY` (`pinned-debates`, `speech-doc-links`, `debate:flow-auto-save-enabled`) and new `NOT_LOCAL_STORAGE` (sessionStorage flags, an IndexedDB meta key, a URL hash parameter, a collection name)
- [x] Stale / overlap check covers all four lists
- [x] Vitest: 2 new cases (non-`STORAGE_KEY` names are seen; `*API_KEY` skipped); removing any one classified entry makes the guard fail (checked by hand with `app-dock-hidden`)
- [x] Docs: `dev-docs/internals/tool-data-sync.mdx` Known gaps entry
- [x] PR #1736 (commits `ed55ae2`, this tracker commit)
- [x] Verified 2026-11-14 against `master` `9e57d00` (after `git submodule update --init`, `bun install`, `node scripts/sync-upstream.mjs` in `debate-editor` / `debate-tournaments`). No lint script is configured:
  - `bun run typecheck`: 31/31 tasks pass
  - `bun run test`: 1184 files / 15926 tests pass (5 files / 19 tests skipped)
  - `bun run build:web`: 4/4 tasks pass

Follow-ups:
- [ ] (needs product decision) whether layout preferences now declared device-local (`app-sidebar-width`, `app-sidebar-collapsed`, `sidebar-icon-animations`, `app-dock-hidden`) should follow the account like the font family does
- [x] ~~(deferred, low priority) the guard does not scan `apps/debate-web` or keys built from template strings~~ — done 2026-11-14, see "Audit the web app and inline localStorage keys" below

## Audit the web app and inline `localStorage` keys for account sync (Completed 2026-11-14, branch `claude/gifted-babbage-swzqsw`)

Slice of the standing request (user settings and tool data saved in SQL and linked to users) and the follow-up of "Audit every `*_KEY` localStorage store" above. The coverage guard (`packages/debate-search-evidence/test/account-sync/storage-key-coverage.test.ts`) only read `*_KEY = "…"` constants under `packages/*/src`, so a store in `apps/debate-web`, or one whose key is passed straight to `localStorage` (`localStorage.getItem("color-theme")`, `` `debate-recording-${speechName}` ``), could stay browser-only unnoticed.

Goal: any new `localStorage` store, under a constant or an inline literal / template key, in a package or the web app, fails the guard until it is synced or classified.

Non-goals: moving any store to the account; keys passed through a variable or a non-`localStorage` wrapper; `apps/debate-native-wrapper` / `apps/debate-browser-ext` (outside the workspace).

Acceptance criteria:
- [x] Scan covers `apps/debate-web/app`, `lib`, `worker`; `__tests__` / `test` folders and `*.test.ts(x)` files skipped
- [x] Literal keys passed to `localStorage.getItem / setItem / removeItem` are audited; template keys by static prefix (`debate-recording-*`); `sessionStorage` and identifier arguments are not
- [x] Values shaped like a Google API key (the public InnerTube key) are skipped as credentials
- [x] Newly seen keys classified: `color-theme`, `settings` → `SYNCED_ELSEWHERE` (`user_settings` columns); `debate-recording-*` and 7 Debate Editor keys → `DEVICE_LOCAL`; `chatModelProviderId`, `chatModelKey`, `plugin:*` → new `AWAITING_DECISION`
- [x] Editor-only keys are not reported stale when the `debate-editor-cm` submodule / assembled `debate-editor/src` is absent (CI has both)
- [x] Vitest: 3 new cases (web-app roots audited; literal / template / sessionStorage parsing; credential values skipped). Mutation-checked by hand: dropping `color-theme` and adding a `localStorage.getItem("probe-new-store")` under `apps/debate-web/lib` each fail the guard
- [x] Docs: `dev-docs/internals/tool-data-sync.mdx` Known gaps (fixed entry + new "awaiting a decision" entry)
- [x] PR #1739 (commits `4615091`, tracker commit)
- [x] Verified 2026-11-14 against `master` `f1ac5bd` (after `git submodule update --init`, `bun install`, `node scripts/sync-upstream.mjs` in `debate-editor` / `debate-tournaments`). No lint script is configured:
  - `bun run typecheck`: 31/31 tasks pass
  - `bun run test`: 1184 files / 15929 tests pass (5 files / 19 tests skipped)
  - `bun run build:web`: 4/4 tasks pass

Follow-ups:
- [ ] (needs product decision) sync the QwkSearch chat model choice (`chatModelProviderId` / `chatModelKey`) to the account, and what to do when the saved provider isn't configured on another device
- [ ] (needs product decision) sync Debate Editor plugin settings (`plugin:<id>`), an upstream-synced package, so it would go through `patches/debate-ai.patch`
- [x] (done 2026-11-15, branch `claude/gifted-babbage-x9xeup`) keys reached through a wrapper (`storage.getItem(key)`, `readJson(KEY)`) with an inline literal are still not seen — see "Follow storage wrappers in the account-sync coverage guard" below

## Restore practice debates vs AI from an export (Completed 2026-11-14, branch `claude/gifted-babbage-2ms8pf`)

Slice of the standing request (flows, docs and debates saved in SQL and linked to users) and the follow-up of PR #1722: **Settings → General → Restore from export…** brought back documents, flows, rounds, word-count rounds and drill sets, but listed every practice debate vs AI as skipped ("Practice debates can't be restored yet") because there was no validator for a `DebateVsBotRecord` arriving from outside the vs-bot handlers.

Goal: a practice debate in an **Export** / **Export all as JSON** file comes back into `practice_vs_ai_debates` as the caller's row and shows in Practice vs AI history again.

Non-goals: restoring the gamification score / badges / streak (a restored round never re-awards); restoring judge decisions or sent speeches (not listable yet); a schema change.

Acceptance criteria:
- [x] `isValidDebateVsBotRecord` + `MAX_SAVED_PRACTICE_DEBATE_BYTES` / `MAX_PRACTICE_DEBATE_MESSAGES` in `@debate-ai/practice-vs-ai` (`src/backend/record-validation.ts`, exported from `./backend`)
- [x] `restoreOwnSavedData` inserts a valid practice debate with a fresh row id, the caller's `user_id` and email, `created_at` from the record, and `result` re-derived from the outcome (as `setOutcome` does); never awards gamification
- [x] Skipped as "Already in your account." when the exported id is still the caller's, or the caller has the same topic + opponent + start second (so restoring a file twice is harmless); another user's rows never count
- [x] Invalid → "Not a valid practice debate."; oversized → "Too large to save to your account."
- [x] Vitest: `packages/debate-round-practice-ai/test/record-validation.test.ts` (new), 3 new cases + updated skip / Export-all round-trip cases in `apps/debate-web/lib/saved-data/__tests__/saved-data-restore.test.ts`
- [x] Docs: `features/ui-navigation/user-settings.mdx` (restore covers practice debates; Known gap removed), `dev-docs/internals/practice-vs-ai.mdx` ("Restoring a round from an export")
- [x] PR #1734 (commit `b0c46a7`)
- [x] Verified 2026-11-14 against `master` `5e9ce54` (after `git submodule update --init`, `bun install`, `node scripts/sync-upstream.mjs` in `debate-editor` / `debate-tournaments`). No lint script is configured:
  - `bun run typecheck`: 31/31 tasks pass
  - `bun run test`: 1180 files / 15898 tests pass (5 files / 19 tests skipped)
  - `bun run build:web`: 4/4 tasks pass

Follow-ups:
- [x] ~~(deferred, needs product decision) judge decisions and sent speeches are counted but not listable, exportable or restorable one by one~~ — done 2026-11-15 as a read-only slice (list / export / restore, no Delete), see "List, export and restore judge decisions and sent speeches" below

## Follow storage wrappers in the account-sync coverage guard (Completed 2026-11-15, branch `claude/gifted-babbage-x9xeup`)

Slice of the standing request (user settings, flows, docs and debates saved in SQL and linked to users) and the follow-up of PR #1739. The coverage guard (`packages/debate-search-evidence/test/account-sync/storage-key-coverage.test.ts`) only read literal keys passed to `localStorage.*Item(…)` itself. A key passed to a wrapper was never seen. That included the two biggest stores in the app: `getBulkItem("flows")` / `setBulkItem("rounds", …)` in `bulk-storage.ts`.

Goal: a literal key reaches the guard whether it goes to `localStorage`, `sessionStorage`, an injected `storage` object, or a function that passes it on to one of these. Wrappers that call other wrappers count too.

Non-goals: moving any store to the account; keys held in a variable whose value is computed elsewhere; wrappers that take the key as a later parameter or inside an options object; `apps/debate-native-wrapper` / `apps/debate-browser-ext` (outside the workspace).

Acceptance criteria:
- [x] Literal keys passed to `getItem / setItem / removeItem` are audited on any receiver, not just `localStorage`
- [x] Storage wrappers are found automatically: a function whose first parameter goes to a Web Storage call or to another wrapper. Repeated passes catch chains (`setBulkItem` → `writeLegacy` → `storage.setItem`)
- [x] A literal or template first argument to a wrapper is audited. Calling a method that shares a wrapper's name (`obj.readKey(`) or a function whose name merely ends in one (`notsetBulkItem(`) does not count. Fetch helpers like `readJson(response, "…")` are not mistaken for wrappers
- [x] Newly seen keys classified: `flows`, `rounds` → `SYNCED_ELSEWHERE` (`saved_flows` / `saved_rounds`). No other new keys
- [x] Vitest: 3 new cases plus a widened literal-key case (11 total, all pass). Checked by hand that removing `flows` from `SYNCED_ELSEWHERE` makes the guard fail
- [x] Docs: `dev-docs/internals/tool-data-sync.mdx` Known gaps (fixed entry)
- [x] Verified 2026-11-15 against `master` `100634c` (after `git submodule update --init`, `bun install`, `node scripts/sync-upstream.mjs` in `debate-editor` / `debate-tournaments`). No lint script is configured:
  - `bun run typecheck`: 31/31 tasks pass
  - `bun run test`: 1185 files / 15938 tests pass (5 files / 19 tests skipped)
  - `bun run build:web`: 4/4 tasks pass
- [x] PR #1740 (commit `57010bb`, tracker commits)

Follow-ups:
- [x] ~~(deferred, low priority) wrappers that take the key in a later parameter or inside an object (`store({ key: "…" })`) are still not followed~~ (done 2026-11-15, see below)

## Follow keys in later parameters and options objects in the account-sync coverage guard (Completed 2026-11-15, branch `claude/gifted-babbage-f4oriq`, PR #1742 merged as `d5883fd`)

Slice of the standing request (user settings, flows, docs and debates saved in SQL and linked to users) and the deferred follow-up of PR #1740. The coverage guard (`packages/debate-search-evidence/test/account-sync/storage-key-coverage.test.ts`) only followed wrappers whose **first** parameter was the key. A store whose key went in a later parameter (`useHubSection(sections, storageKey)`) or inside an options object (`readLocalToolRecords({ storageKey })`) could ship a new literal key without the guard seeing it.

Goal: the guard knows which argument (or options property) carries each wrapper's key, and audits literals passed there.

Non-goals: moving any store to the account; keys held in a variable whose value is computed elsewhere; rewriting the scan with a real TypeScript parser; `apps/debate-native-wrapper` / `apps/debate-browser-ext` (outside the workspace).

Acceptance criteria:
- [x] A wrapper is recorded with its key slot: a parameter index, or an index plus a property (`options.key`, a destructured `{ key }` or `{ key: alias }`, or an options object passed on whole to another options wrapper)
- [x] Call sites are split into top-level arguments (strings, comments and nested brackets skipped), so a literal or template key in the slot, or `{ key: "…" }` in an options slot, is audited. A non-key argument (`fallback: "…"`, a callback's string) is not
- [x] No regressions: every key the old guard found is still found (the stale check passes unchanged)
- [x] False positives closed: a handler nested in a component ends with its own block instead of running to the end of the component; prose like ``handle (`some-team`)`` in a comment is not a call (this showed up as four school slugs before the fix)
- [x] Vitest: 3 new cases (synthetic wrappers, synthetic call sites, the codebase's `useHubSection` / `readLocalToolRecords` / `writeLocalToolRecords`), 14 total, all pass. Checked by hand that reverting either false-positive fix makes a test fail
- [x] Docs: `dev-docs/internals/tool-data-sync.mdx` Known gaps (fixed entry)
- [x] Verified 2026-11-15 on `master` `fb17157` + this branch (after `git submodule update --init`, `bun install`). No lint script is configured:
  - Focused: `bunx vitest run --config apps/debate-web/vitest.config.ts packages/debate-search-evidence/test/account-sync/storage-key-coverage.test.ts`: 14/14 pass
  - `bun run typecheck`, `bun run test`, `bun run build:web`: **blocked by a pre-existing break on `master`**. `packages/debate-editor/patches/debate-ai.patch` no longer applies to the pinned upstream `caf5a5b0` (`patch fragment without header at line 5052`; the patch was hand-edited in commit `7ebd7a1`), so `@debate-ai/editor#build` fails and `src/` is never assembled. Every failing test (121 files / 24 tests of 1197 / 14411) is either a `Failed to resolve import "@debate-ai/editor…"` or `upstream-sync.test.ts` reporting the same patch error, plus one missing generated `apps/debate-browser-ext/.wxt/tsconfig.json`. This change touches only a test file and docs
- [x] PR #1742 (commit `9cdd34f`, tracker commits); merged to `master` as `d5883fd`
- [x] Repo-wide checks unblocked and re-run 2026-11-15 on `master` `41348ac` (which contains `d5883fd`): `bun run typecheck` 31/31 tasks pass; `bun run test` and `bun run build:web` — see the verification of "List, export and restore judge decisions and sent speeches" below, run on the same base

Follow-ups:
- [x] ~~(blocker, needs maintainer) repair `packages/debate-editor/patches/debate-ai.patch` (broken by commit `7ebd7a1`)~~ — repaired on `master` in `1c8b7f3` ("repair hand-edited debate-ai.patch that broke the build"); `node scripts/sync-upstream.mjs` reports `src/ is current` again

## List, export and restore judge decisions and sent speeches (Completed 2026-11-15, branch `claude/gifted-babbage-ubkmok`)

Slice of the standing request (flows, docs and debates saved in SQL and linked to users) and the follow-up of PR #1734. **Settings → General → Saved to your account** counted judge decisions (`saved_judge_decisions`) and sent speeches (`saved_speech_send_log`) but had no **Manage** list for them, left them out of **Export all as JSON**, and couldn't restore them. They were the only counted kinds a user could not see or take out one by one.

Goal: both kinds work like word-count rounds — listed newest first with title search, each with **Export**, included in **Export all**, and brought back by **Restore from export…**.

Non-goals: **Delete** from Settings (both tools re-push local entries the account lacks — `useJudgeDecisions`, `useSpeechSendLogSync` — so a server-only delete would come back; they are cleared in their own tools, and Settings says where); deep links to one decision or entry (neither page has one); a schema change.

Acceptance criteria:
- [x] `judgeDecisions` and `speeches` in `ITEM_KINDS`, not in `DELETABLE_ITEM_KINDS` (`apps/debate-web/lib/saved-data/saved-data-items.ts`); the `[kind]` route answers 405 on `DELETE` for them through the existing check
- [x] Titles from the stored JSON: `judgeDecisionTitle` ("Aff wins · Tabula Rasa", falls back to "First side" / "Second side" and "Judge decision") and `speechSendTitle` (preview clipped to 80 characters, falls back to "Sent speech"). Without a search the list pages in SQL; with one it filters the caller's rows in memory. Links go to `/practice/judge-decision` and `/speech-documents`
- [x] Export (single and **Export all**) carries the parsed record as `data`; a decision also carries `roundId`. Another user's row exports as `null` (404)
- [x] Restore validates with `isValidJudgeDecisionRecord` / `isValidSpeechSendLogEntry` and the `PUT` routes' size caps, inserts under the record's own id with the export's `createdAt`, skips "Already in your account." when the caller already has that id (another user's row doesn't count) and never overwrites
- [x] Settings UI: **Manage** for both kinds (`MANAGEABLE_KINDS`), a hint in place of Delete pointing to **Clear** on AI Judge Decision / the trash button or **Clear history** on Speech Documents, and restore summary nouns ("1 judge decision and 2 sent speeches")
- [x] Vitest: 7 new list/export cases in `saved-data-items.test.ts`, 3 new restore cases plus the extended Export-all round trip in `saved-data-restore.test.ts`, 2 new UI cases in `saved-data-section.test.tsx`, 1 new assertion in `restore-saved-data.test.tsx`; the restore route test's report shape updated
- [x] Docs: `features/ui-navigation/user-settings.mdx` (Manage, Export all, Restore, engineering notes; Known gap marked fixed)
- [x] Verified 2026-11-15 on `master` `41348ac` + this branch (after `git submodule update --init`, `bun install`, `node scripts/sync-upstream.mjs` in `debate-editor` / `debate-tournaments`). No lint script is configured:
  - `bun run typecheck`: 31/31 tasks pass
  - `bun run test`: 1195 files / 16085 tests pass (5 files / 19 tests skipped)
  - `bun run build:web`: 4/4 tasks pass
- [x] PR #1756 (commits `a01f6e3`, `4fe7321`, tracker commit)

Follow-ups:
- [ ] (deferred, low priority) per-decision / per-entry deep links (`/practice/judge-decision?decision=`, `/speech-documents?entry=`) so the Manage rows open the exact item instead of the page


## Apply synced flow editor shortcuts and settings without a reload (Completed 2026-11-15, branch `claude/gifted-babbage-wdxrmz`, PR #1753)

Slice of the standing request (integrate the tools with user settings saved in SQL and linked to users) and the Known gap in `features/ui-navigation/user-settings.mdx` "Flow editor shortcuts": the flow editor read its rebound shortcuts (`flowKeymap`, `ebb-keymap-settings`) and synced display preferences (`ebbSyncedSettings`) once at startup, so a rebinding adopted from another device by the account merge (page load, refocus after the TTL, **Sync now**) or made in another tab only applied after a reload.

Goal: an open flow editor picks up those settings as soon as they land in `localStorage`.

Non-goals: a push channel from the server; syncing device-local display values (`flowsDir`, panel layout, collab toggles); changing the `/api/settings` `flow_editor_settings` path; reconciling the three overlapping keymap stores (`flowKeymap`, `ebbSyncedSettings`, `user_settings.flow_editor_settings`).

Acceptance criteria:
- [x] `useFlowSettingsLiveUpdate` (`packages/debate-flow/src/lib/config/settingsLiveUpdate.ts`), mounted by `AccountSettingsSync`, follows `storage` events on `ebb-keymap-settings` and `ebbSyncedSettings` (localStorage only)
- [x] The value is untrusted: validated with `normalizeFlowEditorSettingsPatch` (invalid fields dropped one by one), device-only keys never applied; only fields that differ from the open editor reach `applyAccountSettings`
- [x] A removed key / `localStorage.clear()` / unreadable JSON is ignored, never a reset
- [x] Vitest: `packages/debate-flow/test/settings-live-update.test.tsx` (10 cases). Checked by hand that removing the listener makes the hook test fail
- [x] Docs: `features/ui-navigation/user-settings.mdx` (Flow editor shortcuts: behaviour, engineering note, narrowed Known gap), `dev-docs/internals/tool-data-sync.mdx` Known gaps (fixed entry), catalog comment on `flowKeymap`
- [x] Verified 2026-11-15 on `master` `41348ac` + this branch (after `git submodule update --init`, `bun install`, `node scripts/sync-upstream.mjs` in `debate-editor` / `debate-tournaments`). No lint script is configured:
  - Focused: `bunx vitest run --config apps/debate-web/vitest.config.ts packages/debate-flow/test/settings-live-update.test.tsx`: 10/10 pass
  - `bun run typecheck`: 31/31 tasks pass
  - `bun run test`: 1196 files / 16083 tests pass (5 files / 19 tests skipped)
  - `bun run build:web`: 4/4 tasks pass
- [x] PR #1753 (commit `dc7145a`, tracker commit)

Follow-ups:
- [ ] (deferred, needs design) the flow editor's rebound shortcuts live in three synced places (`flowKeymap`, the `keymap` record of `ebbSyncedSettings`, and `user_settings.flow_editor_settings.keymapOverrides`); `loadKeymapOverrides` prefers `ebbSyncedSettings`. Collapsing them to one source would remove a class of disagreement between devices
