# File Tree - Core Source Files

## app/ Pages & API Routes

- `app/layout.tsx` — Root HTML layout with theme provider, app sidebar, and responsive content area	
- `app/page.tsx` — Home page redirect to cards section
- `app/globals.css` — Global CSS variables, theme colors, spacing, and custom animationss
- `app/themes.css` — Preset color theme definitions (modern-minimal, cyberpunk, mocha-mousse, etc.)
- `app/debate/page.tsx` — Debate round FIAT flow interface page wrapper
- `app/edit/page.tsx` — Embedded iFrame redirecting to external editor at qwksearch.com
- `app/cards/page.tsx` — Shared research CARDS search interface page
- `app/cards/layout.tsx` — Layout wrapper for cards section with metadata
- `app/rank/page.tsx` — Team rankings and leaderboard display page
- `app/videos/page.tsx` — Debate videos browsing with archives and lectures
- `app/api/analyze/route.ts` — LLM-powered card analysis endpoint using Groq with flaw-finding prompts
- `app/api/dictionary/route.ts` — Debate terminology glossary endpoint
- `app/api/history/route.ts` — Historical debate topics and championship data endpoint
- `app/api/leaderboard/route.ts` — Team rankings scraper with fuzzy matching across DebateDrills and TOC sources
- `app/api/schools/route.ts` — School name search with Fuse.js fuzzy matching across debate formats
- `app/api/search/route.ts` — Demo evidence search endpoint with sample research cards
- `app/api/sync-videos/route.ts` — YouTube debate rounds synchronization trigger endpoint
- `app/api/tournaments/route.ts` — Tournament name search endpoint with Fuse.js filtering
- `app/api/videos/route.ts` — Combined videos, rounds, lectures, topics, and champions data endpoint

## components/debate/DebateRound/

### Main Panel

- `DebateRoundPanel.tsx` — Master debate flow page orchestrating layout, hooks, dialogs, and state management
- `Flow/FlowSpreadsheet.tsx` — AG Grid spreadsheet for debate flowing with custom headers and drag-to-edit cells

### DebateTimer/

- `debate-format-times.ts` — Debate style configurations with speech timings and column structures
- `PrepTimer.tsx` — Editable countdown timer for prep time with color coding and sound effects
- `SpeechTimer.tsx` — Debate speech timer with dropdown selection, editable times, and mic integration

### dialogs/CreateRoundDialog/

- `RoundEditorDialog.tsx` — Comprehensive round creation dialog delegating to form hook and composable sections
- `constants.ts` — Constants for round levels (prelim 1-8, doubles, finals)
- `useRoundEditorForm.ts` — State management hook for round form with debaters, judges, and settings
- `DebateStyleSection.tsx` — Dropdown selector for debate format (Policy, LD, PF, etc.)
- `TeamSection.tsx` — Team information input with school autocomplete and my-team checkbox
- `TournamentSection.tsx` — Tournament autocomplete, round level, and debate style selection
- `JudgesSection.tsx` — Dynamic judge email list with add/remove controls
- `SpectatorsSection.tsx` — Dynamic spectator email list with add/remove controls (optional)
- `WinnerSection.tsx` — Dropdown for round winner selection (Aff, Neg, or Undecided)
- `index.ts` — Barrel export for CreateRoundDialog

### dialogs/ (other)

- `FileExportDialog.tsx` — Flow import/export with JSON download and upload functionality
- `FlowHistoryDialog.tsx` — Searchable historical rounds browser with flow loading and editing

### controls/

- `ColumnNavigator.tsx` — Previous/next column navigation buttons for AG Grid spreadsheet
- `QuickActionsBar.tsx` — Quick action buttons for flow, history, split mode, and round editing
- `SplitModeToolbar.tsx` — Split view controls with navigation, view mode selection, and quote toggle
- `ViewModeSelector.tsx` — Dropdown menu for selecting content view mode (read, highlighted, underlined, etc.)

### hooks/

- `useColumnNavigation.ts` — AG Grid column navigation handlers for left/right keyboard-style movement
- `useDebateFlowState.ts` — Centralized state management for dialogs, speech panels, and split mode
- `useFlowEffects.ts` — Initialization, persistence, and cleanup effects for flows and rounds
- `useFlowHandlers.ts` — Memoized handlers for creating, deleting, and selecting flows
- `useMobileDetection.ts` — Viewport width detection hook for responsive mobile/desktop switching
- `useSpeechHandlers.ts` — Handlers for speech document updates and sharing via email
- `useSplitModeHandlers.ts` — Split-view state and navigation for side-by-side speech comparison
- `useTimerState.ts` — Centralized timer state management for both speech and prep timers

### layout/

