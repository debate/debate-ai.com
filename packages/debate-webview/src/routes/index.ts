/**
 * @fileoverview Every page of the app, for hosts that route without Next.
 *
 * Under Next the `app/` directory is the route table and each `page.tsx`
 * there re-exports its page from this folder. A host without Next (the
 * browser extension) routes through this list instead — same patterns, same
 * page modules, each loaded only when it is first visited.
 *
 * `CLIENT_ROUTES` covers the pages the web app renders on the server because
 * they read the session or D1 directly; here each has a client version that
 * asks the API for the same thing (see `./_client`).
 *
 * `test/routes/route-table.test.ts` fails when a page is added to `app/` and
 * not here.
 */

import type { ComponentType, ReactNode } from "react"

type PageModule = { default: ComponentType<any> }
type LayoutModule = { default: ComponentType<{ children: ReactNode }> }

export interface AppRoute {
  /** Next-style pattern: `/videos/[category]`, `/practice/tournaments/[[...slug]]`. */
  pattern: string
  load: () => Promise<PageModule>
  /** The nearest `layout.tsx` wrapping this page, if any below the root. */
  layout?: () => Promise<LayoutModule>
}

export const PAGE_ROUTES: AppRoute[] = [
  { pattern: "/annotations", load: () => import("./annotations/page") },
  { pattern: "/auth/extension-complete", load: () => import("./auth/extension-complete/page") },
  { pattern: "/auth/native-callback", load: () => import("./auth/native-callback/page") },
  { pattern: "/auth/native-complete", load: () => import("./auth/native-complete/page") },
  { pattern: "/practice/briefings", load: () => import("./briefings/page") },
  { pattern: "/research/cards", load: () => import("./cards/page"), layout: () => import("./cards/layout") },
  { pattern: "/research/cards/argument-library", load: () => import("./cards/argument-library/page"), layout: () => import("./cards/layout") },
  { pattern: "/research/cards/awards", load: () => import("./cards/awards/page"), layout: () => import("./cards/layout") },
  { pattern: "/research/cards/best-card", load: () => import("./cards/best-card/page"), layout: () => import("./cards/layout") },
  { pattern: "/research/cards/brainstorm", load: () => import("./cards/brainstorm/page"), layout: () => import("./cards/layout") },
  { pattern: "/research/cards/collaboration", load: () => import("./cards/collaboration/page"), layout: () => import("./cards/layout") },
  { pattern: "/research/cards/contributions", load: () => import("./cards/contributions/page"), layout: () => import("./cards/layout") },
  { pattern: "/research/cards/coverage", load: () => import("./cards/coverage/page"), layout: () => import("./cards/layout") },
  { pattern: "/research/cards/group-challenges", load: () => import("./cards/group-challenges/page"), layout: () => import("./cards/layout") },
  { pattern: "/research/cards/inbox", load: () => import("./cards/inbox/page"), layout: () => import("./cards/layout") },
  { pattern: "/coaching/leaderboard", load: () => import("./cards/leaderboard/page") },
  { pattern: "/coaching/leaderboard/[contributorId]", load: () => import("./cards/leaderboard/[contributorId]/page") },
  { pattern: "/research/cards/library", load: () => import("./cards/library/page"), layout: () => import("./cards/layout") },
  { pattern: "/research/cards/prep-room", load: () => import("./cards/prep-room/page"), layout: () => import("./cards/layout") },
  { pattern: "/research/cards/progress", load: () => import("./cards/progress/page"), layout: () => import("./cards/layout") },
  { pattern: "/coaching/progress", load: () => import("./cards/progress-tracking/page") },
  { pattern: "/research/cards/quests", load: () => import("./cards/quests/page"), layout: () => import("./cards/layout") },
  { pattern: "/research/cards/reviews", load: () => import("./cards/reviews/page"), layout: () => import("./cards/layout") },
  { pattern: "/research/cards/revisions", load: () => import("./cards/revisions/page"), layout: () => import("./cards/layout") },
  { pattern: "/research/cards/scoring", load: () => import("./cards/scoring/page"), layout: () => import("./cards/layout") },
  { pattern: "/practice/level", load: () => import("./cards/level/page") },
  { pattern: "/research/cards/streaks", load: () => import("./cards/streaks/page"), layout: () => import("./cards/layout") },
  { pattern: "/coaching", load: () => import("./coach/page") },
  { pattern: "/coaching/materials", load: () => import("./coach-materials/page") },
  { pattern: "/coaching/ai-coach", load: () => import("./coaching/page") },
  { pattern: "/coaching/programs", load: () => import("./coaching-programs/page") },
  { pattern: "/contacts", load: () => import("./contacts/page") },
  { pattern: "/debate", load: () => import("./debate/page") },
  { pattern: "/debate/[tournament]/[teams]", load: () => import("./debate/[tournament]/[teams]/page") },
  { pattern: "/research/docs", load: () => import("./doc/page") },
  { pattern: "/research/docs/[slug]", load: () => import("./doc/[slug]/page") },
  { pattern: "/practice/drills", load: () => import("./drills/page") },
  { pattern: "/practice/features", load: () => import("./features/page") },
  { pattern: "/practice/forums", load: () => import("./forums/page") },
  { pattern: "/practice/forums/[threadId]", load: () => import("./forums/[threadId]/page") },
  { pattern: "/practice/glossary", load: () => import("./videos/page") },
  { pattern: "/practice/judge-decision", load: () => import("./judge-decision/page") },
  { pattern: "/practice/judges", load: () => import("./judges/page") },
  { pattern: "/lectures", load: () => import("./videos/page") },
  { pattern: "/lectures/[category]", load: () => import("./videos/[category]/page") },
  { pattern: "/legal/privacy", load: () => import("./legal/privacy/page") },
  { pattern: "/login", load: () => import("./login/page") },
  { pattern: "/news", load: () => import("./news/page") },
  { pattern: "/notifications", load: () => import("./notifications/page") },
  { pattern: "/practice/opponents", load: () => import("./opponents/page") },
  { pattern: "/coaching/outcomes", load: () => import("./outcomes/page") },
  { pattern: "/outline", load: () => import("./outline/page") },
  { pattern: "/practice/partners", load: () => import("./practice-partners/page") },
  { pattern: "/practice/predictions", load: () => import("./predictions/page") },
  { pattern: "/practice", load: () => import("./practice-round/page") },
  { pattern: "/practice/prep-notes", load: () => import("./prep-notes/page") },
  { pattern: "/practice/rankings", load: () => import("./videos/page") },
  { pattern: "/coaching/rankings", load: () => import("./rank/page") },
  { pattern: "/reason-editor", load: () => import("./reason-editor/page") },
  { pattern: "/reason-editor/[slug]", load: () => import("./reason-editor/[slug]/page") },
  { pattern: "/research", load: () => import("./research/page") },
  { pattern: "/practice/rules", load: () => import("./rules/page") },
  { pattern: "/schools/[school]", load: () => import("./schools/[school]/page") },
  { pattern: "/settings", load: () => import("./settings/page") },
  { pattern: "/settings/editor-panel", load: () => import("./settings/editor-panel/page") },
  { pattern: "/settings/preferences", load: () => import("./settings/preferences/page") },
  { pattern: "/settings/research", load: () => import("./settings/research/page") },
  { pattern: "/settings/research/[section]", load: () => import("./settings/research/[section]/page") },
  { pattern: "/speech-documents", load: () => import("./speech-documents/page") },
  { pattern: "/practice/statistics", load: () => import("./videos/page") },
  { pattern: "/practice/strategy", load: () => import("./strategy/page") },
  { pattern: "/summaries", load: () => import("./summaries/page") },
  { pattern: "/practice/tabroom/[[...slug]]", load: () => import("./tabroom/[[...slug]]/page") },
  { pattern: "/teams/[team]", load: () => import("./teams/[team]/page") },
  { pattern: "/coaching/laptopless", load: () => import("./coaching/laptopless/page") },
  // `/research/topics` was the standalone Topics Explorer. Its research-area
  // explorer is now the first section of `/practice/statistics`, so this old
  // address loads the same merged page rather than a second copy of it.
  { pattern: "/research/topics", load: () => import("./videos/page") },
  { pattern: "/practice/tournaments/[[...slug]]", load: () => import("./tournaments/[[...slug]]/page") },
  { pattern: "/videos", load: () => import("./videos/page") },
  { pattern: "/videos/[category]", load: () => import("./videos/[category]/page") },
  { pattern: "/word-count", load: () => import("./word-count/page") },
]

export const CLIENT_ROUTES: AppRoute[] = [
  { pattern: "/", load: () => import("./_client/HomeRoute") },
  { pattern: "/admin", load: () => import("./_client/AdminRoute") },
  { pattern: "/practice/versus-ai", load: () => import("./_client/VersusAiRoute") },
  { pattern: "/videos/watch/[slug]", load: () => import("./_client/VideoWatchRoute") },
  { pattern: "/videos/[category]/[event]/[matchup]", load: () => import("./_client/VideoWatchRoute") },
  { pattern: "/videos/[category]/[event]/[matchup]/[teams]", load: () => import("./_client/VideoWatchRoute") },
  { pattern: "/videos/[category]/[event]/[matchup]/[teams]/[variant]", load: () => import("./_client/VideoWatchRoute") },
]

export const APP_ROUTES: AppRoute[] = [...PAGE_ROUTES, ...CLIENT_ROUTES]
