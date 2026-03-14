<p align="center">
    <img src="./public/images/logo-collective-mind.png" width="300" height="300">
</p>

# Debate AI

AI-powered platform for competitive debaters in Public Forum (PF), Lincoln-Douglas (LD), Policy, and NDT. Combines crowdsourced research, video analytics, team rankings, and AI analysis into a single workspace.

**Live site:** [debate-ai.com](https://debate-ai.com/) · [Earlier prototype](https://alpha.debate-ai.com/)

---

## Quick Start

```bash
# Clone and setup
bunx git0 debate/debate-ai.com

# Install dependencies and run dev server
bun install
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## What's New

### 🎯 Shareable Round URLs
Every debate round now gets a unique, shareable URL:
- **Format:** `debate-ai.com/debate/2025-glenbrooks/lynbrook-bz-monta-ey`
- **Auto-generated** from tournament, schools, and year
- **SEO-friendly** with proper metadata
- **Direct navigation** - visit URL to load exact round state

### 📊 Enhanced Rankings with Dual Elo Columns
- **Elo Rank** and **Elo Score** now displayed separately
- **Smart name matching** between TOC and DebateDrills data
- **Auto-detection** of full debater names → converts to initials
- **Historical data** from 2001 to current season

### 🔗 Automatic URL Synchronization
- Browser URL **always reflects** the active round
- Switch rounds → URL updates automatically
- Create round → navigates to round's URL
- Refresh page → loads correct round from URL

---

## Features

### CARDS — Crowdsourced Annotated Research Dataset

A collaborative evidence library built by the debate community.

- **Full-text search** across a crowdsourced dataset of tagged and annotated evidence cards
- **Three-panel desktop layout** — search sidebar, card reader, and AI analysis panel — all resizable
- **Card content viewer** with three reading modes: plain read, highlight, and underline
- **AI analysis sidebar** — generate LLM summaries, warrant extensions, logic-flaw detection, and argument placement suggestions (TRUTH hierarchy)
- **Mobile-responsive overlays** — full-screen sidebars for search and AI on small screens
- **Cite maker, flow integration, and Chrome sidebar** for in-browser research tagging and sharing

The long-term goal is a decentralized AI knowledge graph — a tree-of-thought reasoning dataset trained on the best arguments from many perspectives, reducing hallucination and steering alignment with common social values.

---

### Videos — Debate Round Library

Browse and filter a curated library of competitive debate round recordings.

- **Infinite-scroll video grid** with responsive layout (1–4 columns)
- **Search and filter** by title, channel, year, and sort by recency or view count
- **Click any channel name** to instantly filter the grid to that channel's videos
- **Thumbnail previews** with inline YouTube playback (toggle on/off)
- **Favorites** — save videos with a star; filter to favorites-only view
- **Top Picks** — curated highlight reel toggle
- **Leaderboard / Rankings tab** — switch to the team rankings view directly from the dock

---

### Rankings — Competitive Team Leaderboard

Historical and current season standings across all four divisions with integrated Elo ratings.

#### Features

- **Divisions:** PF, LD, Policy (CX), NDT
- **Sortable columns:** rank, state, bids, TOC score, **Elo Rank**, **Elo Score**
- **Dual ranking system:**
  - TOC bid list rankings (current season)
  - DebateDrills Elo rankings (historical and current)
- **Year selector** spanning from 2001 to the current season
- **Season champion and topic** displayed for each division and year
- **Rank change indicators** (up/down chevrons) between seasons

#### Elo Integration

- **Automatic team matching** between TOC bid list and DebateDrills data
- **Smart name normalization:**
  - Auto-detects full debater names (e.g., "Campbell Hall Jared Bart & Alexandra Kosloff")
  - Converts to standard initials format (e.g., "Campbell Hall BK")
  - Manual mappings for edge cases
- **Separate Elo columns:**
  - **Elo Rk:** Team's rank in DebateDrills system
  - **Elo:** Actual Elo rating score
- **Tooltip explanation** of how Debate Elo is calculated

#### Data Sources

- Current season: TOC bid list + DebateDrills Elo
- Historical seasons: DebateDrills Elo rankings
- Syncs from official GitHub repositories

---

### Lectures — Educational Video Library

A dedicated section for instructional and lecture-style debate videos.

- Same search, filter, and infinite-scroll interface as the round videos
- **Debate Dictionary** toggle — a searchable glossary of debate terminology with definitions, accessible directly from the lectures page

---

### Debate Workspace — Flow-Based Debate Management

A comprehensive workspace for flowing debates, managing rounds, and collaborating with judges and teammates.

#### Flow System (FIAT - Flow Interconnected Argument Tree)

- **Multi-column spreadsheet interface** with AG Grid
- **Debate format support:** PF, LD, Policy, NDT, and custom formats
- **Real-time flow editing** with keyboard shortcuts
- **Speech-specific columns** that adapt to debate format
- **Archive system** for managing multiple rounds
- **Flow history** with restore capability

#### Round Management

- **Create Round Dialog** with comprehensive setup:
  - Tournament name and round level (Prelims, Octos, Quarters, etc.)
  - Team debater emails and school names
  - Judge and spectator invitations
  - Public/private visibility toggle
  - Winner declaration (post-round)

#### Automatic Round Titling & URL Generation

- **Auto-generated titles:** `"2025 Glenbrooks - Octos - Lynbrook BZ vs Monta Vista EY"`
  - Format: `{Year} {Tournament} - {Round} - {Aff School} vs {Neg School}`
  - Updates browser tab title
- **SEO-friendly URL slugs:** `debate-ai.com/debate/2025-glenbrooks/lynbrook-bz-monta-ey`
  - Format: `{year}-{tournament}/{aff-school}-{neg-school}`
  - Automatically generated on round creation
  - Shareable links to specific rounds
- **Dynamic URL syncing:**
  - URL updates when switching between rounds
  - Direct navigation via URL loads correct round
  - Browser history integration

#### Speech Documents

- **Integrated markdown editor** for each speech
- **Share speeches** with judges and teammates via email
- **View modes:** plain, highlights, quotes
- **Auto-save** to localStorage

#### Debate Timers

- **Format-specific timers** for constructives, rebuttals, crossfire, prep time
- **Visual and audio alerts** at time expiration
- **Persistent across view switches**
- **Mobile-optimized** compact display

#### Collaboration Features

- **Email invitations** for judges and spectators
- **Private rounds** option for practice
- **Round status tracking:** pending, active, completed

#### Mobile Experience

- **Responsive design** with mobile-first approach
- **Swipeable column navigation** on touch devices
- **Sheet-based sidebars** for tools and settings
- **Compact timer display** in header

---

### Docs — Document Editor

- Full markdown editor for writing and formatting evidence, blocks, and flows
- Accessible from the main navigation dock

---

## Navigation

A persistent **dock** provides one-click access to all sections:

| Icon     | Section                      |
| -------- | ---------------------------- |
| Shared   | CARDS research search        |
| Debate   | Debate workspace             |
| Docs     | Document editor              |
| Videos   | Round video library          |
| Lectures | Lecture library + dictionary |

On the Videos page, a **Rankings** icon is appended to the dock for instant access to the leaderboard without leaving the videos context.

The dock adapts to screen size: fixed top-left on desktop, fixed bottom bar on mobile.

---

## Routing Architecture

### Static Routes
- `/` - Home page with feature overview
- `/cards` - CARDS research search
- `/debate` - Debate workspace (flow interface)
- `/docs` - Document editor
- `/videos` - Round video library
- `/lectures` - Educational video library

### Dynamic Routes
- `/debate/[tournament]/[teams]` - Specific debate round
  - Example: `/debate/2025-glenbrooks/lynbrook-bz-monta-ey`
  - Loads round state from URL slug
  - Activates corresponding flows
  - Updates document title

### URL Slug Format
```
{year}-{tournament}/{aff-school}-{neg-school}
```

**Example transformations:**
- Tournament: "Glenbrooks" → "glenbrooks"
- School: "Lynbrook BZ" → "lynbrook-bz"
- Full slug: "2025-glenbrooks/lynbrook-bz-monta-ey"

**Normalization:**
- Lowercase
- Replace special characters with hyphens
- Remove leading/trailing hyphens
- URL-safe encoding

---

## Tech Stack

### Frontend

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
