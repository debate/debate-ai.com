import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const root = import.meta.dirname.replace(/\/test$/, "")
const read = (rel: string) => readFileSync(join(root, rel), "utf8")

const COVER_PAGES = [
  "content/docs/journal/synergy-slayer-critiques/index.mdx",
  "content/docs/journal/synergy-slayer-intrinsicness/index.mdx",
  "content/docs/journal/debate-ai-collective-consciousness/index.mdx",
]

describe("journal figure sizes", () => {
  it("caps docs images at 800px wide", () => {
    expect(read("styles/docs.css")).toMatch(/\.prose img\s*{[^}]*max-width:\s*min\(100%,\s*800px\)/)
  })

  it.each(COVER_PAGES)("shows the Figure 1 cover image of %s at 200px", (page) => {
    const mdx = read(page)
    expect(mdx).toMatch(/data-figure-width="200"/)
    expect(mdx).toMatch(/style=\{\{ width: '200px'/)
  })

  it("lets the journal landing images use the full 800px", () => {
    const mdx = read("content/docs/journal/index.mdx")
    expect(mdx).not.toContain("40rem")
    expect(mdx.match(/maxWidth: '800px'/g)).toHaveLength(2)
  })
})
