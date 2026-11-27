/**
 * @fileoverview A Topic Starter's address is `/<topic code>/<file path>`
 * (`/vcx27/aff/aff-k/k-aff-answers`), at the site root, and the old
 * `/docs/<topic code>/…` 308s to it. Resolved here through vinext's own
 * config matchers — the ones the Worker runs, in the same order (config
 * redirects, then `beforeFiles` rewrites) — against the real `next.config.mjs`.
 *
 * Also pins that the root form shadows nothing: no top-level route, static
 * file or reserved username is shaped like a topic code, and no username can
 * be (`@debate-ai/reason-docs/lib/reason-docs/personal-doc-paths`).
 */
import { readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  encodeRedirectLocation,
  matchRedirect,
  matchRewrite,
  preserveRedirectDestinationQuery,
  requestContextFromRequest,
} from "vinext/config/config-matchers"
import { RESERVED_USERNAMES, isUsername } from "@debate-ai/reason-docs/lib/reason-docs/personal-doc-paths"
import { TOPIC_CODE_SOURCE, isTopicCode, parseTopicDocsPath } from "@debate-ai/reason-docs/lib/reason-docs/topic-doc-paths"
import nextConfig, { TOPIC_CODE_SOURCE as CONFIG_TOPIC_CODE_SOURCE } from "../../next.config.mjs"

type Redirect = Parameters<typeof matchRedirect>[1][number]
type Rewrite = Parameters<typeof matchRewrite>[1][number]

const ORIGIN = "https://d.ebate.app"
const redirects = (await nextConfig.redirects!()) as Redirect[]
const rewrites = (await nextConfig.rewrites!()) as { beforeFiles: Rewrite[]; afterFiles: Rewrite[] }

/** What the Worker answers a config redirect with: status and `Location`. */
function redirectFor(pathAndQuery: string): { status: number; location: string } | null {
  const url = new URL(pathAndQuery, ORIGIN)
  const ctx = requestContextFromRequest(new Request(url))
  const match = matchRedirect(url.pathname, redirects, ctx)
  if (!match) return null
  return {
    status: match.statusCode,
    location: encodeRedirectLocation(preserveRedirectDestinationQuery(match.destination, url.search, match.destinationQuery)),
  }
}

/** The page a `beforeFiles` rewrite serves the path from, or `null`. (Its
 *  internal query — unused params such as `?code=vcx27` — never reaches the
 *  address bar, so only the pathname is compared.) */
function beforeFilesRewrite(pathAndQuery: string): string | null {
  const url = new URL(pathAndQuery, ORIGIN)
  const page = matchRewrite(url.pathname, rewrites.beforeFiles, requestContextFromRequest(new Request(url)))
  return page == null ? null : new URL(page, ORIGIN).pathname
}

/** Follows redirects to the address the browser ends on, then the page that renders it. */
function resolve(pathAndQuery: string): { address: string; hops: number; page: string } {
  let address = pathAndQuery
  let hops = 0
  for (let next = redirectFor(address); next; next = redirectFor(address)) {
    expect(next.status, address).toBe(308)
    address = next.location
    if (++hops > 5) throw new Error(`redirect loop at ${address}`)
  }
  const pathname = new URL(address, ORIGIN).pathname
  return { address, hops, page: beforeFilesRewrite(address) ?? pathname }
}

