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

## For You section

When the viewer has already favorited one of these 17 spaces from `/tools`'
star toggle, a **For You** strip renders above the full directory, listing
just those already-starred spaces (`lib/community-research-hub.ts`'s
`buildForYouEntries`, exact `href` match against the favorites list — no
category-affinity guessing). It's hidden while the search box has an active
query (the matched sections below are already the relevant view at that
point) and when nothing favorited is in the hub (e.g. signed out, or every
favorite is a tool outside this directory).

`CommunityResearchHubPanel` can't read the favorites list itself — that's
account-synced app-layer state owned by
`apps/debate-ai.com/lib/hooks/useFavoriteTools.ts` — so it takes the list as
an optional `favoriteHrefs` prop instead. `apps/debate-ai.com`'s
`app/community-hub/CommunityHubPageContent.tsx` is the client wrapper that
calls the hook and passes it in, mirroring `app/news/NewsPageContent.tsx`'s
split for the same "package can't reach the app-layer hook" reason.

## Not in scope

Idea #7 ("On Page Card Reuse Search")'s remaining follow-up — an actual
browser extension — and the round/practice spaces' own remaining follow-ups
(real Tabroom/ballot-sourced data, audio/video transcription) are unrelated
to this bullet and untouched here; see their own entries in TODO.md.
Folding the directory into the News Stream feed (the other half of this
idea's TODO.md bullet) is also still open — every hub entry's route already
gets a generic "Tool spotlight" post via `news-stream.ts`'s
`buildAutoFeatureNews`, so a dedicated per-entry News Stream source would
mostly duplicate that rather than add new signal; a future run should
reconsider this once there's something entry-specific worth posting (e.g. a
"space added to the hub" moment distinct from the tool itself shipping).
