/**
 * @fileoverview Pins the split of the LD framework docs page: old
 * `/docs/learn/ld-ethics#<section>` links land on ld-framework (server
 * redirect), and the sections that moved to ld-philosophers are forwarded on
 * by `<MovedAnchors>` (`packages/debate-help-docs/components/guides/moved-anchors.tsx`).
 *
 * Lives here because debate-help-docs is not a Vitest project of its own.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { movedAnchorTarget } from "../../../../packages/debate-help-docs/components/guides/moved-anchors"
import nextConfig from "../../next.config.mjs"

const LEARN = join(__dirname, "../../../../packages/debate-help-docs/content/docs/learn")
const read = (name: string) => readFileSync(join(LEARN, name), "utf8")
const sectionIds = (mdx: string) => [...mdx.matchAll(/^#{2,4} .*\[#([a-z0-9-]+)\]\s*$/gm)].map((m) => m[1])

describe("movedAnchorTarget", () => {
  const ids = ["kant", "rawls"]
  it("forwards a moved section", () => {
    expect(movedAnchorTarget("#kant", "/docs/learn/ld-philosophers", ids)).toBe("/docs/learn/ld-philosophers#kant")
  })
  it("leaves sections that stayed, and empty hashes, alone", () => {
    expect(movedAnchorTarget("#answering-1", "/docs/learn/ld-philosophers", ids)).toBeNull()
    expect(movedAnchorTarget("", "/docs/learn/ld-philosophers", ids)).toBeNull()
  })
})

describe("LD framework / philosophers split", () => {
  const framework = read("ld-framework.mdx")
  const philosophers = read("ld-philosophers.mdx")

  it("forwards exactly the sections that live on ld-philosophers", () => {
    const listed = JSON.parse(framework.match(/<MovedAnchors[^>]*ids=\{(\[[^\]]*\])\}/)![1])
    expect(listed).toEqual(sectionIds(philosophers))
    for (const id of listed) expect(sectionIds(framework)).not.toContain(id)
  })

  it("redirects every old framework section to the page that holds it", async () => {
    const redirects = await nextConfig.redirects!()
    const old = redirects.filter((r) => r.source.startsWith("/docs/learn/framework/"))
    expect(old.length).toBeGreaterThan(0)
    for (const r of old) {
      const [page, id] = r.destination.replace("/docs/learn/", "").split("#")
      expect(sectionIds(read(`${page}.mdx`))).toContain(id)
    }
    expect(redirects).toContainEqual(
      expect.objectContaining({ source: "/docs/learn/ld-ethics", destination: "/docs/learn/ld-framework" }),
    )
  })
})