- `FlowMainContent.tsx` — Main content container switching between spreadsheet and split markdown editors
- `FlowPageHeader.tsx` — Mobile header with hamburger menu, column navigation, and running timer display
- `FlowPageSidebar.tsx` — Sidebar with flow tabs, prep timer, quick actions, and mobile detection
- `SpeechDocPanel.tsx` — Full-height speech document editor panel with view controls and share functionality
- `SpeechHeaderBar.tsx` — Header for speech columns with timer controls and recording management

### navigation/

- `FlowTab.tsx` — Draggable/editable flow tab with rename, archive, and delete actions

### SpeechRecorder/

- `audio-player.tsx` — Context-based audio player with playback rate, seeking, and volume control
- `live-waveform.tsx` — Canvas-based real-time audio waveform visualizer with frequency analysis
- `mic-selector.tsx` — Microphone input selector with device enumeration and live waveform preview
- `SpeechRecordingPlayer.tsx` — Recording storage and playback UI for debate speeches

## components/debate/DebateVideos/

### panels/

- `DebateVideosPanel.tsx` — Main videos page orchestrating state, fetching, filtering, and category panels
- `DictionaryPanel.tsx` — Searchable debate terminology glossary with term definitions
- `RankingsLeaderboardPanel.tsx` — Team leaderboard with multiple divisions (VPF, VLD, VCX, NDT) and sorting

### components/

- `CategoryDock.tsx` — Navigation dock with category icons (debates, lectures, dictionary, leaderboard)
- `VideoGrid.tsx` — Responsive grid rendering video cards with play, star, and share buttons
- `VideoPagination.tsx` — Previous/next pagination controls with current page indicator
- `VideoSearchBar.tsx` — Search input with sort order, year filter, thumbnail toggle, and favorites

### hooks/

- `useInfiniteScroll.ts` — Intersection observer for infinite scroll pagination on video grid
- `useVideoData.ts` — Video fetching and filtering with Fuse.js search and category management
- `useVideoState.ts` — Centralized state for videos, pagination, filtering, and favorites

## components/debate/SharedResearch/

- `AiAnalysisSidebar.tsx` — AI analysis tools panel with custom prompts and LLM integration
- `CardContentViewer.tsx` — Full evidence card viewer with view modes and year-based color coding
- `IntroTextOverview.tsx` — Landing page for CARDS platform with overview, features, and vision statement
- `ResearchSearchSidebar.tsx` — Advanced search sidebar with filtering by year, school, tournament, and event
- `SearchInterface.tsx` — Main CARDS search page composing sidebar, content viewer, and AI analysis
- `SearchResultCard.tsx` — Compact search result card with citations and read/word count metrics
- `types.ts` — TypeScript interface definitions for search results and evidence cards

## components/markdown/

- `markdown-editor.tsx` — Lexical-based markdown editor with HTML conversion, auto-save, and multiple view modes
- `markdown-toolbar.tsx` — Rich formatting toolbar with text formatting, lists, images, links, and undo/redo
- `QuoteView.tsx` — Hierarchical collapsible quote card view parsed from HTML with heading sections
- `quote-view-utils.tsx` — HTML parsing utilities for converting HTML to structured quote card objects
- `quote-view.css` — Styles for quote view cards
- `EditableQuoteCard.tsx` — Individual quote card component with inline editing and keyboard controls
- `LexicalQuotesPlugin.tsx` — Lexical plugin mirroring editor HTML into live quote card rendering
- `unified-markdown.tsx` — Streamdown markdown renderer with styled components for all markdown elements
- `use-editor-virtualization.tsx` — Virtualization hook for large document performance optimization
- `virtualized-editor.tsx` — Optimized Lexical editor wrapper with viewport-based and chunked rendering

## components/ Top-Level

- `app-sidebar.tsx` — Main navigation sidebar with links, theme toggle, and user menu (desktop and mobile dock)
- `theme-dropdown.tsx` — Theme color palette selector with 15+ themes and light/dark mode toggle
- `theme-provider.tsx` — Wrapper around next-themes ThemeProvider for app-wide light/dark support
- `icons/index.ts` — Custom icon exports (SVG and PNG) for app navigation and UI elements

## components/ui/ (Shadcn)

