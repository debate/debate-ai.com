/**
 * Debate Basics pages show a table of contents inside the page body (under the
 * header), built from the page's own heading list.
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import {
  groupInlineToc,
  hasInlineToc,
  inlineTocSize,
} from "../../../../packages/debate-help-docs/lib/fumadocs/inline-toc"

const item = (depth: number, title: string) => ({ depth, title, url: `#${title}` })

describe("groupInlineToc", () => {
  it("groups the top heading level with the level below it, dropping deeper ones", () => {
    const groups = groupInlineToc([
      item(2, "a"),
      item(3, "a1"),
      item(4, "deep"),
      item(3, "a2"),
      item(2, "b"),
      item(3, "b1"),
    ])
    expect(groups.map((g) => [g.item?.title, g.children.map((c) => c.title)])).toEqual([
      ["a", ["a1", "a2"]],
      ["b", ["b1"]],
    ])
    expect(inlineTocSize(groups)).toBe(5)
  })

  it("uses the shallowest level on the page as the top level", () => {
    const groups = groupInlineToc([item(3, "x"), item(4, "x1"), item(3, "y")])
    expect(groups.map((g) => g.item?.title)).toEqual(["x", "y"])
    expect(groups[0].children.map((c) => c.title)).toEqual(["x1"])
  })

  it("keeps sub-headings that come before any top-level heading", () => {
    const groups = groupInlineToc([item(3, "intro"), item(2, "b")])
    expect(groups.map((g) => [g.item?.title, g.children.length])).toEqual([
      [undefined, 1],
      ["b", 0],
    ])
    expect(groupInlineToc([])).toEqual([])
  })
})

describe("hasInlineToc", () => {
  it("is on for Debate Basics pages only", () => {
    expect(hasInlineToc(["debate-basics", "critiques"])).toBe(true)
    expect(hasInlineToc(["debate-basics", "counterplans", "consult-cp"])).toBe(true)
    expect(hasInlineToc(["features", "flow"])).toBe(false)
    expect(hasInlineToc([])).toBe(false)
  })
})

describe("docs page route", () => {
  it("renders the inline table of contents after the toolbar and before the body", () => {
    const route = readFileSync(
      resolve(__dirname, "../../../../packages/debate-help-docs/routes/docs-page.tsx"),
      "utf8",
    )
    const toc = route.indexOf("<InlinePageToc toc={toc} />")
    expect(toc).toBeGreaterThan(route.indexOf("<LLMCopyButton"))
    expect(toc).toBeLessThan(route.indexOf("<MDX "))
  })
})
