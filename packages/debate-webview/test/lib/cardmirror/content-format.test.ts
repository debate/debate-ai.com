/**
 * @fileoverview `looksLikeCmirBase64` in `lib/cardmirror/content-format.ts`
 * is a copy of CardMirror's own sniff, kept separate so the docs sidebar does
 * not load the editor engine on every page. These cases hold the copy to the
 * engine's answer, so the two cannot drift apart unnoticed.
 */

import { describe, expect, it } from "vitest"
import {
  cmirToBase64,
  looksLikeCmirBase64 as engineLooksLikeCmirBase64,
  schema,
  serializeNative,
} from "debate-editor/engine"
import { isCmirContent, looksLikeCmirBase64 } from "../../../src/lib/cardmirror/content-format"

/** A real one-paragraph `.cmir`, base64-encoded the way a row stores it. */
function sampleCmir(text: string): string {
  const doc = schema.nodes["doc"]!.create(null, [
    schema.nodes["paragraph"]!.create(null, [schema.text(text)]),
  ])
  return cmirToBase64(serializeNative(doc))
}

const uncompressed = btoa(JSON.stringify({ format: "cardmirror-doc", version: 1, doc: {} }))

describe("looksLikeCmirBase64", () => {
  const cases: Array<[string, string]> = [
    ["a gzipped .cmir", sampleCmir("Deterrence fails")],
    ["an uncompressed .cmir", uncompressed],
    ["HTML", "<p>Deterrence fails</p>"],
    ["indented HTML", "  <p>x</p>"],
    ["plain text", "Deterrence fails"],
    ["an empty string", ""],
    ["base64 of something else", btoa("just some text, not a document")],
    ["not base64 at all", "%%%%"],
  ]

  it.each(cases)("agrees with CardMirror's own sniff for %s", (_label, text) => {
    expect(looksLikeCmirBase64(text)).toBe(engineLooksLikeCmirBase64(text))
  })

  it("recognizes both .cmir shapes", () => {
    expect(looksLikeCmirBase64(sampleCmir("x"))).toBe(true)
    expect(looksLikeCmirBase64(uncompressed)).toBe(true)
  })
})

describe("isCmirContent", () => {
  it("trusts the format column over the content", () => {
    expect(isCmirContent({ content: sampleCmir("x"), format: "html" })).toBe(false)
    expect(isCmirContent({ content: "<p>x</p>", format: "cmir" })).toBe(true)
  })

  it("sniffs content that arrives without its column", () => {
    expect(isCmirContent({ content: sampleCmir("x") })).toBe(true)
    expect(isCmirContent({ content: "<p>x</p>" })).toBe(false)
  })
})
