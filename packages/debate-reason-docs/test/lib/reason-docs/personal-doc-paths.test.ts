import { describe, expect, it } from "vitest"
import {
  isPersonalDocPath,
  isPersonalDocSide,
  parsePersonalDocPath,
  personalDocHref,
  type PersonalDocSide,
} from "../../../src/lib/reason-docs/personal-doc-paths"

describe("isPersonalDocSide", () => {
  it("accepts aff and neg", () => {
    expect(isPersonalDocSide("aff")).toBe(true)
    expect(isPersonalDocSide("neg")).toBe(true)
  })

  it("rejects anything else", () => {
    for (const s of ["", "affirmative", "negative", "AFF", "negotiation", null, undefined]) {
      expect(isPersonalDocSide(s)).toBe(false)
    }
  })
})

describe("personalDocHref", () => {
  it("builds a username / side / slug address", () => {
    expect(personalDocHref("alexgul", "aff", "aca-affirmative-msci-2026")).toBe(
      "/alexgul/aff/aca-affirmative-msci-2026",
    )
  })

  it("omits the slug when there is none", () => {
    expect(personalDocHref("alexgul", "aff")).toBe("/alexgul/aff")
    expect(personalDocHref("alexgul", "neg", null)).toBe("/alexgul/neg")
  })

  it("keeps the slug's own slashes as path structure", () => {
    expect(personalDocHref("alexgul", "aff", "impacts/warming-1ac")).toBe(
      "/alexgul/aff/impacts/warming-1ac",
    )
  })
})

describe("parsePersonalDocPath", () => {
  it("reads username, side and slug", () => {
    expect(parsePersonalDocPath("/alexgul/aff/aca-affirmative-msci-2026")).toEqual({
      username: "alexgul",
      side: "aff",
      slug: "aca-affirmative-msci-2026",
    })
    expect(parsePersonalDocPath("/alexgul/neg/impacts/warming-1ac")).toEqual({
      username: "alexgul",
      side: "neg",
      slug: "impacts/warming-1ac",
    })
  })

  it("reads no slug on the bare /<username>/<side>", () => {
    expect(parsePersonalDocPath("/alexgul/aff")).toEqual({
      username: "alexgul",
      side: "aff",
      slug: null,
    })
    expect(parsePersonalDocPath("/alexgul/aff/")).toEqual({
      username: "alexgul",
      side: "aff",
      slug: null,
    })
  })

  it("returns null for anything else", () => {
    for (const p of [
      "/",
      "/alexgul",
      "/alexgul/",
      "/alexgul/affirmative",
      "/alexgul/negotiation",
      "/docs/vcx27/aff/case",
      "/reason-editor/foo",
      "",
      null,
    ]) {
      expect(parsePersonalDocPath(p)).toBeNull()
    }
  })
})

describe("isPersonalDocPath", () => {
  it("is true only on personal-file addresses", () => {
    expect(isPersonalDocPath("/alexgul/aff/aca-affirmative-msci-2026")).toBe(true)
    expect(isPersonalDocPath("/alexgul/neg")).toBe(true)
    expect(isPersonalDocPath("/alexgul")).toBe(false)
    expect(isPersonalDocPath("/docs/vcx27/aff/case")).toBe(false)
    expect(isPersonalDocPath("/reason-editor/foo")).toBe(false)
    expect(isPersonalDocPath(null)).toBe(false)
  })
})

describe("round trip", () => {
  const cases: Array<{ username: string; side: PersonalDocSide; slug: string | null }> = [
    { username: "alexgul", side: "aff", slug: "aca-affirmative-msci-2026" },
    { username: "alexgul", side: "neg", slug: "impacts/warming-1ac" },
    { username: "a.b_c-9", side: "aff", slug: null },
  ]

  it("parses what it builds", () => {
    for (const { username, side, slug } of cases) {
      expect(parsePersonalDocPath(personalDocHref(username, side, slug))).toEqual({
        username,
        side,
        slug,
      })
    }
  })
})
