/**
 * @fileoverview Guards `ToolPageHeader` adoption across `/tools` entries.
 *
 * `components/tools/ToolPageHeader.tsx` replaced the old hand-rolled
 * "← Back"-only header with one that also gives a tool page a favorite-star
 * toggle and Docs/Guide links — but the migration happened page-by-page, and
 * nothing checked that a page actually adopted it. This test walks every
 * `ALL_TOOLS` entry's `app/**\/page.tsx` and asserts it imports
 * `ToolPageHeader`, unless the route is in `TOOLS_WITHOUT_TOOL_PAGE_HEADER` —
 * a route with a documented reason not to (or not yet migrated).
 *
 * Mirrors `tool-catalog-consistency.test.ts`'s exclude-set-with-a-reason
 * pattern: a route added to `ALL_TOOLS` without `ToolPageHeader` and without
 * an entry here fails immediately instead of silently missing the favorite
 * toggle and docs links every other tool page has.
 */
import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { ALL_TOOLS } from "../../src/routes/tools/tool-groups"

/**
 * `ALL_TOOLS` routes that intentionally don't use `ToolPageHeader`, each
 * with a reason:
 *
 * - `/reason-editor` and `/doc` are large, native editor workspaces with
 *   their own bespoke chrome, not a standalone-tool page in
 *   `ToolPageHeader`'s sense.
 * - `/tools/mobile-setup` is a companion guide page bundled under the
 *   Mobile Setup group (see `tool-catalog-consistency.test.ts`'s
 *   `FEATURES_EXCLUDE_FROM_TOOLS`), not a tool with its own workspace.
 */
const TOOLS_WITHOUT_TOOL_PAGE_HEADER = new Set(["/reason-editor", "/doc", "/tools/mobile-setup"])

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")
const APP_DIR = join(APP_ROOT, "app")

function importsToolPageHeader(href: string): boolean {
  const source = readFileSync(join(APP_DIR, ...href.split("/").filter(Boolean), "page.tsx"), "utf8")
  return /\bToolPageHeader\b/.test(source)
}

describe("ToolPageHeader coverage", () => {
  it("covers every /tools entry, except the documented exceptions", () => {
    const missing = ALL_TOOLS.map((t) => t.href).filter(
      (href) => !TOOLS_WITHOUT_TOOL_PAGE_HEADER.has(href) && !importsToolPageHeader(href),
    )
    expect(
      missing,
      "have these pages render <ToolPageHeader>, or add them to TOOLS_WITHOUT_TOOL_PAGE_HEADER with a reason",
    ).toEqual([])
  })

  it("keeps the documented exceptions honest — each still really lacks ToolPageHeader", () => {
    const migrated = [...TOOLS_WITHOUT_TOOL_PAGE_HEADER].filter(
      (href) => ALL_TOOLS.some((t) => t.href === href) && importsToolPageHeader(href),
    )
    expect(migrated, "these routes now use ToolPageHeader — drop them from TOOLS_WITHOUT_TOOL_PAGE_HEADER").toEqual(
      [],
    )
  })
})
