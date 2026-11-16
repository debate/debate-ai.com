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
 *
 * The reverse is checked too: a `<ToolPageHeader>` whose href is not in
 * `ALL_TOOLS` must pass its own `title`, or its heading is the raw path.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { ALL_TOOLS } from "../../src/routes/tools/tool-groups"

/**
 * `ALL_TOOLS` routes that intentionally don't use `ToolPageHeader`, each
 * with a reason:
 *
 * - `/reason-editor` and `/research/docs` are large, native editor workspaces with
 *   their own bespoke chrome, not a standalone-tool page in
 *   `ToolPageHeader`'s sense.
 */
const TOOLS_WITHOUT_TOOL_PAGE_HEADER = new Set(["/reason-editor", "/research/docs"])

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")
const ROUTES_DIR = join(PACKAGE_ROOT, "src", "routes")
const APP_DIR = join(PACKAGE_ROOT, "..", "..", "apps", "debate-web", "app")

/**
 * The app's `page.tsx` for `href` — or, when that page only re-exports a
 * `@debate-ai/webview/routes/…` module, as most do, that module's source. A route
 * with no `app/` page (served from the `routes/index.ts` registry instead)
 * reads its `routes/<href>/page.tsx` directly. A `?section=` query (a tab of
 * a tabbed page) is ignored: the page is the path's.
 */
function pageSource(href: string): string {
  const segments = href.split("?")[0].split("/").filter(Boolean)
  const appPage = join(APP_DIR, ...segments, "page.tsx")
  if (!existsSync(appPage)) return readFileSync(join(ROUTES_DIR, ...segments, "page.tsx"), "utf8")
  const source = readFileSync(appPage, "utf8")
  const reexport = source.match(/from\s+["']@debate-ai\/webview\/routes\/([^"']+)["']/)
  return reexport ? readFileSync(join(ROUTES_DIR, `${reexport[1]}.tsx`), "utf8") : source
}

/** Every `.tsx` file under `dir`, recursively. */
function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return listSourceFiles(full)
    return full.endsWith(".tsx") ? [full] : []
  })
}

/**
 * The props text of each `<ToolPageHeader …>` opening tag in `source`. Walks
 * the tag with brace depth and string state, so an `actions={<X onClick={() =>
 * a > b} />}` prop doesn't end the tag early the way a `[^>]*` regex would.
 */
function toolPageHeaderTags(source: string): string[] {
  const tags: string[] = []
  const opener = /<ToolPageHeader(?![\w])/g
  for (let match = opener.exec(source); match; match = opener.exec(source)) {
    let depth = 0
    let quote: string | null = null
    let i = match.index + match[0].length
    for (; i < source.length; i++) {
      const ch = source[i]
      if (quote) {
        if (ch === "\\") i++
        else if (ch === quote) quote = null
      } else if (ch === '"' || ch === "'" || ch === "`") quote = ch
      else if (ch === "{") depth++
      else if (ch === "}") depth--
      else if (ch === ">" && depth === 0) break
    }
    tags.push(source.slice(match.index + match[0].length, i))
  }
  return tags
}

function importsToolPageHeader(href: string): boolean {
  return /\bToolPageHeader\b/.test(pageSource(href))
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

  it("gives every <ToolPageHeader> a title — from the catalog or passed explicitly", () => {
    // A header resolves its title as `title ?? catalogLabel ?? href`, so a
    // page whose href left the catalog and passes no `title` shows the raw
    // path as its heading (this happened to `/research/cards/library` and
    // `/research/cards/argument-library`).
    const cataloged = new Set(ALL_TOOLS.map((t) => t.href))
    const headers = listSourceFiles(join(PACKAGE_ROOT, "src")).flatMap((file) =>
      toolPageHeaderTags(readFileSync(file, "utf8")).map((tag) => ({ file: relative(PACKAGE_ROOT, file), tag })),
    )
    expect(headers.length).toBeGreaterThan(20)

    const untitled = headers
      .filter(({ tag }) => {
        if (/\btitle=/.test(tag)) return false
        const href = tag.match(/\bhref="([^"]+)"/)?.[1]
        // A computed href can't be checked statically; give it a title instead.
        return href === undefined || !cataloged.has(href)
      })
      .map(({ file, tag }) => `${file}: ${tag.replace(/\s+/g, " ").slice(0, 120)}`)

    expect(untitled, "pass `title` (and `description` / `icon`) to these headers, or add their href to ALL_TOOLS").toEqual(
      [],
    )
  })

  it("reads opening tags whose props hold `>` inside braces", () => {
    const source = `
      <ToolPageHeader href="/x" actions={<Button onClick={() => a > b} />} backHref="/y" />
      <ToolPageHeader
        href="/z"
        title="Zed"
      >
        child
      </ToolPageHeader>
      <ToolPageHeaderProps />
    `
    const tags = toolPageHeaderTags(source)
    expect(tags).toHaveLength(2)
    expect(tags[0]).toContain('backHref="/y"')
    expect(tags[1]).toContain('title="Zed"')
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
