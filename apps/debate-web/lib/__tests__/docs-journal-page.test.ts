/**
 * @fileoverview Pins the Debate Argument Intelligence Journal landing page
 * (`packages/debate-help-docs/content/docs/journal/index.mdx`): the journal's
 * name and "Research Journal" subtitle, the short "Debate AI Journal" sidebar
 * label, the retired names staying out of the landing page and masthead, and
 * the Site format section with its citation rules.
 *
 * Lives here because debate-help-docs is not a Vitest project of its own.
 */
import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { JOURNAL } from "../../../../packages/debate-help-docs/components/guides/journal-masthead"

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..")
const JOURNAL_DIR = join(REPO_ROOT, "packages/debate-help-docs/content/docs/journal")
const read = (name: string) => readFileSync(join(JOURNAL_DIR, name), "utf8")

const NAME = "Debate Argument Intelligence Journal"

describe("journal name", () => {
  it("is the Debate Argument Intelligence Journal, with Research Journal as its tagline", () => {
    expect(JOURNAL.name).toBe(NAME)
    expect(JOURNAL.tagline).toBe("Research Journal")
  })

  it("labels the sidebar folder with the short name", () => {
    expect(JSON.parse(read("meta.json")).title).toBe("Debate AI Journal")
  })

  it("no longer uses the old names on the landing page or masthead", () => {
    const mastheadSource = readFileSync(
      join(REPO_ROOT, "packages/debate-help-docs/components/guides/journal-masthead.tsx"),
      "utf8",
    )
    for (const text of [read("index.mdx"), mastheadSource]) {
      expect(text).not.toMatch(/Debate AI (Research )?Journal/)
    }
  })
})

describe("Site format section", () => {
  const page = read("index.mdx")
  const start = page.indexOf("## Site format")
  const section = page.slice(start, page.indexOf("\n## ", start + 1))

  it("exists, and the masthead links to it", () => {
    expect(start).toBeGreaterThan(-1)
    const masthead = readFileSync(
      join(REPO_ROOT, "packages/debate-help-docs/components/guides/journal-masthead.tsx"),
      "utf8",
    )
    expect(masthead).toContain('href: "#site-format"')
  })

  it("states the Chicago base, both citation forms and the NSDA underlined-card rule", () => {
    expect(section).toMatch(/Chicago style/)
    expect(section).toMatch(/numbered/)
    expect(section).toMatch(/author-year/)
    expect(section).toMatch(/NSDA/)
    expect(section).toMatch(/underlined excerpt/)
    expect(section).toMatch(/one-sentence summary/)
  })

  it("lists the three permitted adaptations", () => {
    expect(section).toMatch(/capitalization and punctuation/)
    expect(section).toMatch(/all the relevant page numbers for a book/)
    expect(section).toMatch(/final two digits/)
  })

  it("shows an underlined example card", () => {
    expect(section).toMatch(/<u>[^<]+<\/u>/)
  })

  it("is linked from the contributor notes and the submissions section", () => {
    const contributor = page.slice(page.indexOf("## Contributor notes"), start)
    const submissions = page.slice(page.indexOf("## Submissions"), page.indexOf("## Call for papers"))
    expect(contributor).toContain("(#site-format)")
    expect(submissions).toContain("(#site-format)")
  })
})
