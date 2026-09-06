# Packages

Workspace packages used by the debate-ai.com apps.

## debate-help-docs

The Debate AI documentation site, built on the Fumadocs starter template. Publishes the
product's feature specs (`docs/features/`) and package READMEs as a searchable docs site.

## debate-card-parser

Parser for debate evidence cards, turning Verbatim `.docx` files and HTML into structured
cards with citations and highlighting. Used to import evidence into the site's card-based
tools.

## debate-card-search

The evidence card research interface: the search bar and result list, the card content
viewer, and the AI analysis sidebar. Also includes the Research Crowdsourcing Organizer
feature set (leaderboards, quests, task routing).

## debate-data-sync

Bundled debate data assets (metadata, videos, schemas) plus the scripts that sync them.
Keeps YouTube video data and debate rankings up to date.

## debate-editor

REASON's app-facing speech-doc editor. It's a thin shell over the `reason-editor` engine
plus a read-only markdown renderer for speech views.

## debate-editor-cardmirror

The CardMirror-based debate-card editor embedded across debate-ai.com. Exposes the
ProseMirror engine, Verbatim `.docx` interop helpers, and a React editor shell sized for
small embedded panels.

## debate-flow-ebb

The `ebb` local-first, keyboard-first flow editor, ported in as a workspace package.
`EbbFlowEmbed` mounts it as one column of a host page, such as `debate-round`'s live round
editor.

## debate-round

FIAT, the live debate round workspace. Includes the ag-Grid flow spreadsheet, round setup
dialogs (tournament, teams, judges, spectators), speech doc panels, and export/history
tooling.

## debate-speech-writer

The AI prompt library behind FIAT's speech and flow features. Includes flow extraction,
judge decisions, flaw finding, research outlines, and a batch quote-analysis helper.

## debate-timer

Speech and prep timers for live rounds, with per-format speech times built in. Also
includes an in-round speech recorder with mic selection, live waveform, and playback.

## debate-ui

Shared UI kit for the debate apps. Provides shadcn/Radix primitives, a custom icon set,
the site footer, and the `cn`/URL-state helpers other packages build on.

## debate-videos

LEARN, the debate video library. Covers video search and filtering, grids and cards, a
persistent YouTube player with picture-in-picture, and rankings leaderboards.

## native-wrapper

A generic Tauri shell that packages any website as a native desktop and mobile app,
pre-configured to ship Debate AI. Provides the OS-level plumbing (app icon, splash screen,
etc.) a plain webview doesn't get for free.

## reason-editor

The REASON research editor: a TipTap/React shell over the CardMirror ProseMirror engine
with Verbatim `.docx` interop. Wired for debate-ai.com's FIAT speech docs.
