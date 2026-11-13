/**
 * @fileoverview Pins the citation style switcher's formatter
 * (`packages/debate-help-docs/lib/citation-styles.ts`): the Synergy Slayer
 * References pages are written in Chicago notes-bibliography (the year near
 * the end), and each entry is rewritten into APA, MLA or Harvard on demand.
 * Author-date entries still parse. Entries that are neither (court cases)
 * stay as written.
 *
 * Lives here because debate-help-docs is not a Vitest project of its own.
 */
import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
  CITATION_STYLES,
  expandPages,
  formatCitation,
  parseChicagoByline,
  parseChicagoEntry,
  toAuthorDate,
} from "../../../../packages/debate-help-docs/lib/citation-styles"

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..")
const REFERENCE_PAGES = [
  "packages/debate-help-docs/content/docs/publications/synergy-slayer-critiques/references.mdx",
  "packages/debate-help-docs/content/docs/publications/synergy-slayer-intrinsicness/references.mdx",
  "packages/debate-help-docs/content/docs/publications/debate-ai-collective-consciousness/references.mdx",
]

const ARTICLE =
  'Bostrom, Nick. 2003. “Are You Living in a Computer Simulation?” <em>Philosophical Quarterly</em> 53 (211): 243–55. <a href="https://doi.org/10.1111/1467-9213.00309">doi.org/10.1111/1467-9213.00309</a>.'
const CHAPTER =
  "Connolly, William E. 2004. “The Complexity of Sovereignty.” In <em>Sovereign Lives: Power in Global Politics</em>, edited by Jenny Edkins, Véronique Pin-Fat, and Michael J. Shapiro, 23–40. Routledge."
const BOOK = "Krause, Keith, and Michael C. Williams, eds. 1997. <em>Critical Security Studies: Concepts and Cases</em>. Minneapolis: University of Minnesota Press."
const WEB =
  'Arora, Rav. 2022. “The Culture Taboo.” <em>City Journal</em>, September 27. <a href="https://www.city-journal.org/article/the-culture-taboo">www.city-journal.org/article/the-culture-taboo</a>.'
const CASE = "<em>Brandenburg v. Ohio</em>, 395 U.S. 444 (1969)."

describe("formatCitation", () => {
  it("leaves Chicago as written", () => {
    expect(formatCitation(ARTICLE, "chicago")).toBe(ARTICLE)
  })

  it("formats a journal article", () => {
    expect(formatCitation(ARTICLE, "apa")).toBe(
      'Bostrom, N. (2003). Are You Living in a Computer Simulation? <em>Philosophical Quarterly</em>, <em>53</em>(211), 243–255. <a href="https://doi.org/10.1111/1467-9213.00309">https://doi.org/10.1111/1467-9213.00309</a>',
    )
    expect(formatCitation(ARTICLE, "mla")).toBe(
      'Bostrom, Nick. “Are You Living in a Computer Simulation?” <em>Philosophical Quarterly</em>, vol. 53, no. 211, 2003, pp. 243–55, <a href="https://doi.org/10.1111/1467-9213.00309">doi.org/10.1111/1467-9213.00309</a>.',
    )
    expect(formatCitation(ARTICLE, "harvard")).toBe(
      'Bostrom, N. (2003) ‘Are You Living in a Computer Simulation?’, <em>Philosophical Quarterly</em>, 53(211), pp. 243–255. Available at: <a href="https://doi.org/10.1111/1467-9213.00309">https://doi.org/10.1111/1467-9213.00309</a>.',
    )
  })

  it("formats a chapter with several editors", () => {
    expect(formatCitation(CHAPTER, "apa")).toBe(
      "Connolly, W. E. (2004). The Complexity of Sovereignty. In J. Edkins, V. Pin-Fat, & M. J. Shapiro (Eds.), <em>Sovereign Lives: Power in Global Politics</em> (pp. 23–40). Routledge.",
    )
    expect(formatCitation(CHAPTER, "mla")).toBe(
      "Connolly, William E. “The Complexity of Sovereignty.” <em>Sovereign Lives: Power in Global Politics</em>, edited by Jenny Edkins, Véronique Pin-Fat, and Michael J. Shapiro, Routledge, 2004, pp. 23–40.",
    )
    expect(formatCitation(CHAPTER, "harvard")).toBe(
      "Connolly, W.E. (2004) ‘The Complexity of Sovereignty’, in Edkins, J., Pin-Fat, V. and Shapiro, M.J. (eds.) <em>Sovereign Lives: Power in Global Politics</em>. Routledge, pp. 23–40.",
    )
  })

  it("formats an edited book, dropping the place for APA and MLA", () => {
    expect(formatCitation(BOOK, "apa")).toBe(
      "Krause, K., & Williams, M. C. (Eds.). (1997). <em>Critical Security Studies: Concepts and Cases</em>. University of Minnesota Press.",
    )
    expect(formatCitation(BOOK, "mla")).toBe(
      "Krause, Keith, and Michael C. Williams, editors. <em>Critical Security Studies: Concepts and Cases</em>. University of Minnesota Press, 1997.",
    )
    expect(formatCitation(BOOK, "harvard")).toBe(
      "Krause, K. and Williams, M.C. (eds.) (1997) <em>Critical Security Studies: Concepts and Cases</em>. Minneapolis: University of Minnesota Press.",
    )
  })

  it("moves a periodical's date where each style wants it", () => {
    expect(formatCitation(WEB, "apa")).toMatch(/^Arora, R\. \(2022, September 27\)\. The Culture Taboo\. <em>City Journal<\/em>\. /)
    expect(formatCitation(WEB, "mla")).toContain("<em>City Journal</em>, 27 September 2022, <a ")
    expect(formatCitation(WEB, "harvard")).toContain("<em>City Journal</em>, 27 September. Available at: ")
  })

  it("leaves entries that aren't author-date alone", () => {
    for (const style of CITATION_STYLES) expect(formatCitation(CASE, style)).toBe(CASE)
  })

  it("parses most entries on both References pages", () => {
    const summaries = REFERENCE_PAGES.flatMap((page) =>
      readFileSync(join(REPO_ROOT, page), "utf8")
        .split(/\r?\n/)
        .map((line) => /^\d+\.\s+<details>\s*<summary>([\s\S]*?)<\/summary>/.exec(line)?.[1])
        .filter((summary): summary is string => Boolean(summary)),
    )
    const parsed = summaries.filter((summary) => parseChicagoEntry(summary))
    expect(summaries.length).toBeGreaterThan(200)
    expect(parsed.length / summaries.length).toBeGreaterThan(0.9)
  })
})

