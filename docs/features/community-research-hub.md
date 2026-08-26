# Community Research Hub

A searchable directory of every shared research, collaboration, and
pre-round/practice space in the app, grouped into categories, so a debater
doesn't need to already know a route exists to find it.

- **Route:** `/community-hub`
- **Nav:** the Tools page's Workspaces group; the Reason Editor's
  Workspace menu (`t hub` in Ctrl/Cmd-Shift-Space's command palette)
- **Package:** [`debate-card-search`](../../packages/debate-card-search/README.md)

## Why this exists

TODO.md's Research Crowdsourcing Organizer Features list opens with a
"🧩 Community Research Hub" bullet — "a shared space where debaters
contribute cards, evidence, and summaries to a common argument pool" — but
every sibling bullet under that same heading (Shared Evidence Library,
Contribution Leaderboard, Team Brainstorm Assist, and so on) already shipped
its own dedicated panel and route, closing itself out independently. Nothing
tied them into one place a debater could browse. `/research`'s `ResearchHub`
comes close — it tabs across the card-search-side panels — but doesn't cover
the round/practice-side spaces (Opponent/Judge Profiles, AI Coach Mode,
Practice Round Simulator, AI Drill Generator) that TODO.md's own "shared
space" framing spans just as much.

This panel is that directory: one searchable list of all 17 spaces,
including the ones `/research` doesn't reach.

## What it shows

A search box (matched against a space's title or one-line description,
case-insensitively) over a static registry of every space
(`lib/community-research-hub.ts`'s `COMMUNITY_RESEARCH_HUB_ENTRIES`), each
entry a title, description, and route taken directly from that route's own
page metadata so the directory can't drift from what a debater sees after
clicking through. Matches render grouped into five categories — Evidence &
Cards, Team Collaboration, Pre-Round Intelligence, Practice & Coaching, and
Recognition & Progress — via `buildCommunityResearchHubSections`, and a
header line summarizes the total via `buildCommunityResearchHubSummaryText`
(e.g. "17 spaces across 5 categories: …").

This is pure navigation: the hub itself persists nothing. Every entry links
out to a space that already persists (or, like the AI-calling panels, doesn't
need to persist) its own state.

## Not in scope

Idea #7 ("On Page Card Reuse Search")'s remaining follow-up — an actual
browser extension — and the round/practice spaces' own remaining follow-ups
(real Tabroom/ballot-sourced data, audio/video transcription) are unrelated
to this bullet and untouched here; see their own entries in TODO.md.
