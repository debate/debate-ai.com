/**
 * @fileoverview Guards route coverage across the app's hand-maintained tool
 * catalogs.
 *
 * `app/tools/tool-groups.ts`'s `ALL_TOOLS` already is the single source of
 * truth for `/tools`, the favorites system, and the app-wide command
 * palette (`GlobalCommandPalette.tsx` imports it directly). Two catalogs
 * still can't import it and so are kept in sync by hand instead:
 *
 * - `debate-webview`'s `APP_FEATURES` — a different page
 *   (`/practice/features`) with its own curated, differently-voiced copy per entry,
 *   grouped into a different category scheme. Recombining the two into one
 *   data source would mean either forcing `/practice/features`'s marketing copy to
 *   read like `/tools`'s functional grid or vice versa — out of scope for a
 *   de-duplication fix (see the GitHub issue this closes). What *can* be
 *   shared without a copy rewrite is the route list itself.
 * - `debate-editor`'s `WORKSPACE_LINKS` — the Reason Editor's Workspace menu
 *   and quick-search `t` prefix. `debate-editor` has no dependency on the
 *   Next.js app (and so can't import `tool-groups.ts` at runtime) — see that
 *   file's own header comment.
 *
 * Before this test, a tool added to `ALL_TOOLS` and nowhere else silently
 * reached `/tools`, favorites, and the command palette but not `/practice/features`
 * or the editor's Workspace menu, with no error anywhere (the exact gap
 * `command-palette.mdx`'s Known gaps calls "a fourth hand-maintained tool
 * list"). This file is a test-only relative import into `debate-editor`'s
 * source — the app already depends on `debate-editor` as a package, so this
 * doesn't add a dependency edge that wasn't already there.
 *
 * The three catalogs above are internally cross-checked against each other,
 * but none of them was ever checked against the actual routes under
 * `app/` — a route added to none of the three (`internals/features-page.mdx`'s
 * own Known gaps: "the tests assert the catalog's internal consistency, not
 * that it covers every file under `apps/debate-ai.com/app/`") reached no
 * catalog at all with nothing to catch it. The last test below walks `app/`
 * for every static (non-dynamic-segment) route with its own `page.tsx` and
 * requires each to appear in at least one of the three catalogs, unless it's
 * in `ROUTES_WITHOUT_A_CATALOG_ENTRY` — a nav destination, an auth/settings
 * step, or a catalog page itself, none of which are "a tool" to list.
 */
import { readdirSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { ALL_TOOLS } from "@debate/webview/routes/tools/tool-groups"
import { APP_FEATURES } from "@debate/webview/lib/feature-catalog"
import { WORKSPACE_LINKS } from "../../../../packages/debate-editor/src/editor/workspace-links"

/**
 * `/tools` entries that intentionally have no `/practice/features` counterpart — a
 * companion guide page bundled under the Mobile Setup group, not a distinct
 * user-facing surface.
 */
const FEATURES_EXCLUDE_FROM_TOOLS = new Set(["/coaching/laptopless"])

/**
 * `/practice/features` entries that intentionally have no `/tools` counterpart — core
 * nav destinations reachable from the app dock rather than tools listed on
 * the `/tools` grid, and the two library pages taken off the tools grid when
 * card search gained its own "Submit card" popup (their routes stay for deep
 * links such as the browser extension's `?checkUrl=`).
 */
const TOOLS_EXCLUDE_FROM_FEATURES = new Set([
  "/videos",
  "/research/cards",
  "/debate",
  "/research/cards/library",
  "/research/cards/argument-library",
])

/**
 * `/tools` entries that intentionally have no Workspace-menu counterpart.
 * `/reason-editor` can't link to itself from inside its own Workspace menu,
 * and `/coaching/laptopless` is a companion guide, not a "major tool" per
 * `workspace-links.ts`'s own header comment.
 */
const WORKSPACE_EXCLUDE_FROM_TOOLS = new Set(["/reason-editor", "/coaching/laptopless"])

/** Workspace-menu entries that intentionally have no `ALL_TOOLS` counterpart. None today. */
const TOOLS_EXCLUDE_FROM_WORKSPACE = new Set<string>()

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")
const APP_DIR = join(APP_ROOT, "app")

/**
 * Every route under `app/` with its own `page.tsx`, found by walking the
 * directory tree (skipping `api/`, which has no `page.tsx` files at all).
 * A dynamic segment's route (e.g. `/coaching/leaderboard/[contributorId]`)
 * is a detail page under an already-covered static parent, not a distinct
 * catalog entry, so callers filter those out rather than this function.
 * A route group (`(home)`) is a folder that is not a URL segment, so it adds
 * nothing to the route.
 */
function findAppPageRoutes(dir: string, routePrefix: string): string[] {
  const entries = readdirSync(dir)
  const routes = entries.includes("page.tsx") ? [routePrefix || "/"] : []
  for (const entry of entries) {
    if (entry === "api") continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      const isRouteGroup = entry.startsWith("(") && entry.endsWith(")")
      routes.push(...findAppPageRoutes(full, isRouteGroup ? routePrefix : `${routePrefix}/${entry}`))
    }
  }
  return routes
}

