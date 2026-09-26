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
  /** Next-style pattern: `/videos/[category]`, `/tournaments/[[...slug]]`. */
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
  { pattern: "/briefings", load: () => import("./briefings/page") },
  { pattern: "/cards", load: () => import("./cards/page"), layout: () => import("./cards/layout") },
  { pattern: "/cards/argument-library", load: () => import("./cards/argument-library/page"), layout: () => import("./cards/layout") },
  { pattern: "/cards/awards", load: () => import("./cards/awards/page"), layout: () => import("./cards/layout") },
  { pattern: "/cards/best-card", load: () => import("./cards/best-card/page"), layout: () => import("./cards/layout") },
  { pattern: "/cards/brainstorm", load: () => import("./cards/brainstorm/page"), layout: () => import("./cards/layout") },
  { pattern: "/cards/collaboration", load: () => import("./cards/collaboration/page"), layout: () => import("./cards/layout") },
  { pattern: "/cards/contributions", load: () => import("./cards/contributions/page"), layout: () => import("./cards/layout") },
  { pattern: "/cards/coverage", load: () => import("./cards/coverage/page"), layout: () => import("./cards/layout") },
  { pattern: "/cards/group-challenges", load: () => import("./cards/group-challenges/page"), layout: () => import("./cards/layout") },
  { pattern: "/cards/inbox", load: () => import("./cards/inbox/page"), layout: () => import("./cards/layout") },
  { pattern: "/cards/leaderboard", load: () => import("./cards/leaderboard/page"), layout: () => import("./cards/layout") },
  { pattern: "/cards/leaderboard/[contributorId]", load: () => import("./cards/leaderboard/[contributorId]/page"), layout: () => import("./cards/layout") },
  { pattern: "/cards/library", load: () => import("./cards/library/page"), layout: () => import("./cards/layout") },
  { pattern: "/cards/prep-room", load: () => import("./cards/prep-room/page"), layout: () => import("./cards/layout") },
  { pattern: "/cards/progress", load: () => import("./cards/progress/page"), layout: () => import("./cards/layout") },
  { pattern: "/cards/progress-tracking", load: () => import("./cards/progress-tracking/page"), layout: () => import("./cards/layout") },
  { pattern: "/cards/quests", load: () => import("./cards/quests/page"), layout: () => import("./cards/layout") },
  { pattern: "/cards/reviews", load: () => import("./cards/reviews/page"), layout: () => import("./cards/layout") },
  { pattern: "/cards/revisions", load: () => import("./cards/revisions/page"), layout: () => import("./cards/layout") },
  { pattern: "/cards/scoring", load: () => import("./cards/scoring/page"), layout: () => import("./cards/layout") },
  { pattern: "/cards/level", load: () => import("./cards/level/page"), layout: () => import("./cards/layout") },
  { pattern: "/cards/streaks", load: () => import("./cards/streaks/page"), layout: () => import("./cards/layout") },
  { pattern: "/coach", load: () => import("./coach/page") },
  { pattern: "/coach-materials", load: () => import("./coach-materials/page") },
  { pattern: "/coaching", load: () => import("./coaching/page") },
  { pattern: "/coaching-programs", load: () => import("./coaching-programs/page") },
  { pattern: "/community-hub", load: () => import("./community-hub/page") },
  { pattern: "/contacts", load: () => import("./contacts/page") },
  { pattern: "/debate", load: () => import("./debate/page") },
  { pattern: "/debate/[tournament]/[teams]", load: () => import("./debate/[tournament]/[teams]/page") },
  { pattern: "/doc", load: () => import("./doc/page") },
  { pattern: "/doc/[slug]", load: () => import("./doc/[slug]/page") },
  { pattern: "/drills", load: () => import("./drills/page") },
  { pattern: "/features", load: () => import("./features/page") },
  { pattern: "/judge-decision", load: () => import("./judge-decision/page") },
  { pattern: "/judges", load: () => import("./judges/page") },
  { pattern: "/legal/privacy", load: () => import("./legal/privacy/page") },
  { pattern: "/login", load: () => import("./login/page") },
  { pattern: "/news", load: () => import("./news/page") },
  { pattern: "/notifications", load: () => import("./notifications/page") },
  { pattern: "/opponents", load: () => import("./opponents/page") },
  { pattern: "/outcomes", load: () => import("./outcomes/page") },
  { pattern: "/outline", load: () => import("./outline/page") },
  { pattern: "/paradigms", load: () => import("./paradigms/page") },
  { pattern: "/practice-opponent", load: () => import("./practice-opponent/page") },
  { pattern: "/practice-round", load: () => import("./practice-round/page") },
  { pattern: "/prep-notes", load: () => import("./prep-notes/page") },
  { pattern: "/rank", load: () => import("./rank/page") },
  { pattern: "/reason-editor", load: () => import("./reason-editor/page") },
  { pattern: "/reason-editor/[slug]", load: () => import("./reason-editor/[slug]/page") },
  { pattern: "/research", load: () => import("./research/page") },
  { pattern: "/schools/[school]", load: () => import("./schools/[school]/page") },
  { pattern: "/settings", load: () => import("./settings/page") },
  { pattern: "/settings/editor-panel", load: () => import("./settings/editor-panel/page") },
  { pattern: "/settings/preferences", load: () => import("./settings/preferences/page") },
  { pattern: "/speech-documents", load: () => import("./speech-documents/page") },
  { pattern: "/strategy", load: () => import("./strategy/page") },
  { pattern: "/summaries", load: () => import("./summaries/page") },
  { pattern: "/teams/[team]", load: () => import("./teams/[team]/page") },
  { pattern: "/tools", load: () => import("./tools/page") },
  { pattern: "/tools/mobile-setup", load: () => import("./tools/mobile-setup/page") },
  { pattern: "/tournaments/[[...slug]]", load: () => import("./tournaments/[[...slug]]/page") },
  { pattern: "/videos", load: () => import("./videos/page") },
  { pattern: "/videos/[category]", load: () => import("./videos/[category]/page") },
  { pattern: "/word-count", load: () => import("./word-count/page") },
]

export const CLIENT_ROUTES: AppRoute[] = [
  { pattern: "/", load: () => import("./_client/HomeRoute") },
  { pattern: "/admin", load: () => import("./_client/AdminRoute") },
  { pattern: "/versus-ai", load: () => import("./_client/VersusAiRoute") },
  { pattern: "/videos/watch/[slug]", load: () => import("./_client/VideoWatchRoute") },
  { pattern: "/videos/[category]/[event]/[matchup]", load: () => import("./_client/VideoWatchRoute") },
  { pattern: "/videos/[category]/[event]/[matchup]/[teams]", load: () => import("./_client/VideoWatchRoute") },
  { pattern: "/videos/[category]/[event]/[matchup]/[teams]/[variant]", load: () => import("./_client/VideoWatchRoute") },
]

export const APP_ROUTES: AppRoute[] = [...PAGE_ROUTES, ...CLIENT_ROUTES]
