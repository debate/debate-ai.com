---
title: "Glossary"
---

# Glossary
Relevant source files
- [.gitignore](https://github.com/debate/debate-ai.com/blob/34937310/.gitignore)
- [CHANGELOG.md](https://github.com/debate/debate-ai.com/blob/34937310/CHANGELOG.md?plain=1)
- [README.md](https://github.com/debate/debate-ai.com/blob/34937310/README.md?plain=1)
- [TODO.md](https://github.com/debate/debate-ai.com/blob/34937310/TODO.md?plain=1)
- [apps/debate-ai.com/components/layout/CategoryDock.tsx](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/components/layout/CategoryDock.tsx)
- [apps/debate-ai.com/lib/offline-sw/app-file-list.ts](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/lib/offline-sw/app-file-list.ts)
- [apps/debate-ai.com/lib/offline-sw/version.ts](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/lib/offline-sw/version.ts)
- [apps/debate-ai.com/lib/stubs/canvas.ts](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/lib/stubs/canvas.ts)
- [apps/debate-ai.com/package.json](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/package.json)
- [apps/debate-ai.com/public/service-worker.js](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/public/service-worker.js)
- [apps/debate-ai.com/vite.config.ts](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/vite.config.ts)
- [bun.lock](https://github.com/debate/debate-ai.com/blob/34937310/bun.lock)
- [package.json](https://github.com/debate/debate-ai.com/blob/34937310/package.json)
- [packages/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/README.md?plain=1)
- [packages/debate-round/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round/README.md?plain=1)
- [packages/debate-round/src/index.ts](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round/src/index.ts)

This page provides definitions for codebase-specific terms, debate-specific jargon, and technical acronyms used throughout the Debate AI platform. It serves as a detailed reference for engineers to understand how domain-specific concepts map to technical implementations, including pertinent file and function pointers for deeper exploration.

---

## Core Modules (TRUTH Hierarchy)

The Debate AI platform is structured into five core modules representing distinct functional pillars, often called the **TRUTH** hierarchy (Topic Research Unified Tree Hierarchy). Each module corresponds to specialized features supporting the debate workflow.

| Term | Definition | Key Code Entities |
| --- | --- | --- |
| **CARDS** | Crowdsourced Annotated Research for Debating Solutions. The evidence search engine, card parsing, and annotation pipeline. | `apps/debate-ai.com/app/cards/`, `packages/debate-card-parser/`, `packages/debate-research-evidence/` |
| **FIAT** | Forum for Issue Analysis on Topics. The live round workspace including the flow spreadsheet, round management, and speech docs. | `apps/debate-ai.com/app/fiat/`, `packages/debate-round/`, `packages/debate-speech-writer/` |
| **LEARN** | Lectures from Educators, Archive of Rounds & Notes. Video library, searchable video grid, transcripts, and team rankings. | `apps/debate-ai.com/app/learn/`, `packages/debate-data-sync/` |
| **STREAM** | Search with Top Result Extraction & Answer Model. AI-enhanced web search and document summarization. | `apps/qwksearch/` (external QwkSearch app integration) |
| **REASON** | Research Editor for Annotated Summaries in Outline Notation. A ProseMirror-based rich text editor for debate case construction. | `apps/debate-ai.com/app/reason/`, `packages/debate-editor-cardmirror/`, `packages/debate-editor/` |

**Sources:**[README.md37-85](https://github.com/debate/debate-ai.com/blob/34937310/README.md?plain=1#L37-L85)

---

## Technical & Infrastructure Terms

### Build & Deployment

- **vinext**
A custom framework and build wrapper around Next.js that integrates Vite and Rollup bundling with SSR support and Cloudflare Workers deployment. It manages the build pipeline for the web app.*See*: [apps/debate-ai.com/package.json10-27](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/package.json#L10-L27)
- **Turbo (Turborepo)**
Monorepo orchestrator managing builds and dev scripts across packages and apps. It enables parallel builds and dev server runs with filtering by workspace.*See*: [package.json10-20](https://github.com/debate/debate-ai.com/blob/34937310/package.json#L10-L20)
- **D1**
Cloudflare's serverless SQLite-compatible database used for relational persistence of various entities like saved rounds, flows, users, and notifications.*See*: [apps/debate-ai.com/lib/database/schema.ts](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/lib/database/schema.ts)
- **PWA Service Worker**
Implements offline caching of static assets and network-first strategies for API calls to improve performance and offline support. Assets to cache are enumerated in `APP_FILE_LIST`. Versioning is tracked separately.*See*: [apps/debate-ai.com/public/service-worker.js](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/public/service-worker.js)[apps/debate-ai.com/lib/offline-sw/app-file-list.ts](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/lib/offline-sw/app-file-list.ts)[apps/debate-ai.com/lib/offline-sw/version.ts](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/lib/offline-sw/version.ts)

### Data Persistence & Search

- **IndexedDB (speech-send-log)**
Client-side storage used by the REASON editor to maintain an append-only log of speech document dispatches. Provides durability and replay capability across sessions.*See*: [docs/features/speech-document-target.md71-95](https://github.com/debate/debate-ai.com/blob/34937310/docs/features/speech-document-target.md?plain=1#L71-L95)
- **CMIR (.cmir)**
The native file format and codec for CardMirror, encoding debate document structure losslessly for round-tripping between formats (DOCX, CardMirror, etc.).*See*: [packages/debate-editor-cardmirror/README.md1](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-editor-cardmirror/README.md?plain=1#L1-L1)
- **TF-IDF Search Index**
An inverted-token index used in `debate-card-search` for relevance-ranked full-text card search. Queries the search API server for efficient evidence retrieval.*See*: [packages/debate-research-evidence/](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-research-evidence/)
- **localStorage (aiVersusRounds)**
A local browser storage namespace used for storing persisted practice round data such as turn order, AI versus round speech submissions, and settings.*See*: [packages/debate-round/src/state/aiVersusRounds.ts](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round/src/state/aiVersusRounds.ts)

**Sources:**[package.json1-38](https://github.com/debate/debate-ai.com/blob/34937310/package.json#L1-L38)[docs/features/speech-document-target.md71-95](https://github.com/debate/debate-ai.com/blob/34937310/docs/features/speech-document-target.md?plain=1#L71-L95)[apps/debate-ai.com/public/service-worker.js1](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/public/service-worker.js#L1-L1)[apps/debate-ai.com/lib/offline-sw/app-file-list.ts1-148](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/lib/offline-sw/app-file-list.ts#L1-L148)[apps/debate-ai.com/lib/offline-sw/version.ts1](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/lib/offline-sw/version.ts#L1-L1)[packages/debate-editor-cardmirror/README.md1](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-editor-cardmirror/README.md?plain=1#L1-L1)

---

## Debate Jargon & Implementation

### The Flow

- **Flow Spreadsheet**
The main UI for flowing (taking detailed debate notes), implemented as a multi-column ag-Grid spreadsheet. Each column corresponds to a speech in the round (e.g., 1AC, 1NC). Cells capture arguments or evidence snippets.*See*: [packages/debate-round/README.md3-4](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round/README.md?plain=1#L3-L4)
- **Box**
The atomic unit of flowing: a single marked argument or note in a specific flow spreadsheet cell.
- **Prep Note**
Private strategic notes attached to specific cells in the flow for speaker or coach reference. Managed via the `PrepNotesPanel`.*See*: [packages/debate-round/README.md11-13](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round/README.md?plain=1#L11-L13)
- **SpeechToFlow**
AI-assisted feature that parses a speech document and extracts argument claims to populate the flow spreadsheet automatically.*See*: [packages/debate-speech-writer/README.md10](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-speech-writer/README.md?plain=1#L10-L10)

### Evidence & Cards

- **Card**
A discrete unit of debate evidence consisting of a Tag (summary), Citation, and Body text. Cards are crowd-sourced and collaboratively maintained.*See*: [packages/debate-card-parser/README.md1](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-card-parser/README.md?plain=1#L1-L1)
- **CardMirror**
The ProseMirror-based rich-text editor engine powering the REASON editor. Implements a custom node and mark schema that models pockets, hats, blocks, cards, tags, citations, and the body of cards.*See*: [packages/debate-editor-cardmirror/README.md1](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-editor-cardmirror/README.md?plain=1#L1-L1)
- **Verbatim**
The legacy Microsoft Word macro system widely used in debate for formatting case texts (including marking citations, underlines, and emphasis). CardMirror supports feature-parity via keyboard shortcuts mapped to ribbon commands.*See*: [docs/features/legacy-verbatim-shortcuts.md33-48](https://github.com/debate/debate-ai.com/blob/34937310/docs/features/legacy-verbatim-shortcuts.md?plain=1#L33-L48)
- **Cutting / Highlighting**
The manual or AI-assisted process for marking essential text in evidence cards for rapid reading during rounds:

- Underlining: marks primary arguments.
- Bold/Emphasis: marks vital words for emphasis.*See*: [README.md40](https://github.com/debate/debate-ai.com/blob/34937310/README.md?plain=1#L40-L40)[docs/features/legacy-verbatim-shortcuts.md40](https://github.com/debate/debate-ai.com/blob/34937310/docs/features/legacy-verbatim-shortcuts.md?plain=1#L40-L40)

### Strategic Terms

- **Judge Paradigm**
An AI-encoded representation of a judge's style or decision-making preferences, used to simulate judge decisions and guide practice rounds.*See*: [packages/debate-round/README.md57-62](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round/README.md?plain=1#L57-L62)
- **Opponent Persona**
AI personality profiles configured for practice sparring in the Practice Round Simulator, influencing the AI opponent's style and argumentation pattern.*See*: [packages/debate-round/src/panels/AiVersusRoundPanel.tsx22-28](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round/src/panels/AiVersusRoundPanel.tsx#L22-L28)
- **Speech Document**
A designated panel or document pane in the editor that serves as the target for evidence dispatches or speech-building actions. References to a speech document emit updates to a durable IndexedDB log.*See*: [docs/features/speech-document-target.md28-38](https://github.com/debate/debate-ai.com/blob/34937310/docs/features/speech-document-target.md?plain=1#L28-L38)
- **TOC bid**
Tournament of Champions qualification points awarded to teams based on high placements in eligible tournaments. Used to calculate team rankings.*See*: [README.md77](https://github.com/debate/debate-ai.com/blob/34937310/README.md?plain=1#L77-L77)

**Sources:**[packages/debate-round/README.md1-85](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round/README.md?plain=1#L1-L85)[docs/features/legacy-verbatim-shortcuts.md33-52](https://github.com/debate/debate-ai.com/blob/34937310/docs/features/legacy-verbatim-shortcuts.md?plain=1#L33-L52)[docs/features/speech-document-target.md1-53](https://github.com/debate/debate-ai.com/blob/34937310/docs/features/speech-document-target.md?plain=1#L1-L53)[packages/debate-speech-writer/README.md10](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-speech-writer/README.md?plain=1#L10-L10)[packages/debate-card-parser/README.md1](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-card-parser/README.md?plain=1#L1-L1)[packages/debate-editor-cardmirror/README.md1](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-editor-cardmirror/README.md?plain=1#L1-L1)[README.md40](https://github.com/debate/debate-ai.com/blob/34937310/README.md?plain=1#L40-L40)[README.md77](https://github.com/debate/debate-ai.com/blob/34937310/README.md?plain=1#L77-L77)

---

## AI Practice & Coaching

### AI Versus Rounds

Turn-based sparring feature where the user competes against an AI opponent, alternating speech submissions.

- **AiVersusRoundRecord**
The persisted state of a practice "versus AI" round, including format, AI style key, and submitted speech texts.*See*: [packages/debate-round/src/panels/AiVersusRoundPanel.tsx89-90](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round/src/panels/AiVersusRoundPanel.tsx#L89-L90)
- **validateSpeechSubmission**
Logic enforcing the correct speech turn order for a format (1AC, 1NC, etc.) and preventing invalid submissions out of turn.*See*: [packages/debate-round/src/panels/AiVersusRoundPanel.tsx73](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round/src/panels/AiVersusRoundPanel.tsx#L73-L73)
- **requestAiVersusSpeech**
Client-side function invoking the `/api/reason-ai` API route to generate the AI opponent’s speech based on round context.*See*: [packages/debate-round/src/panels/AiVersusRoundPanel.tsx76](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round/src/panels/AiVersusRoundPanel.tsx#L76-L76)

### Coaching & Analysis

- **Vulnerability Charts**
AI-generated reports analyzing argument exposure for each side, showing the weakest points and potential strategic risks in the round.*See*: [packages/debate-round/README.md70-74](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round/README.md?plain=1#L70-L74)
- **Flow Summaries**
Post-round transcription summaries with suggested cross-examination questions and identification of unanswered arguments to aid coaching.*See*: [packages/debate-round/README.md34-38](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round/README.md?plain=1#L34-L38)

**Sources:**[packages/debate-round/src/panels/AiVersusRoundPanel.tsx1-90](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round/src/panels/AiVersusRoundPanel.tsx#L1-L90)[docs/features/ai-versus-rounds.md47-117](https://github.com/debate/debate-ai.com/blob/34937310/docs/features/ai-versus-rounds.md?plain=1#L47-L117)

---

## Gamification & Progress

- **Quest Streak**
A mechanic in the contributor progress system providing rewards for completing daily quests consecutively. It tracks and encourages consistent engagement by contributors.*See*: [TODO.md56](https://github.com/debate/debate-ai.com/blob/34937310/TODO.md?plain=1#L56-L56)
- **reuse_check_log**
An append-only audit trail recording all queries to `/api/evidence-reuse-check` for evidence reuse lookups. It enables analytics on evidence reuse across the team and has an automated retention policy managed by a scheduled worker.

- Retention: Entries older than 180 days are purged weekly.
- Manual purge can be triggered via admin.*See*: [TODO.md26-41](https://github.com/debate/debate-ai.com/blob/34937310/TODO.md?plain=1#L26-L41)

**Sources:**[TODO.md26-55](https://github.com/debate/debate-ai.com/blob/34937310/TODO.md?plain=1#L26-L55)

---

## Important Definitions with Code Links

| Term | Description | File/Lines Reference |
| --- | --- | --- |
| **CardMirror** | The ProseMirror schema and engine for debate documents, supporting nodes like pocket, hat, block, card, tags, citations, and body. | [packages/debate-editor-cardmirror/README.md1](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-editor-cardmirror/README.md?plain=1#L1-L1) |
| **ebb** | The local-first keyboard-driven debate flow editor package `debate-flow-ebb`, rendering the flow spreadsheet and managing cell metadata, event-driven layouts, and exports. | [packages/debate-flow-ebb/README.md](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-flow-ebb/README.md?plain=1) |
| **flow** | The data model of flows (debate notes) containing rounds/sheets and arguments organized into cells and columns. | [packages/debate-round/src/types/flow.ts](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round/src/types/flow.ts) |
| **box path** | The path or key identifying a box (argument cell) in the flow grid, formed by the (columnIndex,rowIndex) tuple. | [packages/debate-round/src/flow/flow-paths.ts](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round/src/flow/flow-paths.ts) |
| **card vs block** | Cards represent evidence units; blocks are schema nodes in CardMirror representing structure such as paragraph or card containers. | [packages/debate-editor-cardmirror/src/schema.ts](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-editor-cardmirror/src/schema.ts) |
| **paradigm** | Judge paradigm: AI profile capturing judge decision preferences used for AI coaching or practice rounds. | [packages/debate-round/src/state/judgeParadigms.ts](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round/src/state/judgeParadigms.ts) |
| **TOC bid** | Tournament of Champions bid points used in team rankings. | [README.md77](https://github.com/debate/debate-ai.com/blob/34937310/README.md?plain=1#L77-L77) |
| **vinext** | Custom Next.js/Vite build wrapper orchestrating SSR, routing, and Cloudflare Worker deployment. | [apps/debate-ai.com/package.json10-27](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/package.json#L10-L27) |
| **D1** | Cloudflare Workers serverless SQL database. | [apps/debate-ai.com/lib/database/schema.ts](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/lib/database/schema.ts) |
| **reuse check log** | Append-only log of all reuse check API lookups for auditing and team reuse reports. | [TODO.md26-41](https://github.com/debate/debate-ai.com/blob/34937310/TODO.md?plain=1#L26-L41) |
| **quest streak** | Consecutive day-completion tracking for gamified contributor quests. | [TODO.md56](https://github.com/debate/debate-ai.com/blob/34937310/TODO.md?plain=1#L56-L56) |
| **CardMirror Ribbon** | Command set in the CardMirror editor that maps keyboard shortcuts to inline formatting actions like citations and underlines. | [docs/features/legacy-verbatim-shortcuts.md38-52](https://github.com/debate/debate-ai.com/blob/34937310/docs/features/legacy-verbatim-shortcuts.md?plain=1#L38-L52) |
| **Speech Document Target** | The concept and mechanism whereby pieces of evidence are dispatched ('sent') from the editor into a dedicated speech document, updating storage and UI. | [docs/features/speech-document-target.md20-50](https://github.com/debate/debate-ai.com/blob/34937310/docs/features/speech-document-target.md?plain=1#L20-L50) |

---

## Data Flow Diagrams

### Bridging Natural Language Actions to Code Entities: CardMirror Speech Dispatch Flow

**Sources:**[docs/features/speech-document-target.md71-95](https://github.com/debate/debate-ai.com/blob/34937310/docs/features/speech-document-target.md?plain=1#L71-L95)

---

### Practice Round AI Versus Lifecycle: Natural Language Input to AI Generation

**Sources:**[packages/debate-round/src/panels/AiVersusRoundPanel.tsx112-180](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round/src/panels/AiVersusRoundPanel.tsx#L112-L180)[docs/features/ai-versus-rounds.md47-117](https://github.com/debate/debate-ai.com/blob/34937310/docs/features/ai-versus-rounds.md?plain=1#L47-L117)

---

### Argument Tree Auto-Sync: Flow Changes to Argument Tree Storage and UI Update

**Sources:**[docs/features/argument-tree-outline.md115-127](https://github.com/debate/debate-ai.com/blob/34937310/docs/features/argument-tree-outline.md?plain=1#L115-L127)

---

## Metadata & Reference Tables

### Verbatim Shortcut Key Mapping in CardMirror Editor

| Shortcut | Ribbon Command | Purpose | Source Location |
| --- | --- | --- | --- |
| `F8` | `applyCite` | Marks current selection as a Citation | [docs/features/legacy-verbatim-shortcuts.md41](https://github.com/debate/debate-ai.com/blob/34937310/docs/features/legacy-verbatim-shortcuts.md?plain=1#L41-L41) |
| `F9` | `applyUnderline` | Toggles Underline style on selection | [docs/features/legacy-verbatim-shortcuts.md42](https://github.com/debate/debate-ai.com/blob/34937310/docs/features/legacy-verbatim-shortcuts.md?plain=1#L42-L42) |
| `F10` | `applyEmphasis` | Applies Bold/Emphasis formatting | [docs/features/legacy-verbatim-shortcuts.md40](https://github.com/debate/debate-ai.com/blob/34937310/docs/features/legacy-verbatim-shortcuts.md?plain=1#L40-L40) |
| `F3` | `condenseDefault` | Shrinks non-underlined text (condense) | [docs/features/legacy-verbatim-shortcuts.md43](https://github.com/debate/debate-ai.com/blob/34937310/docs/features/legacy-verbatim-shortcuts.md?plain=1#L43-L43) |
| ``` | `sendToSpeech` | Dispatches current selection to Speech Document | [docs/features/speech-document-target.md41](https://github.com/debate/debate-ai.com/blob/34937310/docs/features/speech-document-target.md?plain=1#L41-L41) |
| `Mod-Alt-Up` | `moveContainerUp` | Moves card or container up in the structure | [docs/features/legacy-verbatim-shortcuts.md46](https://github.com/debate/debate-ai.com/blob/34937310/docs/features/legacy-verbatim-shortcuts.md?plain=1#L46-L46) |

**Sources:**[docs/features/legacy-verbatim-shortcuts.md38-52](https://github.com/debate/debate-ai.com/blob/34937310/docs/features/legacy-verbatim-shortcuts.md?plain=1#L38-L52)

---

This glossary consolidates key terms, architectural components, and debate jargon essential for navigating the Debate AI codebase. It bridges human domain knowledge with technical implementation and is intended for engineering onboarding and deep feature comprehension. For authoritative details, refer to the cited source files and lines.