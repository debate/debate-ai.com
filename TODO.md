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
- [ ] Follow-up (deferred): personas for the practice-vs-AI coach; ~~remember the "Ask the coach" choice~~ (done 2026-11-14); custom coaching personas

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
- [ ] Follow-up (deferred, low priority): the practice-vs-AI coach picker, once it exists, gets its own surface id
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
- [ ] (deferred, low priority) the practice-vs-AI coach picker, once it exists, gets its own surface id
- [ ] (deferred, needs product decision) a Settings → General row listing remembered coaching styles, so users can see / reset them alongside other saved data
- [ ] (ready, small) Fix the stale root scripts: `build:web` / `dev:web` in the root `package.json` filter `@debate-ai/ai-web`, but `apps/debate-web` publishes as `@debate-ai/web`, so `bun run build:web` fails with "No package found". Check CI (`.github/workflows`) and `CLAUDE.md`, which point at the same scripts
