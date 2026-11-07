import { describe, expect, it, vi } from "vitest"

vi.mock("write-language", () => ({ createLLMProvider: vi.fn() }))

const { FREE_ATTEMPTS, FREE_REASONING_HEADROOM, chatUntilAnswered } = await import("../free-chat")
const { EmptyReplyError } = await import("../write-language-chat")

const OPENROUTER = { provider: "openrouter" as const, key: "sk-or-v1-site", own: false }
const ANTHROPIC = { provider: "anthropic" as const, key: "sk-ant-site", own: false }
const messages = [{ role: "user" as const, content: "captions" }]

describe("chatUntilAnswered", () => {
  it("gives the free router reasoning headroom and low effort", async () => {
    const call = vi.fn(async () => ({ text: "{}", stopReason: "end_turn" }))
    await chatUntilAnswered({ key: OPENROUTER, model: "openrouter/free", messages, maxTokens: 2000 }, call)
    expect(call).toHaveBeenCalledWith(
      expect.objectContaining({
        maxTokens: 2000 + FREE_REASONING_HEADROOM,
        providerOptions: { openrouter: { reasoning: { effort: "low" } } },
      }),
    )
  })

  it("asks the free router again when a reasoning model answers with nothing", async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce({ text: "", stopReason: "max_tokens", reasoningText: "thinking…" })
      .mockResolvedValueOnce({ text: '{"speeches":[]}', stopReason: "end_turn" })
    const reply = await chatUntilAnswered({ key: OPENROUTER, model: "openrouter/free", messages, maxTokens: 2000 }, call)
    expect(reply.text).toBe('{"speeches":[]}')
    expect(call).toHaveBeenCalledTimes(2)
  })

  it("throws EmptyReplyError after every attempt came back empty", async () => {
    const call = vi.fn(async () => ({ text: "  ", stopReason: "max_tokens" }))
    const error = await chatUntilAnswered({ key: OPENROUTER, model: "openrouter/free", messages, maxTokens: 2000 }, call).catch(
      (e) => e,
    )
    expect(error).toBeInstanceOf(EmptyReplyError)
    expect(error.message).toContain("token budget")
    expect(call).toHaveBeenCalledTimes(FREE_ATTEMPTS)
  })

  it("calls other models once, unchanged", async () => {
    const call = vi.fn(async () => ({ text: "", stopReason: "end_turn" }))
    const req = { key: ANTHROPIC, model: "claude-sonnet-4-6", messages, maxTokens: 2000 }
    await expect(chatUntilAnswered(req, call)).rejects.toBeInstanceOf(EmptyReplyError)
    expect(call).toHaveBeenCalledTimes(1)
    expect(call).toHaveBeenCalledWith(req)
  })
})
