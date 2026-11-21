# Site fixes (Alexa, 2026-11-21)

Worked through one at a time; ticked when done on master. The daily school precompute was already on master (school_rankings_snapshots + school seasons); the school directory now rebuilds daily with it.

- [x] Video page copy menu: Chicago bibliography citation ("Video.", full posting date, running time)
- [x] "AI Write" label next to the Do the full speech button icon
- [x] Move Speech starts and Skip breaks next to Auto-scroll in the speech tabs
- [x] openCaselist: admin login that takes `username:password` as the key and logs in for the session cookie
- [x] Remove "Best season" from team pages
- [x] Video lengths show as `2:11`, not `2h 11m`
- [x] debate-openapi.yml: add the debate-tournaments package's API
- [x] School pages for every school in the last 10 seasons: valid unified slugs, aliases list, admin "Schools with missing info" section
- [x] Precompute every school's rankings and stats daily (recompute when older than a day) so pages load instantly
- [x] Greatest-of-all-time partners: every listed team links to its team page
- [x] New-video check also finds lectures (e.g. Michigan) and classifies new videos as rounds or lectures
- [x] Do not show the Organization submenu in the user menu
- [x] PF speech names: CF1 / CF2 / CF3 crossfires, and read YouTube timestamp lists like "1st Cross 1CF", "Aff Summary (1AR)"
- [x] University pages: NDT Shirley results before 2000 dropped from championship lists, counts and totals (still count for points)
- [x] Older college ratings on a 10-point scale, no Mu / Sigma columns
- [x] Rank change: snapshot ranking positions every 90 days and use that as the baseline for places moved
- [x] Rankings for all 4 formats: Elite 8 becomes Top 10 of the last decade
- [x] School page section labels get lucide icons or the tournament logo
- [x] School pages: videos in a scrolling marquee in the top banner row (newest first), removed from their current spot
- [x] Rename "Team Rankings" to "Policy Advocate National Rankings"
- [x] Remove the "You own the tech risk" and "Generative AI" items
- [x] Tournament pairings: click any judge for a modal with their extinction.gg judge info
- [x] Remove "Champion / Best finish" everywhere
- [x] Synergy docs reading mode: export as PDF, .docx, Markdown or Google Doc
- [x] Docs features sections: merge small pages into one page per section (keep Tournament admin as is)
- [x] High schools: Niche 2027 position as the only academics rank

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

###   **Offline Support**

- Service workers, IndexedDB for offline drafting, push notifications for debate updates

###  **Voice Debate Mode**

- Speech-to-text for arguments, text-to-speech for reading opponent arguments, voice activity detection

### \. **Debate Coaching AI Persona**

- Configurable AI personas (Socratic, Devil's Advocate, Fact-Checker) for practice sessions

### \. **Evidence Library & Citation Manager**

- Shared evidence database, auto-citation formatting, source credibility scoring

### \. **Analytics Dashboard for Debaters**

- Personal stats: win rate, fallacy frequency, argument length, topic expertise, improvement trends

1. ability to challenge legends - and speculators bet
2. random pair webcam debate matching on mutual pref topics




### 🎥 [LEARN](https://debate-ai.com/videos): Lectures from Educators, Archive of Rounds & Notes

- **3,600 debate videos**: about 2,700 recorded rounds and 900 lectures, free to watch
- **Every format**: ~1,450 college, ~525 Policy, ~510 Public Forum, and ~350 Lincoln-Douglas videos
- **~230 hand-picked top videos**: the highest-value rounds and lectures to study first
- **Search and filter** by title, channel, year, or view count
- **Keep watching while you work**: a persistent YouTube player with picture-in-picture

<p align="center">
    <img src="https://i.imgur.com/VbJF0Bx.png" width="300">
</p>

### 📚 [CARDS](https://debate-ai.com/research/cards): Crowdsourced Annotated Research for Debating Solutions

- **Full-text search** over millions of research quotes, in summaries, cites, highlighted text, or the full card
- **Scout what teams read**: filter by school, team, tournament, event, or year, and sort by how often a card was read in speeches
- **AI analysis per card**: summaries, logic flaws, and warrant extensions
- **Three reading modes**: plain text, highlighted, and underlined
- **Read the source beside the card**: pull the full article with a formatted citation, and see at a glance whether the link still works
- **[Research Workspace](https://debate-ai.com/research)**: the squad hub for topic coverage, the evidence library, the prep room, task routing, and peer review

<p align="center">
    <img src="https://i.imgur.com/1NBeQij.png" width="300">
</p>

### ⚖️ [FIAT](https://debate-ai.com/debate): Forum for Issue Analysis on Topic

- **Flow spreadsheet**: format-specific speech columns for PF, LD, Policy, and NDT, with inline editing and split view
- **Shareable rounds**: every round gets a permanent link, and judges and teammates can be invited to it
- **[Speech docs](https://debate-ai.com/speech-documents)**: send evidence into your speech doc as you prep and speak
- **Timers and recording**: format-aware speech and prep timers, plus an in-round recorder
- **[AI Judge Decision](https://debate-ai.com/practice/judge-decision)**: a decision grounded in the round's saved judge paradigm and flow summary
- **Saved rounds**: flows sync to your account, with round history and export

### 🤖 [Practice vs AI](https://debate-ai.com/practice/versus-ai): Debate an AI Opponent

- **Full timed rounds**: opening statements, cross-examination, and closing statements, ending in an AI-judged scorecard
- **13 opponent personas** across difficulty levels from Easy to Legends
- **Your topic, your arguments**: use the current topic or write your own resolution, then choose exactly which arguments each side runs
- **[Prep Workspace](https://debate-ai.com/practice/prep)**: pre-round briefings, scout-to-strategy, opponent and judge profiles, prep notes, and drills
- **[Coach Workspace](https://debate-ai.com/coaching)**: AI coach mode, coaching programs, a team calendar, and coach materials

<p align="center">
    <img width="300" src="https://i.imgur.com/pDvMC1Q.png" />
</p>

### 📝 [REASON](https://debate-ai.com/research/docs): Research Editor for Annotated Summaries in Outline Notation

Built on **[Debate Editor](https://github.com/debate/debate-editor)**, a ProseMirror engine. See the [full feature list](./packages/debate-editor/README.md#debate-editor-features).

- **Research chat beside your docs**: search the web and ask about your sources in tabs next to the document (formerly STREAM)
- **Structured outlines**: pockets, hats, blocks, tags, cards, and analytics as first-class parts of the document
- **Lossless `.docx` round-trip**: open and save Verbatim Word files, including encrypted and damaged ones
- **Real-time collaboration** with share codes, invite links, and version recovery
- **Built for the round**: mark a live speech doc and send cards to it, or straight to a flow column
- **AI tools**: a card cutter, AI citations, translation, and ask-about-selection
- **Command bar**: one search across cards, commands, settings, and files

### 🏆 Tournaments & Rankings

- **[Tournaments](https://debate-ai.com/tournaments)**: search live Tabroom tournaments by name, state, circuit, or event, then follow invitations, pairings, and results
- **Host your own** tournament on the site, and read judge paradigms before the round
- **[Team Rankings](https://debate-ai.com/coaching/rankings)**: every season since 2015-16 for PF, LD, Policy, and college, with Elo ratings, TOC bids, and aff/neg win rates
- **Team and school pages** with a matchup simulator

