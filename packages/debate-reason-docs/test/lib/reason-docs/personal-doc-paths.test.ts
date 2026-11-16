import { describe, expect, it } from "vitest"
import {
  isPersonalDocPath,
  isUsername,
  parsePersonalDocPath,
  personalDocHref,
  pickUsername,
  usernameBase,
} from "../../../src/lib/reason-docs/personal-doc-paths"

describe("usernameBase", () => {
  it("joins the name into lowercase letters and digits", () => {
    expect(usernameBase("Alex Gul")).toBe("alexgul")
    expect(usernameBase("José Núñez")).toBe("josenunez")
    expect(usernameBase("Team 42")).toBe("team42")
  })

  it("falls back to the email, then to user", () => {
    expect(usernameBase("", "debater.one@x.com")).toBe("debaterone")
    expect(usernameBase("—", null)).toBe("user")
    expect(usernameBase(null)).toBe("user")
  })

  it("caps the length", () => {
    expect(usernameBase("a".repeat(80))).toHaveLength(30)
  })
})

describe("pickUsername", () => {
  it("keeps a free base and numbers a taken one from 2", () => {
    expect(pickUsername("alexgul", () => false)).toBe("alexgul")
    const taken = new Set(["alexgul", "alexgul2"])
    expect(pickUsername("alexgul", (h) => taken.has(h))).toBe("alexgul3")
  })

  it("treats page names as taken", () => {
    expect(pickUsername("admin", () => false)).toBe("admin2")
    expect(pickUsername("videos", () => false)).toBe("videos2")
  })
})

describe("isUsername", () => {
  it("accepts handles and rejects page names and other shapes", () => {
    expect(isUsername("alexgul")).toBe(true)
    expect(isUsername("alexgul2")).toBe(true)
    for (const s of ["docs", "settings", "reason-editor", "@harker", "Alex", "a.b", "", null, undefined]) {
      expect(isUsername(s)).toBe(false)
    }
  })
})

describe("personalDocHref", () => {
  it("builds /<username>/<folder path>/<slug>", () => {
    expect(personalDocHref("alexgul", "aff/k-aff-answers")).toBe("/alexgul/aff/k-aff-answers")
    expect(personalDocHref("alexgul", "k-aff-answers")).toBe("/alexgul/k-aff-answers")
  })
})

describe("parsePersonalDocPath", () => {
  it("reads the username and the whole path below it", () => {
    expect(parsePersonalDocPath("/alexgul/aff/k-aff-answers")).toEqual({
      username: "alexgul",
      path: "aff/k-aff-answers",
    })
    expect(parsePersonalDocPath("/alexgul/k-aff-answers/?x=1#y")).toEqual({
      username: "alexgul",
      path: "k-aff-answers",
    })
  })

  it("returns null for pages, profiles and a bare username", () => {
    for (const p of ["/", "/alexgul", "/alexgul/", "/docs/vcx27/aff/case", "/reason-editor/foo", "/@harker/x", "/videos/a/b", "", null]) {
      expect(parsePersonalDocPath(p)).toBeNull()
    }
  })

  it("parses what it builds", () => {
    for (const path of ["aff/k-aff-answers", "impacts/warming-1ac", "case"]) {
      expect(parsePersonalDocPath(personalDocHref("alexgul", path))).toEqual({ username: "alexgul", path })
    }
  })
})

describe("isPersonalDocPath", () => {
  it("is true only on personal-file addresses", () => {
    expect(isPersonalDocPath("/alexgul/aff/k-aff-answers")).toBe(true)
    expect(isPersonalDocPath("/alexgul")).toBe(false)
    expect(isPersonalDocPath("/settings/preferences")).toBe(false)
  })
})