const STATIC_APP_ROUTES = findAppPageRoutes(APP_DIR, "").filter((route) => !route.includes("["))

/**
 * Static `app/` routes that intentionally have no entry in any of the three
 * tool catalogs: the homepage and admin panel, an auth-flow step, a legal
 * page, `/login` (already documented on `/tools`'s consistency checks above
 * as "a step on the way to a feature rather than a feature"), the editor's
 * own settings pages plus the app's debate-style/font-size/font-family
 * preferences page (same reasoning as `/login` — configuration, not a
 * tool), and `/practice/features` itself.
 *
 * `/practice/forums` is here for the reason `/tournaments` never needed an entry: both
 * are destinations in the sidebar's tool tree and the dock's Settings menu
 * rather than tools. A forum is a place members talk to each other, not
 * something the app does for them, and listing it on the `/tools` grid — whose
 * entries each describe a capability with a docs page behind it — would claim a
 * feature guide that does not exist.
 *
 * `/practice/rules` is here for that reason: it is a reference
 * page in the sidebar tree (the formats-and-rules guide) — reading material,
 * not a tool.
 *
 * `/research/topics` is the one route that no longer renders a page of its
 * own: the Topics Explorer's research-area explorer is now the first section
 * of `/practice/statistics`, so `/research/topics` only redirects there.
 * `/practice` is the same: the Practice Round Simulator was merged into
 * Practice vs AI, so it only redirects to `/practice/versus-ai`.
 *
 * `/lectures`, `/practice/glossary`, `/practice/rankings` and
 * `/practice/statistics` are views of the video library page (the same page
 * `/videos` renders), given their own routes under their sidebar category.
 * `/videos` is listed through its dock entry; these are its sidebar rows.
 *
 * `/docs/welcome` is the help docs' landing page (`debate-help-docs`) — the
 * documentation the catalog entries link to, not a tool itself.
 */
const ROUTES_WITHOUT_A_CATALOG_ENTRY = new Set([
  "/",
  "/admin",
  "/auth/extension-complete",
  "/auth/native-callback",
  "/auth/native-complete",
  "/docs/welcome",
  "/practice/features",
  "/practice/forums",
  "/legal/privacy",
  "/login",
  "/practice/rules",
  "/settings",
  "/settings/editor-panel",
  "/settings/preferences",
  "/settings/research",
  "/research/topics",
  "/practice",
  "/lectures",
  "/practice/glossary",
  "/practice/rankings",
  "/practice/statistics",
])