describe("toAuthorDate", () => {
  const link = '<a href="https://example.com/a">example.com/a</a>.'
  it("moves a notes-bibliography year up behind the byline", () => {
    expect(toAuthorDate(`Arora, Rav. “The Culture Taboo.” <em>City Journal</em>, September 27, 2022. ${link}`)).toBe(
      `Arora, Rav. 2022. “The Culture Taboo.” <em>City Journal</em>, September 27. ${link}`,
    )
    expect(toAuthorDate("Albert, Michael. “Looking Back.” <em>Z Magazine</em>, September 1998.")).toBe(
      "Albert, Michael. 1998. “Looking Back.” <em>Z Magazine</em>, September.",
    )
    expect(toAuthorDate("Dean, Mitchell. <em>Critical and Effective Histories</em>. London: Routledge, 1994.")).toBe(
      "Dean, Mitchell. 1994. <em>Critical and Effective Histories</em>. London: Routledge.",
    )
    expect(toAuthorDate("Burns, M. “Lesson 2.” Truman Library, n.d.")).toBe("Burns, M. n.d. “Lesson 2.” Truman Library.")
  })

  it("reads journal volumes, issues and original years", () => {
    expect(toAuthorDate("Connolly, William E. “Assembling the Left.” <em>Boundary 2</em> 26, no. 3 (1999): 183–201.")).toBe(
      "Connolly, William E. 1999. “Assembling the Left.” <em>Boundary 2</em> 26 (3): 183–201.",
    )
    expect(toAuthorDate("Dean, Mitchell. “Four Theses.” <em>Contretemps</em>, no. 5 (December 2004): 16–29.")).toBe(
      "Dean, Mitchell. 2004. “Four Theses.” <em>Contretemps</em>, no. 5 (December): 16–29.",
    )
    expect(
      toAuthorDate("Nietzsche, Friedrich. <em>Twilight of the Idols</em>. Penguin Books, 1990. Originally published 1888."),
    ).toBe("Nietzsche, Friedrich. (1888) 1990. <em>Twilight of the Idols</em>. Penguin Books.")
  })

  it("keeps author-date entries and gives up on court cases", () => {
    expect(toAuthorDate(ARTICLE)).toBe(ARTICLE)
    expect(toAuthorDate("<em>Wickard v. Filburn</em>, 317 U.S. 111 (1942).")).toBeUndefined()
  })

  it("formats a notes-bibliography entry like its author-date twin", () => {
    const nb =
      'Bostrom, Nick. “Are You Living in a Computer Simulation?” <em>Philosophical Quarterly</em> 53, no. 211 (2003): 243–55. <a href="https://doi.org/10.1111/1467-9213.00309">doi.org/10.1111/1467-9213.00309</a>.'
    for (const style of ["apa", "mla", "harvard"] as const) expect(formatCitation(nb, style)).toBe(formatCitation(ARTICLE, style))
  })

  it("writes every References entry with its year at the end", () => {
    for (const page of REFERENCE_PAGES) {
      const summaries = readFileSync(join(REPO_ROOT, page), "utf8")
        .split(/\r?\n/)
        .map((line) => /^\d+\.\s+<details>\s*<summary>([\s\S]*?)<\/summary>/.exec(line)?.[1])
        .filter((summary): summary is string => Boolean(summary))
      for (const summary of summaries) expect(summary).not.toMatch(/^[^<“]+?\.\s+(?:\(\d{4}\)\s+)?(?:\d{4}|n\.d)\.\s/)
    }
  })
})

describe("parseChicagoByline", () => {
  it("reads co-authors, suffixes, et al. and editors", () => {
    expect(parseChicagoByline("Kirgis, Frederic L., Jr.").people).toEqual([
      { family: "Kirgis", given: "Frederic L.", suffix: "Jr." },
    ])
    expect(parseChicagoByline("Foster, Peter, et al.")).toMatchObject({ etAl: true, people: [{ family: "Foster" }] })
    expect(parseChicagoByline("Macauley, David, ed.")).toMatchObject({ editors: true })
    expect(parseChicagoByline("Debate AI Institute").people).toEqual([{ family: "Debate AI Institute", given: "", suffix: "" }])
  })
})

describe("expandPages", () => {
  it("writes abbreviated ranges in full", () => {
    expect(expandPages("243–55")).toBe("243–255")
    expect(expandPages("1446–49")).toBe("1446–1449")
    expect(expandPages("1–26")).toBe("1–26")
  })
})
