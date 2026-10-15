/**
 * @fileoverview Guards `packages/debate-help-docs/content/docs` against dead
 * internal links.
 *
 * `packages/debate-webview/src/lib/docs-links.ts` documents the docs site's
 * structure: `features/*.mdx` is the user-facing page per feature,
 * `internals/*.mdx` the engineering note behind it, `guides/*.mdx` the
 * task-oriented walkthroughs, and every one of them cross-links the others
 * by relative path or `/docs/...` absolute path. Nothing checked that those
 * links actually resolve — `packages/debate-help-docs/content/docs/internals`
 * was deleted in a standalone commit that never touched the ~20 `features/*.mdx`
 * links pointing into it (mostly "see [Tool Data Sync](../internals/tool-data-sync.mdx)"),
 * so every one of them 404'd on the published docs site with nothing to
 * catch it. This test walks every `.mdx`/`.md` file under `content/docs` and
 * fails if a relative (`../`, `./`) or `/docs/`-rooted markdown link doesn't
 * resolve to a real file, so a page (or a whole directory) deleted without
 * updating what links into it fails a test instead of shipping a dead link.
 *
 * Links to non-doc-page targets (external URLs, anchors, mailto, or a
 * relative path with a non-`.md`/`.mdx` extension such as a `.yml` source
 * file linked from `packages/debate-api-client.mdx`) are intentionally not
 * checked here — those aren't pages this docs site serves.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, extname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")
const REPO_ROOT = resolve(APP_ROOT, "..", "..")
const DOCS_ROOT = join(REPO_ROOT, "packages", "debate-help-docs", "content", "docs")

/** Every `.mdx`/`.md` file under `dir`, found by walking the directory tree. */
function findDocFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      files.push(...findDocFiles(full))
    } else if (entry.endsWith(".mdx") || entry.endsWith(".md")) {
      files.push(full)
    }
  }
  return files
}

/** Matches a markdown link/image target: `](target)` or `](target "title")`. */
const LINK_RE = /\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g

/** Extensions this docs site actually serves a page for. */
const DOC_PAGE_EXTENSIONS = new Set(["", ".md", ".mdx"])

/**
 * Whether `target` is a link into this docs site's own pages — as opposed to
 * an external URL, an anchor, or a relative link to a non-doc-page file
 * (source code, a workflow file) that this site doesn't serve.
 */
function isDocPageLink(target: string): boolean {
  if (!target.startsWith("../") && !target.startsWith("./") && !target.startsWith("/docs/")) return false
  const withoutAnchor = target.split("#")[0]
  return DOC_PAGE_EXTENSIONS.has(extname(withoutAnchor))
}

/** Resolves `target` (already known to satisfy {@link isDocPageLink}) to an absolute path. */
function resolveDocLink(fromFile: string, target: string): string {
  const withoutAnchor = target.split("#")[0]
  if (withoutAnchor.startsWith("/docs/")) {
    return join(DOCS_ROOT, withoutAnchor.slice("/docs/".length))
  }
  return resolve(dirname(fromFile), withoutAnchor)
}

/** Whether `path`, `path.mdx`, or `path.md` exists — a link may omit the extension. */
function pageExists(path: string): boolean {
  return existsSync(path) || existsSync(`${path}.mdx`) || existsSync(`${path}.md`)
}

const DOC_FILES = findDocFiles(DOCS_ROOT)

describe("docs internal link consistency", () => {
  it("finds a sane number of doc pages, as a canary for the walker itself", () => {
    // A lower bound, not an exact count: catches DOCS_ROOT resolving to the
    // wrong place or the walker silently returning nothing, without needing
    // an update every time a doc page is added or removed.
    expect(DOC_FILES.length).toBeGreaterThan(50)
  })

  it("resolves every relative/`/docs/`-rooted link to a doc page that actually exists", () => {
    const broken: string[] = []
    for (const file of DOC_FILES) {
      const text = readFileSync(file, "utf-8")
      for (const match of text.matchAll(LINK_RE)) {
        const target = match[1]!
        if (!isDocPageLink(target)) continue
        if (!pageExists(resolveDocLink(file, target))) {
          broken.push(`${relative(REPO_ROOT, file)} -> ${target}`)
        }
      }
    }
    expect(broken, "fix or remove these dead doc-page links").toEqual([])
  })
})
