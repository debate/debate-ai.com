/**
 * @fileoverview Pins how a stored row says which of the two shapes it holds.
 *
 * Getting this wrong is not a rendering glitch: reading a `.cmir` as HTML puts
 * base64 on the page, and reading HTML as a `.cmir` fails to gunzip and shows
 * the damaged-file notice for a perfectly good document.
 */

import { describe, expect, it } from "vitest"
import { schema, serializeNative, cmirToBase64 } from "debate-editor/engine"
import { STORED_FORMATS, normalizeFormat } from "../format"
import { isCmirContent } from "../content-format"

/** A real one-paragraph `.cmir`, base64-encoded the way a row stores it. */
function sampleCmir(): string {
  const doc = schema.nodes["doc"]!.create(null, [
    schema.nodes["paragraph"]!.create(null, [schema.text("Deterrence fails")]),
  ])
  return cmirToBase64(serializeNative(doc))
}

describe("normalizeFormat", () => {
  it("keeps the one format that isn't the default", () => {
    expect(normalizeFormat("cmir")).toBe(STORED_FORMATS.cmir)
  })

  it("narrows anything else to html rather than storing it", () => {
    // An unrecognized value in the column would make the row unreadable.
    for (const raw of ["html", "", "docx", "CMIR", null, undefined, 7, {}]) {
      expect(normalizeFormat(raw)).toBe(STORED_FORMATS.html)
    }
  })
})

describe("isCmirContent", () => {
  it("believes the column over the content", () => {
    const cmir = sampleCmir()
    expect(isCmirContent({ content: cmir, format: "cmir" })).toBe(true)
    expect(isCmirContent({ content: "<p>Hi</p>", format: "html" })).toBe(false)
  })

  it("sniffs content that arrives without its column", () => {
    // A payload assembled by hand, or a caller that selected only `content`.
    expect(isCmirContent({ content: sampleCmir() })).toBe(true)
    expect(isCmirContent({ content: "<p>Hi</p>" })).toBe(false)
  })

  it("reads an empty or absent row as html, never as a damaged .cmir", () => {
    // A blank document and a folder row both land here.
    expect(isCmirContent({ content: "" })).toBe(false)
    expect(isCmirContent({ content: null, format: "cmir" })).toBe(false)
    expect(isCmirContent({})).toBe(false)
  })
})
