/**
 * @fileoverview Pins the split of the LD framework docs page:
 * `/docs/learn/ld-ethics` is now LD Philosophers (the ethical theories) and
 * `/docs/learn/ld-framework` holds burdens, metaethics and skepticism. Old
 * `ld-ethics#<section>` links whose section moved are forwarded by
 * `<MovedAnchors>` (`packages/debate-help-docs/components/guides/moved-anchors.tsx`),
 * and the old `/docs/learn/framework/<slug>` and `ld-philosophers` URLs redirect.
 *
 * Lives here because debate-help-docs is not a Vitest project of its own.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { movedAnchorTarget } from "../../../../packages/debate-help-docs/components/guides/moved-anchors"
import nextConfig from "../../next.config.mjs"

const LEARN = join(__dirname, "../../../../packages/debate-help-docs/content/docs/debate-basics")
const read = (name: string) => readFileSync(join(LEARN, name), "utf8")
const sectionIds = (mdx: string) => [...mdx.matchAll(/^#{2,4} .*\[#([a-z0-9-]+)\]\s*$/gm)].map((m) => m[1])

describe("movedAnchorTarget", () => {
  const onPage = (id: string) => ["kant", "rawls"].includes(id)
  it("forwards a section this page no longer has", () => {
    expect(movedAnchorTarget("#answering-1", "/docs/learn/ld-framework", onPage)).toBe(
      "/docs/learn/ld-framework#answering-1",
    )
  })
  it("leaves sections on this page, and empty hashes, alone", () => {
    expect(movedAnchorTarget("#kant", "/docs/learn/ld-framework", onPage)).toBeNull()
    expect(movedAnchorTarget("", "/docs/learn/ld-framework", onPage)).toBeNull()
  })
})

describe("LD framework / philosophers split", () => {
  const ethics = read("ld-ethics.mdx")
  const framework = read("ld-framework.mdx")

  it("keeps the philosophers on ld-ethics and forwards the rest to ld-framework", () => {
    expect(ethics).toMatch(/^title: "LD Philosophers"$/m)
    expect(ethics).toContain('<MovedAnchors to="/docs/learn/ld-framework" />')
    expect(sectionIds(ethics)).toContain("kant")
    expect(sectionIds(framework)).toContain("determinism")
    for (const id of sectionIds(ethics)) expect(sectionIds(framework)).not.toContain(id)
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
      expect.objectContaining({ source: "/docs/learn/ld-philosophers", destination: "/docs/learn/ld-ethics" }),
    )
    expect(redirects.some((r) => r.source === "/docs/learn/ld-ethics")).toBe(false)
  })
})
