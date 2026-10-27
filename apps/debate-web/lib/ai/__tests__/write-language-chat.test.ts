import { APICallError } from "ai"
import { beforeEach, describe, expect, it, vi } from "vitest"

const env: Record<string, string | undefined> = {}
vi.mock("@/lib/env", () => ({ getEnv: (key: string) => env[key] }))

const generateText = vi.fn()
vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  generateText: (...args: unknown[]) => generateText(...args),
}))

const createLLMProvider = vi.fn((provider: string, _key: string, model: string, _temperature: number) => ({ provider, model }))
vi.mock("write-language", () => ({
  createLLMProvider: (...args: [string, string, string, number]) => createLLMProvider(...args),
}))

const { cleanApiKey, parseOwnKeyHeader, resolveProviderKey, sharedProviderKeys } = await import("../provider-key")
const { WriteLanguageChatError, isAuthError, writeLanguageChat } = await import("../write-language-chat")

const OPENROUTER = { provider: "openrouter" as const, key: "sk-or-v1-shared", own: false }

beforeEach(() => {
  for (const key of Object.keys(env)) delete env[key]
  generateText.mockReset()
  createLLMProvider.mockClear()
})

describe("cleanApiKey", () => {
  it("strips the newline, quotes and Bearer prefix a pasted secret can carry", () => {
    expect(cleanApiKey("sk-or-v1-abc\n")).toBe("sk-or-v1-abc")
    expect(cleanApiKey('"sk-or-v1-abc"')).toBe("sk-or-v1-abc")
    expect(cleanApiKey("  'sk-or-v1-abc' ")).toBe("sk-or-v1-abc")
    expect(cleanApiKey("Bearer sk-or-v1-abc")).toBe("sk-or-v1-abc")
  })

  it("treats an empty or blank secret as unset", () => {
    expect(cleanApiKey(undefined)).toBeUndefined()
    expect(cleanApiKey("  \n")).toBeUndefined()
    expect(cleanApiKey('""')).toBeUndefined()
  })
})

describe("shared and own keys", () => {
  it("lists OpenRouter before Anthropic, cleaned", () => {
    env.OPENROUTER_API_KEY = "sk-or-v1-shared\n"
    env.ANTHROPIC_API_KEY = "sk-ant-shared"
    expect(sharedProviderKeys()).toEqual([
      OPENROUTER,
      { provider: "anthropic", key: "sk-ant-shared", own: false },
    ])
  })

  it("prefers the caller's own key from the header", () => {
    env.OPENROUTER_API_KEY = "sk-or-v1-shared"
    const request = new Request("https://debate-ai.com/api/reason-ai", {
      headers: { "x-user-ai-key": "sk-or-v1-mine" },
    })
    expect(parseOwnKeyHeader(request)).toEqual({ provider: "openrouter", key: "sk-or-v1-mine", own: true })
    expect(resolveProviderKey(request)).toEqual({ provider: "openrouter", key: "sk-or-v1-mine", own: true })
    expect(resolveProviderKey(new Request("https://debate-ai.com/"))).toEqual(OPENROUTER)
  })
})

describe("writeLanguageChat", () => {
  it("builds the model with write-language and sends the system prompt and messages", async () => {
    generateText.mockResolvedValue({ text: "ok", finishReason: "length" })
    const reply = await writeLanguageChat({
      key: OPENROUTER,
      model: "openrouter/free",
      system: "Find the speeches.",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "captions" },
            { type: "image", source: { type: "base64", media_type: "image/png", data: "AAAA" } },
          ],
        },
      ],
      maxTokens: 2000,
      temperature: 0,
    })
    expect(reply).toEqual({ text: "ok", stopReason: "max_tokens" })
    expect(createLLMProvider).toHaveBeenCalledWith("openrouter", "sk-or-v1-shared", "openrouter/free", 0)
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: "Find the speeches.",
        maxOutputTokens: 2000,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "captions" },
              { type: "image", image: "AAAA", mediaType: "image/png" },
            ],
          },
        ],
      }),
    )
  })

  it("turns OpenRouter's 401 into an error naming the rejected server key", async () => {
    generateText.mockRejectedValue(
      new APICallError({
        message: "Unauthorized",
        url: "https://openrouter.ai/api/v1/chat/completions",
        requestBodyValues: {},
        statusCode: 401,
        responseBody: JSON.stringify({ error: { message: "User not found.", code: 401 } }),
      }),
    )
    const error = await writeLanguageChat({ key: OPENROUTER, model: "openrouter/free", messages: [{ role: "user", content: "hi" }], maxTokens: 10 }).catch((e) => e)
    expect(error).toBeInstanceOf(WriteLanguageChatError)
    expect(error.status).toBe(401)
    expect(error.detail).toBe("User not found.")
    expect(error.message).toMatch(/^AI API returned 401: User not found\. \(OpenRouter rejected the server's OPENROUTER_API_KEY/)
    expect(isAuthError(error)).toBe(true)
  })

  it("reports a network failure as a 502", async () => {
    generateText.mockRejectedValue(new Error("fetch failed"))
    const error = await writeLanguageChat({ key: OPENROUTER, model: "m", messages: [{ role: "user", content: "hi" }], maxTokens: 10 }).catch((e) => e)
    expect(error.status).toBe(502)
    expect(isAuthError(error)).toBe(false)
  })
})
