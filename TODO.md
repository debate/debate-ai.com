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

### **Argument Visualization & Mind Mapping**

- **Description**: Visual representation of debate structure - claim trees, evidence links, rebuttal chains, and argument maps
- **Tech Stack**: D3.js, Cytoscape.js, or React Flow for interactive graphs, export to image/PDF
- **Difficulty**: Medium-High
- **Good First Issue**: Build a simple claim-evidence tree component with expand/collapse

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

## Account sync of tools (Completed)

- [x] Speech-doc links (editor document <-> round/flow speech) sync via the `speechDocLinks` tool-record collection
- [x] Pinned debates - synced via the `pinnedDebates` tool-record collection
- [x] Surface the Tool data sync status where each tool is used (tool page header badge)

---

---

## Contribution Guidelines

1. **Pick an issue** or propose your own - comment on the issue to claim it
2. **Start small** - break large features into PR-sized chunks
3. **Write tests** - aim for &gt;80% coverage on new code
4. **Follow code style** - run linting/formatting before submitting
5. **Update docs** - README, API docs, and in-code comments
---




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

- **[CardMirror](https://github.com/debate/cardmirror)** ProseMirror engine, packing
roughly 500 editing commands into ~30 thematic groups. Highlights (full 50+ feature list in the
[package README](./packages/debate-editor/README.md#cardmirror-features)):
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

## Crowdsourced Research 

- [Evidence Library](https://debate-ai.com/cards/library) — Search shared cut cards and reusable analytics by keyword, citation, argument, topic, or tag.
- [Argument Library](https://debate-ai.com/cards/argument-library) — Browse shared research through topic folders, case areas, and tag-based collections.
- [Contributions Feed](https://debate-ai.com/cards/contributions) — Submit, like, save, and endorse community cards, summaries, highlights, and annotations.
- [LLM Card Scoring](https://debate-ai.com/cards/scoring) — Score cards for relevance, clarity, uniqueness, evidence quality, and usability.
- [Revision Incentives](https://debate-ai.com/cards/revisions) — Reward and rank improvements to weak cards, citations, and stale evidence.
- [Review Queue](https://debate-ai.com/cards/reviews) — Move cards through draft, review, requested changes, approval, and publication.
- [Topic Coverage Dashboard](https://debate-ai.com/cards/coverage) — Identify missing, thin, covered, and untracked arguments by card and word count.
- [Task Inbox](https://debate-ai.com/cards/inbox) — Review research tasks routed to contributors and organized by topic.
- [Collaboration Prep Room](https://debate-ai.com/cards/prep-room) — Share a topic-specific prep space for evidence, draft blocks, tasks, and active teammates.
- [Team Collaboration Mode](https://debate-ai.com/cards/collaboration) — Leave, assign, and track live prep notes during shared topic sprints.
- [Prep Notes](https://debate-ai.com/prep-notes) — Maintain live prep notes grouped into needs-follow-up, open, and covered status.
- [Contacts](https://debate-ai.com/contacts) — Keep an account-linked contacts list (requests, blocking, who's online) and share the document you're editing as a live co-editing card straight to a contact's account.
- [Notifications](https://debate-ai.com/notifications) — See and mark read notifications for prep-note assignments and activity.
- [Team Brainstorm Assist](https://debate-ai.com/cards/brainstorm) — Submit, seed, organize, and upvote ideas for arguments, impacts, frontlines, and turns.
- [Group Challenges](https://debate-ai.com/cards/group-challenges) — Create squad challenges based on contributions or recorded rebuttal wins.
- [Research Progress](https://debate-ai.com/cards/progress-tracking) — Review contribution history, task-completion rates, and per-topic work progress.

## Community & Contributor Progress

- [Leaderboard](https://debate-ai.com/cards/leaderboard) — Rank contributors by helpfulness score, tier, badges, and quest streak.
- [News Stream](https://debate-ai.com/news) — View product updates, community announcements, Daily Best Card winners, and Contributor Award standings.
- [Contributor Awards](https://debate-ai.com/cards/awards) — See helpfulness-ranked category winners, such as best evidence finder and best explainer.
- [Daily Best Card](https://debate-ai.com/cards/best-card) — View the current highest-helpfulness card and prior daily winners.
- [Progress](https://debate-ai.com/cards/progress) — Track contributor tiers, badges, unlocked task levels, and daily-quest streaks.
- [Quest Streaks](https://debate-ai.com/cards/streaks) — View current and longest daily-quest streaks plus milestone badges.
- [Daily Quests](https://debate-ai.com/cards/quests) — Track team goals, such as finding solvency cards, against live same-day contributions.

## Practice & AI Rounds

- [Practice Drills](https://debate-ai.com/drills) — Run flow-derived overview, frontline, cross-examination, and collapse drills.
- [AI Coach Mode](https://debate-ai.com/coaching) — Generate extension, refutation, collapse, and weighing prompts from a round’s flow.
- [AI Judge Decision](https://debate-ai.com/judge-decision) — Generate an AI decision grounded in the selected judge paradigm and flow summary.
- [Word-Count Speeches](https://debate-ai.com/word-count) — Practice speeches under a maximum word count instead of a time limit.
- [Online Debate Versus AI](https://debate-ai.com/versus-ai) — Debate an AI opponent in real turn order using a chosen format and side.
- [Practice Round Simulator](https://debate-ai.com/practice-round) — Simulate a tournament round with a timer, AI judge paradigm, and AI opponent persona.
- [Speech Transcript Summaries](https://debate-ai.com/summaries) — Create per-argument flow summaries with cross-examination questions and extension ideas.
- [Argument Tree Outline](https://debate-ai.com/outline) — Browse and filter a structured outline of every argument in a round’s flow.
- [Flow Annotations](https://debate-ai.com/annotations) — Add timestamped annotations to individual flowed arguments while reviewing recordings.
- [AI Response-Outcome Charts](https://debate-ai.com/outcomes) — Analyze side exposure, vulnerable arguments, and hypothetical response paths in a flow.

## Scouting & Round Strategy

- [Judge Profiles](https://debate-ai.com/judges) — Review saved judges’ side-vote bias, speaker points, speed tolerance, and theory receptiveness.
- [Opponent Team Profiles](https://debate-ai.com/opponents) — Scout teams using records, side tendencies, common cases, and frequently used arguments.
- [Pre-Round Briefings](https://debate-ai.com/briefings) — Combine judge and opponent scouting, head-to-head records, and team prep notes for an upcoming round.
- [Scout-to-Strategy](https://debate-ai.com/strategy) — Convert scouting and judge tendencies into ranked case options and matchup-risk assessments.
- [Team Rankings](https://debate-ai.com/rank) — Browse debate-team rankings, leaderboards, and Elo ratings.
- [Coaching Programs](https://debate-ai.com/coaching-programs) — Run roster-scoped group coaching spaces with topic sprints, challenges, and drills.
- [Coach Materials](https://debate-ai.com/coach-materials) — Upload or dictate grounding material for the team coach AI and preview relevant sources.

