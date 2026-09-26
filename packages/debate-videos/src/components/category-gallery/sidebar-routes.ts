/**
 * @fileoverview Which routes get the tool sidebar — the `ToolNavTree` above
 * plus the app dock hosted at the top of the same column — derived straight
 * from the link data the tree itself renders so the two can never drift.
 *
 * Lives in this package, next to that data, rather than in the app: the app's
 * `lib/sidebar-routes.ts` is a thin re-export, and keeping the predicates
 * here is what makes them testable (`apps/*` is outside the Vitest projects
 * glob, `packages/*` is not).
 *
 * @module components/category-gallery/sidebar-routes
 */

import {
  APP_DOCK_LINKS,
  SIDEBAR_TOOL_SECTIONS,
  TOOLS_ROOT_HREF,
} from "./sidebar-tool-sections";

/**
 * Routes that get the sidebar without being one of the tree's own links.
 *
 * `/features` is the catalog of every surface in the app, reached from the
 * footer and from the dock's Site Links menu. It used to render as a bare
 * full-page panel with a "Back" pill of its own, which read as leaving the
 * app — so it is wrapped in the same sidebar as everything else it links to,
 * and the sidebar is how you leave it.
 *
 * `/teams/<team>` and `/schools/<school>` are the profile pages opened from
 * the Team Rankings table (`/rank`, itself a tree destination). They used to
 * render bare, with only a "← Team Rankings" text link back — landing on one
 * from anywhere else in the app dropped the nav entirely.
 *
 * `/legal` is the Terms of Service and Privacy Policy page (`/legal/privacy`
 * today). Same reasoning: a page reachable from the footer on every other
 * route otherwise loses the nav the moment you open it.
 */
export const EXTRA_SIDEBAR_HREFS: readonly string[] = [
  "/features",
  "/teams",
  "/schools",
  "/legal",
];

/** Every destination the tool sidebar links to, deduplicated. */
export const TOOL_SIDEBAR_HREFS: ReadonlySet<string> = new Set<string>([
  TOOLS_ROOT_HREF,
  ...EXTRA_SIDEBAR_HREFS,
  ...APP_DOCK_LINKS.map((link) => link.href),
  ...SIDEBAR_TOOL_SECTIONS.flatMap((section) => [
    section.href,
    ...section.tools.map((tool) => tool.href),
  ]),
]);

/**
 * Destinations that the tool tree links to but that render their own
 * full-height workspace chrome — a sidebar of their own, and a top bar above
 * it — so the generic sidebar lands beside that as a second nav column.
 *
 * `/debate` is the flow workspace: it owns the whole viewport, with its own
 * flows/rounds/tools sidebar, and wrapping it in the tool tree left the page
 * showing two side-by-side sidebars, the tree's and its own. It keeps the
 * app dock, just the floating instance rather than one hosted in a column
 * that is no longer there (see {@link hasEmbeddedDock}).
 */
export const OWN_LAYOUT_SIDEBAR_HREFS: readonly string[] = ["/debate"];

/**
 * The same opt-out, for a workspace that hosts the app dock *inside* its own
 * sidebar rather than leaving it to float.
 *
 * `/doc` is the REASON research workspace: its own sidebar is the files tree
 * and the "Open Tabs" list, and the generic tool tree stood beside that as a
 * second, taller column — the tree's dock at the top of one, the documents at
 * the top of the other. The workspace's sidebar carries the dock now (the
 * app's `SidebarWithAppDock`, injected as `ReasonDocs`' `SidebarComponent`),
 * so this route wants what `/videos` gets: no generic sidebar, and no
 * floating dock either, since a dock is already on screen.
 */
export const OWN_SIDEBAR_DOCK_HREFS: readonly string[] = ["/doc"];

/** True when `pathname` is `href` or a page below it. */
function isAtOrUnder(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * True on {@link OWN_SIDEBAR_DOCK_HREFS} and anything nested under one
 * (`/doc/<document name>`) — the routes whose own sidebar hosts the dock.
 */
export function hostsOwnSidebarDock(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return OWN_SIDEBAR_DOCK_HREFS.some((href) => isAtOrUnder(pathname, href));
}

/**
 * True on {@link OWN_LAYOUT_SIDEBAR_HREFS} and
 * {@link OWN_SIDEBAR_DOCK_HREFS}, and on anything nested under one
 * (`/debate/<tournament>`, `/doc/<document name>`), matched the same prefix
 * way as {@link matchesToolSidebarHref}. Whether the floating dock stands in
 * for the column that is skipped is the one thing the two lists differ on —
 * see {@link hasEmbeddedDock}.
 */
export function ownsItsLayout(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (hostsOwnSidebarDock(pathname)) return true;
  return OWN_LAYOUT_SIDEBAR_HREFS.some((href) => isAtOrUnder(pathname, href));
}

/**
 * True when `pathname` is one of the sidebar's destinations or sits beneath
 * one.
 *
 * The prefix half matters: a nested route under a tree entry (`/cards/awards`
 * under `/cards`, a document route under `/doc`) is the same destination one
 * level down, and matching exact paths only left those pages with the app
 * dock's fixed top-left instance floating over their content instead of a
 * dock inside a sidebar — over a CardMirror editor, in the `/doc` and
 * `/reason-editor` subtrees. The trailing `/` in the comparison keeps `/docs`
 * from matching `/doc`.
 */
export function matchesToolSidebarHref(pathname: string): boolean {
  if (TOOL_SIDEBAR_HREFS.has(pathname)) return true;
  for (const href of TOOL_SIDEBAR_HREFS) {
    if (pathname.startsWith(`${href}/`)) return true;
  }
  return false;
}

/**
 * True on `/videos` (which renders its own full sidebar, dock included) and
 * on every page the tool-nav tree links to (which the app's
 * `AppSidebarShell` wraps in the generic sidebar) — i.e. every route with a
 * sidebar-hosted dock already on screen, so `CategoryDock`'s fixed top-left/
 * bottom instance should stay hidden rather than show twice.
 */
export function hasEmbeddedDock(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  // A route that hosts the dock in its own sidebar already has one on
  // screen — the floating instance would be the second.
  if (hostsOwnSidebarDock(pathname)) return true;
  // Every other route that owns its layout has no sidebar column to host a
  // dock, so the floating one is the only dock it gets — suppressing it there
  // would leave the page with no way back into the app.
  if (ownsItsLayout(pathname)) return false;
  return pathname.startsWith("/videos") || matchesToolSidebarHref(pathname);
}

/**
 * True only for the generic tool pages — not `/videos` itself, which already
 * renders its own sidebar and would otherwise get two.
 */
export function isGenericToolSidebarRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (pathname.startsWith("/videos")) return false;
  if (ownsItsLayout(pathname)) return false;
  return matchesToolSidebarHref(pathname);
}
