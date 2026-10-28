import { describe, expect, it, vi } from "vitest"

import { createJudgeProfileLookup, judgeProfileUrl } from "../../src/judge-paradigms/client"
import { renderParadigmMarkdown } from "../../src/judge-paradigms/markdown"
import { MAX_PARADIGM_LENGTH, nameKey, paradigmHasCode, parseOwnParadigmInput, parseTabroomPersonId } from "../../src/judge-paradigms/types"
import { applyMark } from "../../src/ui/paradigm/JudgeParadigmEditor"

describe("parseTabroomPersonId", () => {
  it("takes an id, a paradigm link or an API path", () => {
    expect(parseTabroomPersonId(12345)).toBe(12345)
    expect(parseTabroomPersonId(" 12345 ")).toBe(12345)
    expect(parseTabroomPersonId("https://www.tabroom.com/index/paradigm.mhtml?judge_person_id=678")).toBe(678)
    expect(parseTabroomPersonId("https://api.tabroom.com/v1/rest/paradigms/91")).toBe(91)
    expect(parseTabroomPersonId("Jane Doe")).toBeNull()
    expect(parseTabroomPersonId(-3)).toBeNull()
  })
})

describe("parseOwnParadigmInput", () => {
  it("accepts Markdown and an optional Tabroom link", () => {
    expect(parseOwnParadigmInput({ markdown: "Hi\r\nthere", tabroomPersonId: "" })).toEqual({ ok: true, value: { markdown: "Hi\nthere", tabroomPersonId: null } })
    expect(parseOwnParadigmInput({ markdown: "x", tabroomPersonId: "judge_person_id=5" })).toEqual({ ok: true, value: { markdown: "x", tabroomPersonId: 5 } })
  })

  it("rejects bad links, non-text and overlong paradigms", () => {
    expect(parseOwnParadigmInput({ markdown: "x", tabroomPersonId: "nope" }).ok).toBe(false)
    expect(parseOwnParadigmInput({ markdown: 3 }).ok).toBe(false)
    expect(parseOwnParadigmInput({ markdown: "x".repeat(MAX_PARADIGM_LENGTH + 1) }).ok).toBe(false)
  })
})

describe("helpers", () => {
  it("keys names by first and last word, accents and case dropped", () => {
    expect(nameKey("  José Q. Álvarez ")).toEqual({ first: "jose", last: "alvarez" })
    expect(nameKey("Cher")).toEqual({ first: "cher", last: "" })
  })

  it("finds a verification code in a paradigm's text, not its markup", () => {
    expect(paradigmHasCode("<p>I judge. <b>debate-ai-abc</b></p>", "debate-ai-abc")).toBe(true)
    expect(paradigmHasCode("<p title='debate-ai-abc'>No</p>", "debate-ai-abc")).toBe(false)
    expect(paradigmHasCode(null, "debate-ai-abc")).toBe(false)
  })

  it("renders Markdown with raw HTML escaped", () => {
    const html = renderParadigmMarkdown("## Theory\n- **Condo** fine\n<script>alert(1)</script>")
    expect(html).toContain("<h2>Theory</h2>")
    expect(html).toContain("<strong>Condo</strong>")
    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;script&gt;")
  })

  it("wraps a selection or prefixes the selected lines", () => {
    const bold = { label: "Bold", icon: (() => null) as never, wrap: ["**", "**"] as [string, string] }
    expect(applyMark("tech over truth", 0, 4, bold)).toEqual({ text: "**tech** over truth", start: 2, end: 6 })
    const list = { label: "Bulleted list", icon: (() => null) as never, linePrefix: "- " }
    expect(applyMark("a\nb\nc", 2, 5, list).text).toBe("a\n- b\n- c")
  })
})

describe("createJudgeProfileLookup", () => {
  it("asks by id, else by name, once per judge", async () => {
    expect(judgeProfileUrl({ personId: 7, first: "A", last: "B" })).toBe("/api/judge-paradigms?personId=7")
    expect(judgeProfileUrl({ personId: null, first: "Ann", last: "Yu" })).toBe("/api/judge-paradigms?first=Ann&last=Yu")
    expect(judgeProfileUrl({ personId: null, first: "", last: "Yu" })).toBeNull()

    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ profile: { personId: 7, name: "A B" } }), { status: 200 }))
    const lookup = createJudgeProfileLookup("/api/judge-paradigms", fetchImpl as unknown as typeof fetch)
    expect(await lookup({ personId: 7, first: "A", last: "B" })).toMatchObject({ personId: 7 })
    await lookup({ personId: 7, first: "A", last: "B" })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("resolves a failure to null and tries again next time", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline")
    })
    const lookup = createJudgeProfileLookup("/api/judge-paradigms", fetchImpl as unknown as typeof fetch)
    expect(await lookup({ personId: 7, first: "A", last: "B" })).toBeNull()
    await lookup({ personId: 7, first: "A", last: "B" })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
