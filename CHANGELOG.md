# Changelog

# MVP Phase (2026)


## June 2026

Editor and parser milestone month. Integrated the **CardMirror engine** into a new **reason-editor** workspace package built on **TipTap/React**, then ported CardMirror's **AI editing tools** (cite, repair, explain, alt text). Implemented an **HTML-to-card parser** with citation extraction and metadata assembly. Added new server configuration and **session management hooks**. Hardened the build and deployment pipeline: fixed **Vercel** builds to run as a **Vite** app instead of failing Next.js detection, rebuilt the **PWA service worker** precache for the Vite build (fixing React #130 errors), declared missing workspace dependencies, and pinned loose dependency specifiers with an emotion alias fix. Simplified HTML extraction functions across several refactoring passes.

## May 2026

Research platform and rebranding push. Rebranded the project to **Debate-AI.com** and defined the core platform pillars — **CARDS**, **FIAT**, **LEARN** (renamed from DEARLY), **STREAM**, and **REASON**. Authored the **Debate Singularity** research paper on AI-driven argument reasoning and collective knowledge mapping, plus a companion theory paper, with a PDF route and expanded citations. Built the **LecturesPage** with category navigation, quick links, and **YouTube statistics** integration, and overhauled the video library with new **leaderboard** and **dictionary** panels. Ingested **NDCA 2026 LD rounds** with duplicate-video detection. Initialized **Lexical editor** integration with advanced plugins, custom nodes, and collaborative **Image, Poll, and Sticky** components backed by **yjs**. Extracted sync and data modules into a new **debate-data-sync** workspace package, moved the offline service worker to `lib/offline-sw`, and added dynamic `/videos/[category]` routing.

## April 2026

Flow tooling and archive maintenance. Implemented an **interactive flow spreadsheet** with custom cell rendering, row operations, and context menus. Added **persistent video playback timestamps** and improved type safety in video card metadata. Refreshed the tournament video archive with **NDT/TOC** rounds, updated README branding and demo images, removed legacy build scripts, and cleaned up obsolete test suites.

## March 2026

The biggest month of development. Built the complete **Debate Round** feature: round creation and editing, a **flow interface** with spreadsheet, per-speech **timers with persistence**, speech management, and embedded timer **sound effects**. Overhauled **CARD search** with new state management, **AI analysis** sidebars, advanced filtering, responsive layouts, and client-side caching. Rebuilt the **card parser** with human-name and citation extraction plus **DOCX parsing**. Added **AI speech-to-flow** and **speech-to-response** prompts and **speech-sync card highlighting** for live reading progress. Shipped a **persistent floating video player** that survives page navigation (portal-based, draggable popout), video categorization by format, infinite scroll, structured tournament/round/team metadata with **JSON schemas**, and **YouTube synchronization**. Enhanced rankings with **school name normalization** and ELO leaderboard fixes. Extensive mobile UX polish (dock navigation, speech toolbar, timers) and new visual components (**GlowingEffect**, **CardSpotlight**, **CanvasRevealEffect**). Added service worker **offline caching** and an auto-merge CI workflow.

## February 2026

**Beta V2 major release**: core debate application with flow editor, video integration, card parsing, and comprehensive UI components. Completed the **TipTap to Lexical** editor migration with a quotes plugin. Added the **debate flow spreadsheet**, speech document panel, and a new markdown editor. Implemented new **Debate Flow** and **Debate Videos** pages with supporting components and hooks, redesigned the **ChampionsPanel**, and restructured documentation into a new `docs/` directory with project vision and feature docs.

# Prototype Phase (2023–2025)

## December 2025

Created the **FLOW Research Manager** as a **Next.js** application. Established the debate flow and timer system foundation with **React Context** providers and conversion tracking. Completed Phase 1 MVP (core Flow editor with React/Next.js) and Phase 2 (advanced Flow features and UI enhancements).

## July 2024

Editor prototype milestone. Working editor with **sidebar, file system, and flow integration**, plus **TOC and block splitting**. Indexed **2,000 videos**, built the frontpage UI, and laid the **auth and docs** foundation.

## October 2023

AI research and browser tooling. Built a **Chrome extension** for cite and flow (working **crxjs** build), a card **parser**, and the **debate2vec** API. Conducted **LLaMA 2 vs ChatGPT** research and invented the **"Permutation Tree of Thought"** prompt inspired by Hegelian dialectic.

## September 2023

Project inception. Initial docs, schema, and UI experiments; **Google One Tap sign-in** testing; first dev example (v0.1).
