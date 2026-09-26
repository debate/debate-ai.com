import { readdirSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { describe, expect, it } from "vitest"

import { resolveRoute } from "../../src/host/AppRouter"
import { APP_ROUTES } from "../../src/routes"

const APP_DIR = join(import.meta.dirname, "../../../../apps/debate-ai.com/app")

function pagePatterns(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      if (name === "api" || name.startsWith("_")) continue
      out.push(...pagePatterns(path))
    } else if (name === "page.tsx") {
      const rel = relative(APP_DIR, dir).split(sep).join("/")
      out.push(rel ? `/${rel}` : "/")
    }
  }
  return out
}

describe("route table", () => {
  it("has an entry for every page the web app serves", () => {
    const table = new Set(APP_ROUTES.map((r) => r.pattern))
    const missing = pagePatterns(APP_DIR).filter((p) => !table.has(p))
    expect(missing).toEqual([])
  })

  it("resolves the pages a reader actually visits", () => {
    expect(resolveRoute(APP_ROUTES, "/videos")?.route.pattern).toBe("/videos")
    expect(resolveRoute(APP_ROUTES, "/videos/2022")?.route.pattern).toBe("/videos/[category]")
    expect(resolveRoute(APP_ROUTES, "/cards/leaderboard")?.route.pattern).toBe("/cards/leaderboard")
    expect(resolveRoute(APP_ROUTES, "/tournaments/x/y")?.params).toEqual({ slug: ["x", "y"] })
    expect(resolveRoute(APP_ROUTES, "/no-such-page")).toBeNull()
  })

  it("wraps /cards pages in the cards layout", () => {
    expect(resolveRoute(APP_ROUTES, "/cards/quests")?.route.layout).toBeTypeOf("function")
    expect(resolveRoute(APP_ROUTES, "/videos")?.route.layout).toBeUndefined()
  })
})
