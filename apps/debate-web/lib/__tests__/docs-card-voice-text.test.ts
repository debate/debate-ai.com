// @vitest-environment jsdom
/**
 * @fileoverview Pins what a Synergy Slayer citation hover card's read-aloud
 * button says (`packages/debate-help-docs/components/guides/card-voice-text.ts`
 * and `spokenCite` in `lib/mdx/citation-cards.ts`): the last name and
 * two-digit year once, then only the underlined card text.
 *
 * Lives here because debate-help-docs is not a Vitest project of its own.
 */
import { describe, expect, it } from "vitest"
import { cardVoiceTexts } from "../../../../packages/debate-help-docs/components/guides/card-voice-text"
import { spokenCite } from "../../../../packages/debate-help-docs/lib/mdx/citation-cards"

const CARD =
  '<div class="debate-card"><p>Summary of the article.</p><p><em>Professor of Law</em></p>' +
  '<p class="stats">📊 <u>124</u> <mark>18</mark></p><hr />' +
  "<p><u>In centering productive contradictions, the heuristic </u><u><mark>requires engaging with systems</mark></u>" +
  "<u> as they are</u>. Not underlined at all. <u>Second run.</u></p>" +
  "<p>Plain paragraph.</p><p><u>Next paragraph</u> text</p><p><u>Last.</u></p></div>"

describe("spokenCite", () => {
  it("is the first author's last name and the year's last two digits", () => {
    expect(spokenCite({ surnames: ["Smith", "Jones"], year: "2019" })).toBe("Smith 19")
    expect(spokenCite({ surnames: ["Tetlock"], year: "2004a" })).toBe("Tetlock 04")
    expect(spokenCite({ surnames: ["Nietzsche"], year: "[1888] 1990" })).toBe("Nietzsche 90")
    expect(spokenCite({ surnames: ["Anon"], year: "n.d." })).toBe("Anon")
  })
})

describe("cardVoiceTexts", () => {
  it("says the cite once, then only the underlined text, never the stats line", () => {
    const [cite, text, ...rest] = cardVoiceTexts("Smith 19", CARD)
    expect(cite).toBe("Smith 19.")
    expect(rest).toEqual([])
    expect(text).toBe(
      "In centering productive contradictions, the heuristic requires engaging with systems as they are Second run. Next paragraph Last.",
    )
    expect(text).not.toContain("124")
    expect(text).not.toContain("Not underlined")
    expect(text).not.toContain("Smith")
  })

  it("reads the text after the qualification when nothing is underlined", () => {
    const card = '<div class="debate-card"><p>Summary.</p><p><em>Qual line</em></p></div>'
    expect(cardVoiceTexts("Al-Khatib 20", card)).toEqual(["Al-Khatib 20.", "Summary."])
    const ruled = '<div class="debate-card"><p><em>Qual</em></p><hr /><p>Text</p></div>'
    expect(cardVoiceTexts("X 01", ruled)).toEqual(["X 01.", "Text"])
  })

  it("says only the cite for a card with no text", () => {
    expect(cardVoiceTexts("Tetlock 05", "")).toEqual(["Tetlock 05."])
  })
})