describe("tool catalog route coverage", () => {
  it("covers every /tools entry on /features, except the documented exceptions", () => {
    const featureHrefs = new Set(APP_FEATURES.map((f) => f.href))
    const missing = ALL_TOOLS.map((t) => t.href).filter(
      (href) => !featureHrefs.has(href) && !FEATURES_EXCLUDE_FROM_TOOLS.has(href),
    )
    expect(missing, "add these to APP_FEATURES, or to FEATURES_EXCLUDE_FROM_TOOLS with a reason").toEqual([])
  })

  it("covers every /features entry on /tools, except the documented exceptions", () => {
    const toolHrefs = new Set(ALL_TOOLS.map((t) => t.href))
    const missing = APP_FEATURES.map((f) => f.href).filter(
      (href) => !toolHrefs.has(href) && !TOOLS_EXCLUDE_FROM_FEATURES.has(href),
    )
    expect(missing, "add these to ALL_TOOLS, or to TOOLS_EXCLUDE_FROM_FEATURES with a reason").toEqual([])
  })

  it("keeps the documented exceptions honest — each is really absent from the other catalog", () => {
    const featureHrefs = new Set(APP_FEATURES.map((f) => f.href))
    for (const href of FEATURES_EXCLUDE_FROM_TOOLS) {
      expect(featureHrefs.has(href), `${href} is now on /features — drop it from FEATURES_EXCLUDE_FROM_TOOLS`).toBe(
        false,
      )
    }
    const toolHrefs = new Set(ALL_TOOLS.map((t) => t.href))
    for (const href of TOOLS_EXCLUDE_FROM_FEATURES) {
      expect(toolHrefs.has(href), `${href} is now on /tools — drop it from TOOLS_EXCLUDE_FROM_FEATURES`).toBe(false)
    }
  })

  it("covers every /tools entry in the Reason Editor's Workspace menu, except the documented exceptions", () => {
    const workspaceHrefs = new Set(WORKSPACE_LINKS.map((l) => l.href))
    const missing = ALL_TOOLS.map((t) => t.href).filter(
      (href) => !workspaceHrefs.has(href) && !WORKSPACE_EXCLUDE_FROM_TOOLS.has(href),
    )
    expect(missing, "add these to WORKSPACE_LINKS, or to WORKSPACE_EXCLUDE_FROM_TOOLS with a reason").toEqual([])
  })

  it("covers every Workspace-menu entry on /tools, except the documented exceptions", () => {
    const toolHrefs = new Set(ALL_TOOLS.map((t) => t.href))
    const missing = WORKSPACE_LINKS.map((l) => l.href).filter(
      (href) => !toolHrefs.has(href) && !TOOLS_EXCLUDE_FROM_WORKSPACE.has(href),
    )
    expect(missing, "add these to ALL_TOOLS, or to TOOLS_EXCLUDE_FROM_WORKSPACE with a reason").toEqual([])
  })

  it("finds a sane number of static app/ routes, as a canary for the walker itself", () => {
    // A lower bound, not an exact count: catches APP_DIR resolving to the
    // wrong place or the walker silently returning nothing, without needing
    // an update every time a route is added or removed.
    expect(STATIC_APP_ROUTES.length).toBeGreaterThan(50)
  })

  it("covers every static app/ route in at least one catalog, except the documented exceptions", () => {
    const catalogHrefs = new Set([
      ...ALL_TOOLS.map((t) => t.href),
      ...APP_FEATURES.map((f) => f.href),
      ...WORKSPACE_LINKS.map((l) => l.href),
    ])
    const missing = STATIC_APP_ROUTES.filter(
      (route) => !catalogHrefs.has(route) && !ROUTES_WITHOUT_A_CATALOG_ENTRY.has(route),
    )
    expect(
      missing,
      "add these to a catalog (ALL_TOOLS/APP_FEATURES/WORKSPACE_LINKS), or to ROUTES_WITHOUT_A_CATALOG_ENTRY with a reason",
    ).toEqual([])
  })

  it("keeps the documented catalog-less routes honest — each is really absent from every catalog", () => {
    const catalogHrefs = new Set([
      ...ALL_TOOLS.map((t) => t.href),
      ...APP_FEATURES.map((f) => f.href),
      ...WORKSPACE_LINKS.map((l) => l.href),
    ])
    for (const route of ROUTES_WITHOUT_A_CATALOG_ENTRY) {
      expect(catalogHrefs.has(route), `${route} is now cataloged — drop it from ROUTES_WITHOUT_A_CATALOG_ENTRY`).toBe(
        false,
      )
    }
  })
})
