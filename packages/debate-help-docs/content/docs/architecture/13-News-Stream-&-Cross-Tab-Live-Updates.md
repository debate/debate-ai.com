---
title: "News Stream & Cross-Tab Live Updates"
---

# News Stream & Cross-Tab Live Updates
Relevant source files
- [apps/debate-ai.com/app/news/NewsPageContent.tsx](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/app/news/NewsPageContent.tsx)
- [apps/debate-ai.com/app/news/page.tsx](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/app/news/page.tsx)
- [apps/debate-ai.com/drizzle/0013_late_jazinda.sql](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/drizzle/0013_late_jazinda.sql)
- [apps/debate-ai.com/drizzle/meta/0013_snapshot.json](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/drizzle/meta/0013_snapshot.json)
- [apps/debate-ai.com/lib/hooks/useNewsStreamSync.ts](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/lib/hooks/useNewsStreamSync.ts)
- [docs/features/news-stream.md](https://github.com/debate/debate-ai.com/blob/34937310/docs/features/news-stream.md?plain=1)
- [docs/features/opponent-team-profiles.md](https://github.com/debate/debate-ai.com/blob/34937310/docs/features/opponent-team-profiles.md?plain=1)
- [packages/debate-data-sync/src/rankings/opponent-team-profile.ts](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/src/rankings/opponent-team-profile.ts)
- [packages/debate-data-sync/src/state/opponentRoundRecords.ts](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/src/state/opponentRoundRecords.ts)
- [packages/debate-data-sync/test/opponent-team-profile.test.ts](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/test/opponent-team-profile.test.ts)
- [packages/debate-data-sync/test/opponentRoundRecords.test.ts](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-data-sync/test/opponentRoundRecords.test.ts)
- [packages/debate-round/src/flow/live-update.ts](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round/src/flow/live-update.ts)
- [packages/debate-round/src/panels/OpponentTeamProfilesPanel.tsx](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round/src/panels/OpponentTeamProfilesPanel.tsx)
- [packages/debate-round/test/live-update.test.ts](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round/test/live-update.test.ts)

The **News Stream** provides a unified activity feed consolidating product updates and community announcements. This helps users stay informed without navigating multiple locations such as the Daily Best Card page, Contributor Awards page, or Tool panels [docs/features/news-stream.md3-5](https://github.com/debate/debate-ai.com/blob/34937310/docs/features/news-stream.md?plain=1#L3-L5) Alongside this, a robust **cross-tab live-update** mechanism synchronizes UI state such as read/liked status across multiple open browser tabs, eliminating stale views and manual refreshes [packages/debate-round/src/flow/live-update.ts1-150](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round/src/flow/live-update.ts#L1-L150)

---

## News Stream Architecture

The News Stream feed is composed by merging static product announcements with dynamic community event sources drawn from various persisted feature stores, then dynamically injected feeds. The main assembly function `buildNewsFeed` orchestrates this composition [packages/debate-card-search/src/state/newsStream.ts4-19](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-card-search/src/state/newsStream.ts#L4-L19) Its design aims to unify diverse announcement formats into a single chronological feed, filterable by categories.

### Data Aggregation Pipeline

The feed covers the following core categories defined as `NewsCategory` enum labels [packages/debate-card-search/src/lib/news-stream.ts33](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-card-search/src/lib/news-stream.ts#L33-L33):

1. **Product Updates**

- Hand-maintained news posts stored as `PRODUCT_NEWS` in `lib/news-stream.ts`[packages/debate-card-search/src/lib/news-stream.ts64-137](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-card-search/src/lib/news-stream.ts#L64-L137)
- Auto-generated "Tool spotlight" items synthesized by `buildAutoFeatureNews()`, which scans the full `APP_FEATURES` catalog to highlight all tools—even those without explicit announcements [packages/debate-card-search/src/lib/news-stream.ts16-25](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-card-search/src/lib/news-stream.ts#L16-L25)
2. **Daily Best Card**

- Daily winners' announcements retrieved from the persisted store with `listAnnouncedDailyBestCards()`[packages/debate-card-search/src/state/newsStream.ts83-92](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-card-search/src/state/newsStream.ts#L83-L92)
3. **Contributor Awards**

- Daily top contributors announced via `listAnnouncedContributorAwards()`[packages/debate-card-search/src/state/newsStream.ts95-104](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-card-search/src/state/newsStream.ts#L95-L104)
4. **Community Events**

- Derived directly from feature-specific persisted histories, including:

- Quest Streak milestones
- Completed Group Challenges
- Top Revision Incentive earners per day
- Sprint Notes from Team Collaboration Mode
- New Argument Library submissions
- AI Coaching Sessions (injected at runtime, see below)
These have volume caps (typically 20 recent items per source) to avoid feed overload [docs/features/news-stream.md34-81](https://github.com/debate/debate-ai.com/blob/34937310/docs/features/news-stream.md?plain=1#L34-L81)

### Dependency Injection for External Sources

To avoid circular dependencies between packages (e.g., `debate-round` and `debate-community`), external live sources like AI Coaching Sessions (`debate-round`’s `coachingSessionNews()`) are injected externally into the feed with an `extraItems` parameter [debate-practice-rounds/src/state/coachingSessions27](https://github.com/debate/debate-ai.com/blob/34937310/debate-practice-rounds/src/state/coachingSessions#L27-L27) This injection occurs at app composition time in `NewsPageContent.tsx`, which calls `buildNewsFeed` and passes these items to `NewsStreamPanel`[apps/debate-ai.com/app/news/NewsPageContent.tsx30-33](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/app/news/NewsPageContent.tsx#L30-L33)

#### Composition at Runtime

- The top-level `/news` page orchestrates rendering `NewsPageContent`, a client component that hydrates live session data and sets up account sync [apps/debate-ai.com/app/news/page.tsx12-37](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/app/news/page.tsx#L12-L37)
- The `NewsStreamPanel` receives all merged feed items plus live sync callbacks for read/liked state updates.

### News Item Data Flow Diagram

---

## Cross-Tab Live Updates

The system employs a uniform **cross-tab synchronization** approach using the browser's native `localStorage` and `StorageEvent` mechanism to ensure that data changes in one tab are reflected in all others. Since `storage` events do not fire in the originating tab, the design patterns guarantee live updates in all *other* same-origin tabs [packages/debate-round/src/flow/live-update.ts1-20](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round/src/flow/live-update.ts#L1-L20)

### Predicate-Based Event Filtering

Each panel or UI component that listens for storage changes uses specific predicate functions to check whether a received `storage` event pertains to keys relevant to its data. This avoids unnecessary re-renders due to unrelated storage mutations. For example, the News Stream uses `isNewsStreamLiveUpdateStorageEvent` to filter events on the `newsStreamViewerState` key, while the Flow Spreadsheet and related panels each have their own key sets and predicates in `live-update.ts`[packages/debate-round/src/flow/live-update.ts20-150](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round/src/flow/live-update.ts#L20-L150)

### React Pattern for Re-Render

Panels maintain a local state counter (e.g., `viewerTick`). On a matching storage event, the event handler increments this tick, triggering React to re-run state derivations reading `localStorage` and update the UI accordingly. This pattern is crucial for reflecting live changes like marking a post "read" or toggling a "like" icon across tabs [packages/debate-card-search/src/panels/NewsStreamPanel.tsx136-159](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-card-search/src/panels/NewsStreamPanel.tsx#L136-L159)

### Cross-Tab Synchronization Flow Diagram

---

## Integration Example: Opponent Team Profiles Panel Live Updates

The cross-tab live update mechanism is not limited to News Stream but is shared broadly, e.g., in features like the Opponent Team Profiles panel in `debate-round`. This panel listens for storage keys related to logged opponent scouting rounds, and refreshes its list on edits, undos, bulk imports, and deletes—all reflected live across tabs [packages/debate-round/src/panels/OpponentTeamProfilesPanel.tsx1-75](https://github.com/debate/debate-ai.com/blob/34937310/packages/debate-round/src/panels/OpponentTeamProfilesPanel.tsx#L1-L75)

---

## Account Sync for Read/Liked State

The News Stream's per-user read and liked states are primarily stored locally in `localStorage` under the key `newsStreamViewerState`. To maintain continuity across devices and browsers for signed-in users, these states are additionally synced to the account's `user_settings` D1 row (`newsRead`, `newsLiked` columns) via API calls managed in the client hook `useNewsStreamSync()`[apps/debate-ai.com/lib/hooks/useNewsStreamSync.ts1-67](https://github.com/debate/debate-ai.com/blob/34937310/apps/debate-ai.com/lib/hooks/useNewsStreamSync.ts#L1-L67)

This hook handles:

- Fetching the remote sync state on mount (`hydrate` function).
- Best-effort push of updated read/liked IDs (`pushRead`, `pushLiked`).
- Detecting absence of a signed-in session to skip unnecessary calls.

---

## Summary of Key Code Entities

| Entity | Description | Location |
| --- | --- | --- |
| `buildNewsFeed` | Builds the complete unified news feed from hand-maintained and persisted product updates, plus community-sourced events and injected extra items. | `packages/debate-card-search/src/state/newsStream.ts:4-19` |
| `PRODUCT_NEWS` | Static hand-maintained product update entries, forming the backbone of product news. | `packages/debate-card-search/src/lib/news-stream.ts:64-137` |
| `coachingSessionNews()` | Generates AI Coaching Session feed items, injected into the stream. | `debate-practice-rounds/src/state/coachingSessions:27` |
| `NewsStreamPanel` | React UI component that renders the unified news feed, handling read and like interactions. | `packages/debate-community/src/panels/NewsStreamPanel.tsx` (not fully shown) |
| `useNewsStreamSync()` | Hook providing account sync adapter for read/like viewer state via API-backed `user_settings`. | `apps/debate-ai.com/lib/hooks/useNewsStreamSync.ts:1-67` |
| `newsStreamViewerState` | Local storage key holding the viewer's read and liked news item IDs. | `packages/debate-card-search/src/state/newsStream.ts:47-49` |
| Cross-tab live update predicates | Functions like `isNewsStreamLiveUpdateStorageEvent(event)` that guard listener reactions based on storage key. | `packages/debate-round/src/flow/live-update.ts:200-210` |
| `storage` event handlers | Cross-tab event listeners attached in panels, incrementing local state ticks to trigger re-render. | `packages/debate-card-search/src/panels/NewsStreamPanel.tsx:136-159` |

---

This page is a parent overview. For detailed exploration:

- See [News Feed Architecture & Sources](/debate/debate-ai.com/13.1-news-feed-architecture-and-sources) for all feed source details, `buildNewsFeed` composition, `PRODUCT_NEWS`, community event caps, `useNewsStreamSync`, and injection patterns at `NewsPageContent`.
- See [Live Update & Cross-Tab Synchronization](/debate/debate-ai.com/13.2-live-update-and-cross-tab-synchronization) for in-depth mechanics of the `live-update.ts` predicates, storage key sets per panel, listener attachment patterns in UI components, and viewer tick state management.

---

**Sources:**

- docs/features/news-stream.md (lines 1-111)
- packages/debate-card-search/src/lib/news-stream.ts (lines 16-137)
- packages/debate-card-search/src/state/newsStream.ts (lines 4-19, 83-104)
- packages/debate-round/src/flow/live-update.ts (lines 1-150)
- packages/debate-round/src/panels/OpponentTeamProfilesPanel.tsx (lines 1-75)
- apps/debate-ai.com/app/news/NewsPageContent.tsx (lines 30-33)
- apps/debate-ai.com/app/news/page.tsx (lines 12-37)
- apps/debate-ai.com/lib/hooks/useNewsStreamSync.ts (lines 1-67)
- packages/debate-card-search/src/panels/NewsStreamPanel.tsx (lines 136-159)
- apps/debate-ai.com/drizzle/0013_late_jazinda.sql (lines 1-2)