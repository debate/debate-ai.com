import { readdirSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { describe, expect, it } from "vitest"

import { resolveRoute } from "../../src/host/AppRouter"
import { APP_ROUTES } from "../../src/routes"

const APP_DIR = join(import.meta.dirname, "../../../../apps/debate-web/app")

function pagePatterns(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      // `docs` is the help site (`debate-help-docs`): rendered only by the web
      // app, outside the app shell, and always entered with a full page load —
      // so it has no place in the host's client-side route table. `blog` is
      // the same: its posts are `debate-help-docs` content, rendered the same way.
      if (name === "api" || name === "docs" || name === "blog" || name.startsWith("_")) continue
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
    expect(resolveRoute(APP_ROUTES, "/videos/mini/OXdffJy8HIs")?.route.pattern).toBe("/videos/mini/[id]")
    expect(resolveRoute(APP_ROUTES, "/coaching/leaderboard")?.route.pattern).toBe("/coaching/leaderboard")
    expect(resolveRoute(APP_ROUTES, "/tournaments/2026/yale-invitational/rounds")?.params).toEqual({ slug: ["2026", "yale-invitational", "rounds"] })
    expect(resolveRoute(APP_ROUTES, "/practice/tabroom")?.route.pattern).toBe("/practice/tabroom/[[...slug]]")
    // Team profiles: the @handle the web app links to, and the
    // /teams spelling it moved from.
    expect(resolveRoute(APP_ROUTES, "/@harker-ll")?.params).toEqual({ team: "harker-ll" })
    expect(resolveRoute(APP_ROUTES, "/teams/harker-ll")?.params).toEqual({ team: "harker-ll" })
    expect(resolveRoute(APP_ROUTES, "/no-such-page")).toBeNull()
  })

  it("wraps /cards pages in the cards layout", () => {
    expect(resolveRoute(APP_ROUTES, "/research/cards/quests")?.route.layout).toBeTypeOf("function")
    expect(resolveRoute(APP_ROUTES, "/videos")?.route.layout).toBeUndefined()
  })
})