- `alert-dialog.tsx` — Alert dialog primitive
- `autocomplete.tsx` — Autocomplete input with suggestions
- `avatar.tsx` — Avatar image component
- `badge.tsx` — Badge/tag component
- `button.tsx` — Button component with variants
- `card.tsx` — Card container component
- `command.tsx` — Command palette/menu component
- `dialog.tsx` — Dialog/modal component
- `dock.tsx` — Floating dock navigation component
- `dropdown-menu.tsx` — Dropdown menu component
- `glowing-effect.tsx` — Animated glowing border effect
- `input.tsx` — Text input component
- `label.tsx` — Form label component
- `multi-select.tsx` — Multi-select dropdown component
- `popover.tsx` — Popover component
- `radio-group.tsx` — Radio group component
- `resizable.tsx` — Resizable panel component
- `scroll-area.tsx` — Custom scrollbar area component
- `select.tsx` — Select dropdown component
- `shatter-button.tsx` — Animated shatter-effect button
- `sheet.tsx` — Slide-out sheet/drawer component
- `skeleton.tsx` — Loading skeleton placeholder
- `slider.tsx` — Range slider component
- `switch.tsx` — Toggle switch component
- `tabs.tsx` — Tabbed interface component
- `textarea.tsx` — Textarea component
- `tooltip.tsx` — Tooltip component
- `voice-chat.tsx` — Voice chat interface component

## lib/

### Core Utilities

- `utils.ts` — Utility function cn() combining clsx and tailwind-merge for className composition
- `audio/sound-effects.ts` — Sound effect playback utility for timers and UI interactions

### card-parser/ — DOCX Evidence Card Parser

- `index.ts` — Public export surface for card parsing module
- `parsers/docx-to-html.ts` — DOCX-to-HTML conversion with style-aware rendering and heading extraction
- `parsers/html-to-cards.ts` — HTML-to-card parser with heading boundaries and citation metadata extraction
- `extractors/citation-extractor.ts` — Author/year citation parsing with organization vs. individual detection
- `extractors/file-name-parser.ts` — File name metadata extraction (category, topic, organization, year)
- `extractors/text-extractor.ts` — Extraction of highlighted and underlined text segments from HTML
- `human-name/author-splitter.ts` — Multi-author byline parsing (handles commas, "and", "&" separators)
- `human-name/human-name-recognizer.ts` — Human vs. organization name classification and citation generation
- `human-name/name-parser.ts` — Name parsing with qualification cleaning and part extraction
- `human-name/is-organization.ts` — Heuristics for detecting organizational entities vs. individual names
- `human-name/constants.ts` — Common words and organization keywords for classification
- `human-name/human-names-92k.json` — 92k human name dataset for name recognition
- `utils/card-utils.ts` — Card normalization, validation, and color coding utilities
- `utils/format-profiles.ts` — Parsing profiles with heuristics for different document formats
- `types/types.ts` — TypeScript definitions for cards, citations, and parsing metadata
- `ai-analyze/analyze-quotes.ts` — AI-powered quote analysis with LLM integration
- `docs/docx-args-format.md` — Documentation for DOCX to ARGS format conversion

### state/ — Client State Management

- `store.ts` — Zustand-based flow store with persistence, history, and round management
- `settings.ts` — Settings manager with localStorage persistence and subscription callbacks
- `history.ts` — Historical flow snapshots with versioning
- `myTeamProfile.ts` — Team profile storage and retrieval

### types/ — TypeScript Type Definitions

- `debate-flow.ts` — Types for debate flow page state and view modes
- `debate.ts` — Core types (Flow, Round, Box, TimerSpeech, etc.) for debate functionality
- `settings.ts` — Settings type definitions
- `videos.ts` — Types for video data and categories

### utils/

- `flow-utils.ts` — Utility functions for creating new flows and boxes with debate style config
- `storage-utils.ts` — localStorage helpers for speech documents and cleanup

### third-party-sync/ — External Data Scrapers

- `sync-rankings-debatedrills.ts` — DebateDrills scraper for team Elo ratings and leaderboard data
- `sync-rankings-debateland.ts` — Debateland leaderboard scraper for division rankings
- `sync-rankings-tocbidlist.ts` — TOC bid list scraper for team bid counts and placements
- `sync-tournaments.ts` — Tabroom tournament list scraper
- `sync-youtube-rounds.ts` — YouTube debate rounds synchronization

## lib/debate-data/ — Static Data Files

- `debate-champions.json` — Historical debate champion records
- `debate-dictionary.json` — Debate terminology definitions
- `debate-lectures.json` — Curated debate lecture video links
- `debate-rounds-videos.json` — Debate round video catalog
- `debate-school-names.js` — School name mappings across debate formats
- `debate-topics.json` — Debate topic/resolution archive
- `debate-top-picks.json` — Featured/top-pick video selections
- `debate-tournaments.json` — Tournament names and metadata

## Config Files

- `package.json` — Dependencies, scripts, and project metadata for Next.js debate app
- `tsconfig.json` — TypeScript compiler configuration with path aliases
- `components.json` — Shadcn UI configuration with Tailwind CSS setup
- `types.d.ts` — Global type declarations for react-spreadsheet-grid module
