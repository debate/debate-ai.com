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

## Account sync of tools (In Progress)

- [x] Speech-doc links (editor document <-> round/flow speech) sync via the `speechDocLinks` tool-record collection
- [ ] Pinned debates (`pinned-debates`, numeric round ids) - needs a `user_settings` op or an id-carrying record shape; blocked on a schema migration path since `drizzle/` was removed on purpose
- [ ] Surface the Tool data sync status where each tool is used, not only in settings

---

## Contribution Guidelines

1. **Pick an issue** or propose your own - comment on the issue to claim it
2. **Start small** - break large features into PR-sized chunks
3. **Write tests** - aim for &gt;80% coverage on new code
4. **Follow code style** - run linting/formatting before submitting
5. **Update docs** - README, API docs, and in-code comments
---

## In Progress

### Account-linked pinned debates (slice of "integrate tools + user settings + SQL-linked flows/docs/debates")

- **Branch**: `claude/gifted-babbage-a28l34`
- **Status**: Settings (`user_settings`), flows (`saved_flows`), rounds (`saved_rounds`), documents (`documents`), AI debates (`practice_vs_ai_debates`) and ~60 tool stores (`saved_tool_records`) already persist to D1 per user. The audit found the **pinned debates** list was still browser-only.
- [x] Store pins as `{ roundId, pinnedAt }` records (legacy `number[]` upgraded on read)
- [x] Add `pinnedDebates` to the tool-record sync catalog
- [x] Vitest coverage (`debate-round/test/pinnedDebates.test.ts`, catalog test)
- [x] Document in `features/user-settings.mdx`
- [ ] Follow-up: `speech-doc-links`, `ebb-dev-*` and `REASON-*` stores are still browser-only
- [ ] Follow-up: surface a "Saved to account" indicator on the flow tabs / start screen
