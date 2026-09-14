/**
 * @fileoverview Pins document names as URL segments: what a title becomes,
 * what a segment resolves back to, and what keeps two same-named files apart.
 */

import { describe, expect, it } from "vitest"
import {
  UNTITLED_DOC_SLUG,
  docSlugForId,
  findDocIdBySlug,
  parseDocSlugSegment,
  slugifyDocTitle,
  titleFromDocSlug,
} from "../doc-slug"

describe("slugifyDocTitle", () => {
  it("names a document after its title", () => {
    expect(slugifyDocTitle("CP Answer to States")).toBe("cp-answer-to-states")
  })

  it("collapses punctuation and spacing into single hyphens", () => {
    expect(slugifyDocTitle("  Framing — Util  vs.  Deont!  ")).toBe("framing-util-vs-deont")
  })

  it("keeps a word whole across an apostrophe", () => {
    // "don-t" reads as two words that aren't there.
    expect(slugifyDocTitle("Don't Read This Card")).toBe("dont-read-this-card")
    expect(slugifyDocTitle("Don’t Read This Card")).toBe("dont-read-this-card")
  })

  it("folds accents to the letters they are built from", () => {
    expect(slugifyDocTitle("Réalisme Offensif")).toBe("realisme-offensif")
  })

  it("strips the discriminator marker out of titles", () => {
    // Nothing a reader can type into a title may forge a `~<id>` suffix.
    expect(slugifyDocTitle("CP Answer ~ States")).toBe("cp-answer-states")
  })

  it("names a document with no usable title rather than producing an empty segment", () => {
    for (const title of ["", "   ", "🙂", "!!!", null, undefined]) {
      expect(slugifyDocTitle(title)).toBe(UNTITLED_DOC_SLUG)
    }
  })

  it("cuts a long title on a word boundary", () => {
    const slug = slugifyDocTitle(`${"word ".repeat(40)}end`)
    expect(slug.length).toBeLessThanOrEqual(80)
    expect(slug.endsWith("-")).toBe(false)
    expect(slug.startsWith("word-word")).toBe(true)
  })
})

describe("parseDocSlugSegment", () => {
  it("splits a discriminated segment at its last marker", () => {
    expect(parseDocSlugSegment("cp-answer-to-states~t2")).toEqual({
      slug: "cp-answer-to-states",
      discriminator: "t2",
    })
  })

  it("reads a plain segment as a name with no discriminator", () => {
    expect(parseDocSlugSegment("cp-answer-to-states")).toEqual({
      slug: "cp-answer-to-states",
      discriminator: null,
    })
  })

  it("decodes a percent-encoded segment and survives a broken escape", () => {
    expect(parseDocSlugSegment("cp%20answer")?.slug).toBe("cp answer")
    expect(parseDocSlugSegment("100%")?.slug).toBe("100%")
  })

  it("reads an empty segment as naming nothing", () => {
    for (const segment of ["", "   ", null, undefined]) {
      expect(parseDocSlugSegment(segment)).toBeNull()
    }
  })
})

/** Two files that slugify the same, plus one that doesn't. */
const ENTRIES = [
  { id: "t2", title: "CP Answer to States" },
  { id: "d5", title: "CP answer to states" },
  { id: "d9", title: "Impact Turns" },
]

describe("docSlugForId", () => {
  it("names an unambiguous file with its title alone", () => {
    expect(docSlugForId("d9", ENTRIES)).toBe("impact-turns")
  })

  it("keeps same-named files apart by id", () => {
    expect(docSlugForId("t2", ENTRIES)).toBe("cp-answer-to-states~t2")
    expect(docSlugForId("d5", ENTRIES)).toBe("cp-answer-to-states~d5")
  })

  it("names nothing for a file the catalogue doesn't hold", () => {
    expect(docSlugForId("d404", ENTRIES)).toBeNull()
  })

  it("round-trips every file back to itself", () => {
    for (const entry of ENTRIES) {
      expect(findDocIdBySlug(docSlugForId(entry.id, ENTRIES), ENTRIES)).toBe(entry.id)
    }
  })
})

describe("findDocIdBySlug", () => {
  it("resolves a name to the file that carries it", () => {
    expect(findDocIdBySlug("impact-turns", ENTRIES)).toBe("d9")
  })

  it("prefers the exact id a discriminator names", () => {
    expect(findDocIdBySlug("cp-answer-to-states~d5", ENTRIES)).toBe("d5")
  })

  it("falls back to the name when the discriminator names no file", () => {
    // A link written before that copy was deleted still opens the other one.
    expect(findDocIdBySlug("cp-answer-to-states~d404", ENTRIES)).toBe("t2")
  })

  it("resolves an id used as the whole segment", () => {
    // What an older `?docs=<id>` link becomes once it is rewritten as a path.
    expect(findDocIdBySlug("d9", ENTRIES)).toBe("d9")
  })

  it("resolves nothing for a name no file carries", () => {
    expect(findDocIdBySlug("cp-answer-to-federalism", ENTRIES)).toBeNull()
    expect(findDocIdBySlug(null, ENTRIES)).toBeNull()
  })

  it("matches a name whatever case the link was written in", () => {
    expect(findDocIdBySlug("Impact-Turns", ENTRIES)).toBe("d9")
  })
})

describe("titleFromDocSlug", () => {
  it("reads a segment back as words for a server-rendered tab title", () => {
    expect(titleFromDocSlug("cp-answer-to-states~t2")).toBe("Cp Answer To States")
    expect(titleFromDocSlug("")).toBe("")
  })
})
