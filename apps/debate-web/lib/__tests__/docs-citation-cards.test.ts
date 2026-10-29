/**
 * @fileoverview Pins the citation matching behind the Synergy Slayer hover
 * cards (`packages/debate-help-docs/lib/mdx/citation-cards.ts`): each
 * author-date citation in the critique pages finds its References entry, by
 * number and anchor, and a citation with no entry stays plain text.
 *
 * Lives here because debate-help-docs is not a Vitest project of its own.
 */
import { readdirSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
  buildCitationIndex,
  findCitations,
  parseByline,
  parseReferences,
} from "../../../../packages/debate-help-docs/lib/mdx/citation-cards"

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..")
const SLAYER_DIR = join(
  REPO_ROOT,
  "packages/debate-help-docs/content/docs/learn/critiques/synergy-slayer-critiques",
)

const SAMPLE = `---
title: References
---

<ExpandAllDetails />

| Words |
|---:|
| 3 |

1. <details><summary>Alinsky, Saul. 1971. <em>Rules for Radicals</em>. New York: Random House.</summary><div className="debate-card"><p><em>Community organizer</em></p><p><u><mark>Change</mark></u> comes from power.</p></div></details>
2. <details><summary>Dean, Mitchell. 1994. <em>Critical and Effective Histories</em>. London: Routledge.</summary><div className="debate-card"><p><em>Sociologist</em></p><p>Text.</p></div></details>
3. <details><summary>Dean, Mitchell. 2004. “Four Theses on the Powers of Life and Death.” <em>Contretemps</em> 5.</summary><div className="debate-card"><p>Text.</p></div></details>
4. <details><summary>Krause, Keith, and Michael C. Williams, eds. 1997. <em>Critical Security Studies</em>.</summary><div className="debate-card"><p>Text.</p></div></details>
5. <details><summary>Ross Arguedas, Amy, et al. 2022. <em>Echo Chambers</em>. Oxford: Reuters Institute.</summary><div className="debate-card"><p>Text.</p></div></details>
6. <details><summary>Nietzsche, Friedrich. (1888) 1990. <em>Twilight of the Idols</em>.</summary><div className="debate-card"><p>Text.</p></div></details>
7. Tetlock, Philip E. *Expert Political Judgment*. 2nd ed., Princeton UP, 2017.
8. <details><summary>Žižek, Slavoj. 2016. “The Sexual Is Political.” <em>The Philosophical Salon</em>.</summary><div className="debate-card"><p>Text.</p></div></details>
9. <details><summary>Inskeep, Steve. 2008. “A Debatable Point.” <em>NPR</em>.</summary><div className="debate-card"><p>Text.</p></div></details>
`

const entries = parseReferences(SAMPLE)
const index = buildCitationIndex(entries)

/** The cited text and entry id of every match in `text`. */
function cite(text: string) {
  return findCitations(text, index).map((m) => [text.slice(m.start, m.end), m.entry.id])
}

describe("parseReferences", () => {
  it("numbers entries by list position and gives each a readable anchor", () => {
    expect(entries.map((e) => [e.number, e.id])).toEqual([
      [1, "ref-alinsky-1971"],
      [2, "ref-dean-1994"],
      [3, "ref-dean-2004"],
      [4, "ref-krause-1997"],
      [5, "ref-ross-arguedas-2022"],
      [6, "ref-nietzsche-1990"],
      [7, "ref-tetlock-2017"],
      [8, "ref-zizek-2016"],
      [9, "ref-inskeep-2008"],
    ])
  })

  it("keeps the bibliography line and the card body, as HTML", () => {
    const [alinsky] = entries
    expect(alinsky!.citationHtml).toBe("Alinsky, Saul. 1971. <em>Rules for Radicals</em>. New York: Random House.")
    expect(alinsky!.cardHtml).toBe(
      '<div class="debate-card"><p><em>Community organizer</em></p><p><u><mark>Change</mark></u> comes from power.</p></div>',
    )
  })

  it("reads a plain Markdown entry with no card", () => {
    const tetlock = entries[6]!
    expect(tetlock.citationHtml).toContain("<em>Expert Political Judgment</em>")
    expect(tetlock.cardHtml).toBe("")
  })
})

