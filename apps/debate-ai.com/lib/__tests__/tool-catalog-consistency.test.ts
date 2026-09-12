/**
 * @fileoverview Guards route coverage across the app's hand-maintained tool
 * catalogs.
 *
 * `app/tools/tool-groups.ts`'s `ALL_TOOLS` already is the single source of
 * truth for `/tools`, the favorites system, and the app-wide command
 * palette (`GlobalCommandPalette.tsx` imports it directly). Two catalogs
 * still can't import it and so are kept in sync by hand instead:
 *
 * - `debate-feature-catalog`'s `APP_FEATURES` — a different page
 *   (`/features`) with its own curated, differently-voiced copy per entry,
 *   grouped into a different category scheme. Recombining the two into one
 *   data source would mean either forcing `/features`'s marketing copy to
 *   read like `/tools`'s functional grid or vice versa — out of scope for a
 *   de-duplication fix (see the GitHub issue this closes). What *can* be
 *   shared without a copy rewrite is the route list itself.
 * - `debate-editor`'s `WORKSPACE_LINKS` — the Reason Editor's Workspace menu
 *   and quick-search `t` prefix. `debate-editor` has no dependency on the
 *   Next.js app (and so can't import `tool-groups.ts` at runtime) — see that
 *   file's own header comment.
 *
 * Before this test, a tool added to `ALL_TOOLS` and nowhere else silently
 * reached `/tools`, favorites, and the command palette but not `/features`
 * or the editor's Workspace menu, with no error anywhere (the exact gap
 * `command-palette.mdx`'s Known gaps calls "a fourth hand-maintained tool
 * list"). This file is a test-only relative import into `debate-editor`'s
 * source — the app already depends on `debate-editor` as a package, so this
 * doesn't add a dependency edge that wasn't already there.
 */
import { describe, expect, it } from "vitest"

import { ALL_TOOLS } from "@/app/tools/tool-groups"
import { APP_FEATURES } from "debate-feature-catalog/src/feature-catalog"
import { WORKSPACE_LINKS } from "../../../../packages/debate-editor/src/editor/workspace-links"

/**
 * `/tools` entries that intentionally have no `/features` counterpart — a
 * companion guide page bundled under the Mobile Setup group, not a distinct
 * user-facing surface.
 */
const FEATURES_EXCLUDE_FROM_TOOLS = new Set(["/tools/mobile-setup"])

/**
 * `/features` entries that intentionally have no `/tools` counterpart — core
 * nav destinations reachable from the app dock rather than tools listed on
 * the `/tools` grid.
 */
const TOOLS_EXCLUDE_FROM_FEATURES = new Set(["/videos", "/cards", "/debate"])

/**
 * `/tools` entries that intentionally have no Workspace-menu counterpart.
 * `/reason-editor` can't link to itself from inside its own Workspace menu,
 * and `/tools/mobile-setup` is a companion guide, not a "major tool" per
 * `workspace-links.ts`'s own header comment.
 */
const WORKSPACE_EXCLUDE_FROM_TOOLS = new Set(["/reason-editor", "/tools/mobile-setup"])

/** The Workspace menu's own trailing "All Tools" link back to `/tools`. */
const TOOLS_EXCLUDE_FROM_WORKSPACE = new Set(["/tools"])

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

  it("covers every Workspace-menu entry on /tools, except the trailing All Tools link", () => {
    const toolHrefs = new Set(ALL_TOOLS.map((t) => t.href))
    const missing = WORKSPACE_LINKS.map((l) => l.href).filter(
      (href) => !toolHrefs.has(href) && !TOOLS_EXCLUDE_FROM_WORKSPACE.has(href),
    )
    expect(missing, "add these to ALL_TOOLS, or to TOOLS_EXCLUDE_FROM_WORKSPACE with a reason").toEqual([])
  })
})