describe("Topic Starter addresses", () => {
  it("serves /<topic code>/<path> from the Debate Editor, with no redirect", () => {
    for (const path of ["/vcx27", "/vcx27/aff/aff-k/k-aff-answers", "/lda27/neg", "/pfb27/pro/case", "/ndt26/x", "/bq27", "/vcx1928/aff", "/lda1999/aff", "/ld21b/neg"]) {
      expect(redirectFor(path), path).toBeNull()
      expect(beforeFilesRewrite(path), path).toBe("/reason-editor")
    }
  })

  it("308s the old /docs/<topic code>/… to the root form, path and query kept", () => {
    expect(resolve("/docs/vcx27/aff/aff-k/k-aff-answers")).toEqual({
      address: "/vcx27/aff/aff-k/k-aff-answers",
      hops: 1,
      page: "/reason-editor",
    })
    expect(resolve("/docs/vcx27")).toEqual({ address: "/vcx27", hops: 1, page: "/reason-editor" })
    expect(resolve("/docs/lda27/neg/cp/x?share=abc&utm_source=t").address).toBe("/lda27/neg/cp/x?share=abc&utm_source=t")
    expect(resolve("/docs/pfb27/aff/case%20one").address).toBe("/pfb27/aff/case%20one")
    // Old letter-last codes keep their spelling; the editor reads them as the new code.
    expect(resolve("/docs/ld21b/neg").address).toBe("/ld21b/neg")
    expect(parseTopicDocsPath("/ld21b/neg")).toEqual({ code: "ldb21", ref: "neg" })
  })

  it("sends the older vcs<yy> policy links to vcx<yy> at the root in one hop", () => {
    expect(resolve("/docs/vcs27/aff/case?x=1")).toEqual({ address: "/vcx27/aff/case?x=1", hops: 1, page: "/reason-editor" })
    expect(resolve("/docs/vcs26")).toEqual({ address: "/vcx26", hops: 1, page: "/reason-editor" })
  })

  it("leaves the help docs at /docs, the index included", () => {
    for (const path of ["/docs", "/docs/learn", "/docs/journal/synergy-slayer-critiques", "/docs/vcx2027", "/docs/vcx27x/aff", "/docs/dev/api"]) {
      const { address, page } = resolve(path)
      expect(new URL(address, ORIGIN).pathname.startsWith("/docs"), path).toBe(true)
      expect(page, path).not.toBe("/reason-editor")
    }
  })

  it("does not claim top-level pages, files, personal files or near-miss codes", () => {
    for (const path of [
      "/", "/rank", "/rank/vcx", "/tools", "/api", "/api/docs-tree", "/admin", "/login", "/settings/preferences",
      "/reason-editor", "/research/docs/x", "/@harker-ll", "/favicon.ico", "/sitemap.xml", "/robots.txt",
      "/service-worker.js", "/logo.png", "/alexgul/aff/k-aff-answers", "/vcx2027/aff", "/vcx27x",
    ]) {
      expect(beforeFilesRewrite(path), path).toBeNull()
      expect(redirectFor(path)?.location ?? "", path).not.toMatch(new RegExp(`^/(?:${TOPIC_CODE_SOURCE})(?:/|$)`))
    }
  })

  it("matches a code in any case, as the editor reads it", () => {
    // vinext (like Next) matches config paths case-insensitively.
    expect(beforeFilesRewrite("/VCX27/aff")).toBe("/reason-editor")
    expect(resolve("/docs/VCX27/aff").address).toBe("/VCX27/aff")
    expect(parseTopicDocsPath("/VCX27/aff")).toEqual({ code: "vcx27", ref: "aff" })
  })

  it("carries the same topic-code shape as @debate-ai/reason-docs", () => {
    expect(CONFIG_TOPIC_CODE_SOURCE).toBe(TOPIC_CODE_SOURCE)
  })
})

describe("the site's first path segment", () => {
  const appDir = join(__dirname, "../../app")
  const topLevel = readdirSync(appDir).filter((name) => !name.startsWith("[") && !name.startsWith("("))

  it("has no top-level route or static file shaped like a topic code", () => {
    expect(topLevel.length).toBeGreaterThan(20)
    // Files are served at the root under their own names; routes under the
    // folder's. Next metadata files (robots.ts, sitemap.ts) drop their extension.
    for (const name of [...topLevel, ...topLevel.map((name) => name.replace(/\.[^.]+$/, ""))]) {
      expect(isTopicCode(name), name).toBe(false)
    }
  })

  it("reserves no username that is shaped like a topic code, and accepts none", () => {
    for (const name of RESERVED_USERNAMES) expect(isTopicCode(name), name).toBe(false)
    for (const code of ["vcx27", "lda27", "pfb27", "ndt26", "bq27", "vcx1928", "ld21b"]) {
      expect(isUsername(code), code).toBe(false)
    }
  })
})