describe("parseByline", () => {
  it("drops editor roles and keeps co-authors' surnames", () => {
    expect(parseByline("Krause, Keith, and Michael C. Williams, eds")).toEqual({
      surnames: ["Krause", "Williams"],
      etAl: false,
    })
  })

  it("treats a byline with no comma as a corporate author", () => {
    expect(parseByline("Bethesda Game Studios")).toEqual({ surnames: ["Bethesda Game Studios"], etAl: false })
  })
})

describe("findCitations", () => {
  it("matches narrative citations, possessives and page locators", () => {
    expect(cite("as Alinsky (1971) argued")).toEqual([["Alinsky (1971)", "ref-alinsky-1971"]])
    expect(cite("Žižek’s (2016) point")).toEqual([["Žižek’s (2016)", "ref-zizek-2016"]])
    expect(cite("Alinsky (1971, 66) says")).toEqual([["Alinsky (1971, 66)", "ref-alinsky-1971"]])
  })

  it("links each year of a multi-year narrative citation to its own entry", () => {
    expect(cite("Dean (1994, 2004) rejects")).toEqual([
      ["1994", "ref-dean-1994"],
      ["2004", "ref-dean-2004"],
    ])
  })

  it("matches parenthetical citations part by part", () => {
    expect(cite("(Krause and Williams 1997; Ross Arguedas et al. 2022, 4)")).toEqual([
      ["Krause and Williams 1997", "ref-krause-1997"],
      ["Ross Arguedas et al. 2022, 4", "ref-ross-arguedas-2022"],
    ])
    expect(cite("(cf. Alinsky 1971: 12)")).toEqual([["Alinsky 1971: 12", "ref-alinsky-1971"]])
  })

  it("matches original-year, title-cited and two-author citations", () => {
    expect(cite("Nietzsche ([1888] 1990) wrote")).toEqual([["Nietzsche ([1888] 1990)", "ref-nietzsche-1990"]])
    expect(cite("(“Debatable Point” 2008)")).toEqual([["“Debatable Point” 2008", "ref-inskeep-2008"]])
    expect(cite("Krause and Williams (1997)")).toEqual([["Krause and Williams (1997)", "ref-krause-1997"]])
  })

  it("leaves citations with no entry, wrong years and partial names as plain text", () => {
    expect(cite("Szacki (1995) and (Collins 2023)")).toEqual([])
    expect(cite("Alinsky (1972)")).toEqual([])
    expect(cite("McDean (1994)")).toEqual([])
    expect(cite("In 1971 (a year)")).toEqual([])
  })
})

describe("Synergy Slayer of Critiques", () => {
  const references = parseReferences(readFileSync(join(SLAYER_DIR, "references.mdx"), "utf8"))
  const slayerIndex = buildCitationIndex(references)
  const pages = readdirSync(SLAYER_DIR).filter((f) => f.endsWith(".mdx") && f !== "references.mdx")

  it("parses every References entry with a year and a unique anchor", () => {
    expect(references.length).toBeGreaterThan(50)
    expect(references.every((e) => /^\d{4}/.test(e.year))).toBe(true)
    expect(new Set(references.map((e) => e.id)).size).toBe(references.length)
  })

  it("links citations on the critique pages to their entries", () => {
    const linked = pages.flatMap((page) =>
      findCitations(readFileSync(join(SLAYER_DIR, page), "utf8"), slayerIndex).map((m) => m.entry.id),
    )
    expect(linked.length).toBeGreaterThan(100)
    expect(linked).toContain("ref-shanahan-1993")
  })
})
