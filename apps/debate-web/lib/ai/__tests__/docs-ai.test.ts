import { afterEach, describe, expect, it, vi } from "vitest"
import {
  DEFAULT_DOCS_AI_ENDPOINT,
  SignInRequiredError,
  configureDocsAi,
  docsAiEndpoint,
  generateWithSite,
  replyText,
} from "@debate-ai/help-docs/docs-ai"

afterEach(() => {
  configureDocsAi({ endpoint: null })
  vi.unstubAllGlobals()
})

function stubFetch(body: string, status = 200) {
  const fetchMock = vi.fn(async () => new Response(body, { status }))
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

describe("docs Suggest questions AI", () => {
  it("calls the hosting site's own endpoint, relative, by default", async () => {
    const fetchMock = stubFetch(JSON.stringify({ text: "1. Why?" }))
    expect(docsAiEndpoint()).toBe(DEFAULT_DOCS_AI_ENDPOINT)
    await expect(generateWithSite({ system: "s", prompt: "p", maxTokens: 100 })).resolves.toBe("1. Why?")
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("/api/reason-ai")
    expect(init.credentials).toBe("same-origin")
    const body = JSON.parse(String(init.body))
    expect(body).toMatchObject({ system: "s", prompt: "p", query: "p", allowGuest: true })
    expect(body.messages).toEqual([{ role: "user", content: "p" }])
  })

  it("uses a configured endpoint and reads other reply shapes", async () => {
    configureDocsAi({ endpoint: "/api/ask" })
    const fetchMock = stubFetch(JSON.stringify({ answer: "Because." }))
    await expect(generateWithSite({ system: "s", prompt: "p", maxTokens: 100 })).resolves.toBe("Because.")
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe("/api/ask")

    stubFetch("plain text answer")
    await expect(generateWithSite({ system: "s", prompt: "p", maxTokens: 100 })).resolves.toBe("plain text answer")
  })

  it("asks to sign in to this site only when the endpoint answers 401", async () => {
    stubFetch(JSON.stringify({ error: "Sign in" }), 401)
    const error = await generateWithSite({ system: "s", prompt: "p", maxTokens: 100 }).catch((e) => e)
    expect(error).toBeInstanceOf(SignInRequiredError)
    expect(String(error.message)).not.toContain("Debate AI")
  })

  it("surfaces the endpoint's error message", async () => {
    stubFetch(JSON.stringify({ error: "Daily limit reached" }), 429)
    await expect(generateWithSite({ system: "s", prompt: "p", maxTokens: 100 })).rejects.toThrow("Daily limit reached")
  })

  it("replyText picks the first text field", () => {
    expect(replyText({ content: "c" })).toBe("c")
    expect(replyText({ response: "r" })).toBe("r")
    expect(replyText(null)).toBe("")
    expect(replyText({ nope: 1 })).toBe("")
  })
})
