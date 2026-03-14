<p align="center">
    <img src="./public/images/logo-collective-mind.png" width="300" height="300">
</p>

# 🎙️ Debate AI

> **The all-in-one competitive debate platform** — where AI meets argumentation

Empowering debaters in **Public Forum**, **Lincoln-Douglas**, **Policy**, and **NDT** with cutting-edge tools for research, flowing, video analysis, and team rankings. Everything you need to prep, compete, and win.

**🌐 Live:** [debate-ai.com](https://debate-ai.com/) · **📦 Alpha:** [alpha.debate-ai.com](https://alpha.debate-ai.com/)

---

## ⚡ Quick Start

```bash
# Clone and run (one command!)
bunx git0 debate/debate-ai.com
```

🚀 Server auto-starts at [http://localhost:3000](http://localhost:3000)

---

## 🚀 Features

### 📚 CARDS — Crowdsourced Research Arsenal

**The community's evidence library. By debaters, for debaters.**

- **Full-text search** across a crowdsourced dataset of tagged and annotated evidence cards
- **Three-panel desktop layout** — search sidebar, card reader, and AI analysis panel — all resizable
- **Card content viewer** with three reading modes: plain read, highlight, and underline
- **AI analysis sidebar** — generate LLM summaries, warrant extensions, logic-flaw detection, and argument placement suggestions (TRUTH hierarchy)
- **Mobile-responsive overlays** — full-screen sidebars for search and AI on small screens
- **Cite maker, flow integration, and Chrome sidebar** for in-browser research tagging and sharing

The long-term goal is a decentralized AI knowledge graph — a tree-of-thought reasoning dataset trained on the best arguments from many perspectives, reducing hallucination and steering alignment with common social values.

---

### 🎥 Videos — Tournament Archive

**Watch the best rounds. Learn from the champions.**

- **Infinite-scroll video grid** with responsive layout (1–4 columns)
- **Search and filter** by title, channel, year, and sort by recency or view count
- **Click any channel name** to instantly filter the grid to that channel's videos
- **Thumbnail previews** with inline YouTube playback (toggle on/off)
- **Favorites** — save videos with a star; filter to favorites-only view
- **Top Picks** — curated highlight reel toggle
- **Leaderboard / Rankings tab** — switch to the team rankings view directly from the dock

---

### 🏆 Rankings — National Leaderboard

**Track every team. From prelims to TOC.**
Historical and current standings across all divisions, powered by dual ranking systems.

#### 📊 Core Features

- **Divisions:** PF, LD, Policy (CX), NDT
- **Sortable columns:** rank, state, bids, TOC score, **Elo Rank**, **Elo Score**
- **Dual ranking system:**
  - TOC bid list rankings (current season)
  - DebateDrills Elo rankings (historical and current)
- **Year selector** spanning from 2001 to the current season
- **Season champion and topic** displayed for each division and year
- **Rank change indicators** (up/down chevrons) between seasons

#### 🧠 Smart Elo Integration

- 🔗 **Auto-matching** — seamlessly merges TOC + DebateDrills data
- ✨ **Name normalization:**
  - Detects: `"Campbell Hall Jared Bart & Alexandra Kosloff"`
  - Converts: `"Campbell Hall BK"` (last name initials)
  - Handles edge cases with manual overrides
- 📈 **Dual columns:**
  - **Elo Rk** → Your national Elo ranking
  - **Elo** → Your actual rating score
- 💡 **Interactive tooltip** — hover to learn how Elo is calculated

#### 📦 Data Sources

- ✅ **Current season:** TOC bid list + DebateDrills Elo
- 📚 **Historical:** DebateDrills archives (2001–present)
- 🔄 **Auto-sync:** Pulls latest from official GitHub repos

---

### 🎓 Lectures — Learning Hub

**Master the fundamentals. Sharpen advanced tactics.**

- 🔍 Full search + infinite scroll (same interface as Rounds)
- 📖 **Debate Dictionary** — toggle on for instant term definitions
- 🎯 Curated instructional content from top coaches

---

### 📝 Debate Workspace — The Flow Command Center

**Your digital flowing companion. From prep to podium.**
Everything you need to flow rounds, manage tournaments, and collaborate in real-time.

#### ⚡ FIAT — Flow Interconnected Argument Tree

- **Multi-column spreadsheet interface** with AG Grid
- **Debate format support:** PF, LD, Policy, NDT, and custom formats
- **Real-time flow editing** with keyboard shortcuts
- **Speech-specific columns** that adapt to debate format
- **Archive system** for managing multiple rounds
- **Flow history** with restore capability

#### 🎪 Round Management

**One dialog. Complete setup.**

- 🏟️ Tournament name + round level (Prelims → Finals)
- 👥 Team emails, school names, debater IDs
- ⚖️ Judge + spectator invitations
- 🔒 Public/private toggle
- 🏅 Winner declaration (post-round)

#### 🔗 Shareable Round URLs

**Every round gets its own permanent link.**
Share with teammates, judges, or coaches — or bookmark for later review.

```
https://debate-ai.com/debate/2025-glenbrooks/lynbrook-bz-monta-ey
```

**Features:**
- 📝 **Auto-generated titles:** `"2025 Glenbrooks - Octos - Lynbrook BZ vs Monta Vista EY"`
  - Format: `{Year} {Tournament} - {Round} - {Aff School} vs {Neg School}`
  - Updates browser tab title automatically
- 🔗 **SEO-optimized slugs:** Clean, readable URLs for sharing
  - Format: `{year}-{tournament}/{aff-school}-{neg-school}`
  - Auto-generated on round creation
  - Direct access — paste link, instantly load round state
- 🔄 **Live URL sync:** Address bar always reflects active round
  - Switch rounds → URL updates instantly
  - Create round → browser navigates to new URL
  - Refresh page → loads exact round from URL
  - Browser back/forward → seamlessly navigate round history

#### 📄 Speech Docs

- ✍️ **Markdown editor** built into each speech
- 📧 **Share via email** to judges/teammates
- 👁️ **View modes:** plain, highlights, quotes
- 💾 **Auto-save** (localStorage)

#### ⏱️ Smart Timers

- 🎯 **Format-aware** — PF, LD, Policy, NDT presets
- 🔔 **Audio + visual** alerts at time expiration
- 🔄 **Persistent** across view switches
- 📱 **Mobile-optimized** compact header display

#### 🤝 Collaboration

- 📬 **Email invites** for judges + spectators
- 🔐 **Private rounds** for practice sessions
- 📊 **Status tracking:** pending → active → completed

#### 📱 Mobile-First

- 📐 **Responsive** — adapts to any screen size
- 👆 **Swipe navigation** on touch devices
- 🎛️ **Sheet sidebars** for tools and settings
- ⚡ **Compact UI** optimized for on-the-go flowing

---

### 📃 Docs — Markdown Editor

**Write blocks. Format evidence. Export flows.**

- 📝 Full markdown support for evidence cards
- 🎨 Rich formatting for blocks and briefs
- 🧭 Quick access from navigation dock

---

## 🧭 Navigation

**Always-accessible dock** — one click to any section:

| Icon | Section | Feature |
| ---- | ------- | ------- |
| 📚 | **CARDS** | Research + evidence search |
| 📝 | **Debate** | Flow workspace |
| 📃 | **Docs** | Markdown editor |
| 🎥 | **Videos** | Round library |
| 🎓 | **Lectures** | Learning hub + dictionary |

💡 **Contextual expansion:** On Videos page, a **Rankings** button auto-appears in dock.

📍 **Adaptive positioning:**
- 🖥️ **Desktop:** Fixed top-left corner
- 📱 **Mobile:** Fixed bottom bar

---

## 🗺️ Routing Architecture

### 📍 Static Routes
| Path | Page | Purpose |
| ---- | ---- | ------- |
| `/` | 🏠 Home | Feature overview + onboarding |
| `/cards` | 📚 CARDS | Evidence search |
| `/debate` | 📝 Workspace | Flow interface |
| `/docs` | 📃 Editor | Document creation |
| `/videos` | 🎥 Library | Round videos |
| `/lectures` | 🎓 Learning | Educational content |

### 🔗 Dynamic Routes
```
/debate/[tournament]/[teams]
```

**Example:**
```
https://debate-ai.com/debate/2025-glenbrooks/lynbrook-bz-monta-ey
                               └─┬─┘ └────┬────┘  └───┬──┘ └──┬──┘
                               year   tournament     aff     neg
```

**What happens:**
- ✅ Loads round state from slug
- ✅ Activates corresponding flows
- ✅ Updates document title
- ✅ Enables sharing via link

### 🔤 Slug Normalization

**Transformation pipeline:**

1️⃣ **Input:** `"2025 Glenbrooks Tournament"`
2️⃣ **Lowercase:** `"2025 glenbrooks tournament"`
3️⃣ **Replace special chars:** `"2025-glenbrooks-tournament"`
4️⃣ **Trim hyphens:** `"2025-glenbrooks-tournament"` ✅

**Team names:**
```
"Lynbrook BZ" → "lynbrook-bz"
"Monta Vista EY" → "monta-vista-ey"
```

**Final slug:**
```
2025-glenbrooks/lynbrook-bz-monta-ey
```

---

## 🛠️ Tech Stack

### ⚛️ Frontend

- **Framework:** Next.js 16 (App Router) with React Server Components
- **Language:** TypeScript with strict type checking
- **Styling:** Tailwind CSS with custom design system
- **State Management:** Zustand for global state (flows, rounds, settings)
- **UI Components:**
  - Radix UI primitives (Dialog, Select, Tabs, Tooltip, etc.)
  - AG Grid for flow spreadsheet
  - Custom components for debate-specific features
- **Markdown:**
  - Editor: Custom virtualized markdown editor
  - Parsing: markdown-it with extensions
  - Rendering: Server-side and client-side
- **Routing:** Dynamic routes with catch-all patterns for round URLs

### Backend & Data

- **Runtime:** Next.js API routes
- **AI:** LLM integration for card analysis, warrant extension, and research recommendations
- **Data Sources:**
  - Crowdsourced evidence dataset (CARDS)
  - YouTube video index with metadata
  - TOC bid list (current season rankings)
  - DebateDrills Elo rankings (GitHub sync)
  - Historical debate data (2001-present)
- **Data Fetching:** `grab-url` for optimized HTTP requests
- **Storage:**
  - localStorage for flows, rounds, and user preferences
  - Server-side data caching

### Key Features Implementation

#### Elo Rating System
- **Data normalization:** Smart matching between TOC and DebateDrills formats
- **Auto-detection:** Converts full names to initials (e.g., "FirstName LastName" → "FL")
- **Manual mappings:** Configurable overrides for edge cases
- **Dual display:** Separate columns for Elo rank and score

#### Round URL System
- **Title generation:** `generateRoundTitle()` function in types
- **Slug generation:** `generateRoundSlug()` with URL sanitization
- **Bidirectional sync:**
  - `useRoundFromSlug`: Load round from URL
  - `useSyncUrlWithRound`: Update URL when round changes
- **History integration:** Browser back/forward support
- **Memoization:** Prevents infinite loops and unnecessary re-renders

#### Flow Management
- **Archive system:** Multiple rounds with active/archived state
- **Persistence:** Auto-save to localStorage
- **Real-time updates:** Immediate UI feedback
- **History tracking:** Restore previous round states

### Performance Optimizations

- **Code splitting:** Dynamic imports for heavy components
- **Virtualization:** Large lists and markdown editor
- **Memoization:** React hooks (useMemo, useCallback) throughout
- **Debouncing:** Search inputs and auto-save
- **Lazy loading:** Images and video thumbnails
- **Caching:** API responses and static data

### Development Tools

- **Package Manager:** Bun (faster than npm/yarn)
- **Linting:** ESLint with TypeScript rules
- **Formatting:** Prettier (via IDE/linter)
- **Type Checking:** TypeScript compiler with strict mode

---

## External Links

- [AI Government Plan](docs/collective-consciousness-government.md)
- [Live Site](https://debate-ai.com/)
- [Earlier Prototype](https://alpha.debate-ai.com/)
