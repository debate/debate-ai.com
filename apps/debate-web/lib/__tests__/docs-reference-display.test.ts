// @vitest-environment jsdom
/**
 * How the References side panel lays out one source
 * (`packages/debate-help-docs/lib/reference-display.ts`): the card split into
 * summary / qualification / quote, the `Authors ’yy — qualifications` line, and
 * the regex flags (source kind, professor, institution).
 */
import { describe, expect, it } from "vitest"
import { citeAuthors } from "../../../../packages/debate-help-docs/lib/mdx/citation-cards"
import {
  classifySource,
  isInstitutionAuthor,
  isProfessor,
  parseReferenceCard,
  stripAuthorFromQualification,
  yearTick,
} from "../../../../packages/debate-help-docs/lib/reference-display"

describe("citeAuthors", () => {
  it("joins two authors with an ampersand and shortens three or more", () => {
    expect(citeAuthors({ surnames: ["Galloway"], etAl: false })).toBe("Galloway")
    expect(citeAuthors({ surnames: ["Hansson", "Reijven"], etAl: false })).toBe("Hansson & Reijven")
    expect(citeAuthors({ surnames: ["Smith", "Jones", "Lee"], etAl: false })).toBe("Smith et al.")
    expect(citeAuthors({ surnames: ["Smith"], etAl: true })).toBe("Smith et al.")
    expect(citeAuthors({ surnames: [], etAl: false })).toBe("")
  })
})

describe("yearTick", () => {
  it("keeps the last two digits of the last year", () => {
    expect(yearTick("2020")).toBe("’20")
    expect(yearTick("[1888] 1990")).toBe("’90")
    expect(yearTick("n.d.")).toBe("n.d.")
    expect(yearTick("")).toBe("")
  })
})

describe("parseReferenceCard", () => {
  it("splits summary, qualification and the quote after the rule", () => {
    const card = parseReferenceCard(
      '<div class="debate-card"><p>Counterplans distort fiat.</p><p><em>Ryan Galloway is a coach</em></p><p class="stats">x</p><hr/><p>Quote <u>here</u></p><p>More</p></div>',
    )
    expect(card.summary).toBe("Counterplans distort fiat.")
    expect(card.qualification).toBe("Ryan Galloway is a coach")
    expect(card.quoteHtml).toBe("<p>Quote <u>here</u></p><p>More</p>")
  })

  it("takes everything after the summary and qualification as the quote when there is no rule", () => {
    const card = parseReferenceCard('<div class="debate-card"><p>Summary.</p><p>Body text.</p></div>')
    expect(card).toEqual({ summary: "Summary.", qualification: "", quoteHtml: "<p>Body text.</p>" })
  })

  it("has no quote for a summary-only card, and nothing for no card", () => {
    expect(parseReferenceCard('<div class="debate-card"><p>Only.</p></div>').quoteHtml).toBe("")
    expect(parseReferenceCard("")).toEqual({ summary: "", qualification: "", quoteHtml: "" })
  })
})

describe("stripAuthorFromQualification", () => {
  it("drops the author's own name", () => {
    expect(stripAuthorFromQualification("Ryan Galloway is a longtime college debate coach", "Galloway")).toBe(
      "Longtime college debate coach",
    )
    expect(
      stripAuthorFromQualification(
        "Roland Bleiker — Professor of International Relations; Amy Kay — Senior Lecturer",
        "Bleiker & Kay",
      ),
    ).toBe("Professor of International Relations; Senior Lecturer")
  })

  it("leaves names that are not the author's", () => {
    expect(stripAuthorFromQualification("Professor of History, Harvard", "Smith")).toBe("Professor of History, Harvard")
    expect(stripAuthorFromQualification("Foucault is a philosopher", "Smith")).toBe("Foucault is a philosopher")
  })
})

describe("classifySource", () => {
  const kind = classifySource
  it("recognizes journals, books, news, blogs, video and court cases", () => {
    expect(kind('Wu, Jade. “Why We Fear Death.” <em>Journal of Ethics</em> 12, no. 3 (2020): 1–20.')).toBe("journal")
    expect(kind('Smith, Jane. “Title.” <em>Argumentation</em> 5 (2019): 1–9. https://doi.org/10.1/x.')).toBe("journal")
    expect(kind("Smith, Jane. <em>The Book</em>. Cambridge: Cambridge University Press, 2019.")).toBe("book")
    expect(kind('Hall, Stuart. “Essay.” In <em>Collected Essays</em>, edited by A. Lee. London: Verso, 1990.')).toBe("book")
    expect(kind('Lee, Al. “Piece.” <em>The New Yorker</em>, March 3, 2019.')).toBe("news")
    expect(kind('Galloway, Ryan. “Go Vegetarian.” <em>Wyoming Debate Roundup</em>, March 27, 2020.')).toBe("blog")
    expect(kind('Doe, Jo. “Talk.” YouTube video, 2018. https://youtube.com/watch?v=1.')).toBe("video")
    expect(kind("<em>Brandenburg v. Ohio</em>, 395 U.S. 444 (1969).")).toBe("court")
    expect(kind('Roe, Al. “Essay.” Accessed May 1, 2021. https://example.org/essay.')).toBe("web")
    expect(kind('Debate AI Institute. “Paper.” Working paper, Zenodo, 2024.')).toBe("report")
  })

  it("uses the card summary for video games", () => {
    expect(kind("Studio. <em>Game</em>. 2020.", "The video game shows persuasion.")).toBe("game")
  })
})

describe("isInstitutionAuthor and isProfessor", () => {
  it("tells organizations from people", () => {
    expect(isInstitutionAuthor("U.S. Department of Education", "<em>x</em>")).toBe(true)
    expect(isInstitutionAuthor("Debate AI Institute", "Debate AI Institute. “Paper.”")).toBe(true)
    expect(isInstitutionAuthor("Galloway", "Galloway, Ryan. “Go.”")).toBe(false)
    expect(isInstitutionAuthor("Hansson & Reijven", "Hansson, Sven, and Reijven, Jan. <em>Book</em>.")).toBe(false)
  })

  it("flags professors only", () => {
    expect(isProfessor("Professor of History at Harvard")).toBe(true)
    expect(isProfessor("Assistant Professor, UQ")).toBe(true)
    expect(isProfessor("Longtime debate coach")).toBe(false)
  })
})
