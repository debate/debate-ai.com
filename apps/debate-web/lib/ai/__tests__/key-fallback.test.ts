import { describe, expect, it, vi } from "vitest"

vi.mock("write-language", () => ({ createLLMProvider: vi.fn() }))

const { tryKeysInTurn } = await import("../key-fallback")
const { WriteLanguageChatError } = await import("../write-language-chat")

const OWN = { provider: "openrouter" as const, key: "sk-or-v1-mine", own: true }
const SHARED_OR = { provider: "openrouter" as const, key: "sk-or-v1-site", own: false }
const SHARED_ANT = { provider: "anthropic" as const, key: "sk-ant-site", own: false }

const fail = (status: number, message = `failed ${status}`) => new WriteLanguageChatError(message, status, message)

describe("tryKeysInTurn", () => {
  it("answers on the user's own key first and never meters the plan", async () => {
    const call = vi.fn(async (key: { key: string }) => `reply from ${key.key}`)
    const beforeShared = vi.fn(async () => null)
    const result = await tryKeysInTurn([OWN, SHARED_OR], call, { ownFallsThrough: true, beforeShared })
    expect(result).toMatchObject({ kind: "reply", reply: "reply from sk-or-v1-mine", key: OWN, ownFailure: null })
    expect(call).toHaveBeenCalledTimes(1)
    expect(beforeShared).not.toHaveBeenCalled()
  })

  it("falls back to the site key when the own key fails for any reason", async () => {
    const call = vi.fn(async (key: { own: boolean }) => {
      if (key.own) throw fail(500, "provider hiccup")
      return "site reply"
    })
    const beforeShared = vi.fn(async () => null)
    const result = await tryKeysInTurn([OWN, SHARED_OR], call, { ownFallsThrough: true, beforeShared })
    expect(result.kind).toBe("reply")
    if (result.kind !== "reply") return
    expect(result.reply).toBe("site reply")
    expect(result.key).toBe(SHARED_OR)
    expect(result.ownFailure?.message).toBe("provider hiccup")
    expect(beforeShared).toHaveBeenCalledTimes(1)
  })

  it("stops on the own key's failure when fallback is off (paid requests)", async () => {
    const call = vi.fn(async () => {
      throw fail(402)
    })
    const result = await tryKeysInTurn([OWN, SHARED_OR], call, { ownFallsThrough: false })
    expect(result).toMatchObject({ kind: "failed", key: OWN })
    expect(call).toHaveBeenCalledTimes(1)
  })

  it("stops before the site key when the plan limit says so", async () => {
    const call = vi.fn(async (key: { own: boolean }) => {
      if (key.own) throw fail(401)
      return "site reply"
    })
    const result = await tryKeysInTurn([OWN, SHARED_OR], call, {
      ownFallsThrough: true,
      beforeShared: async () => "limit reached",
    })
    expect(result).toMatchObject({ kind: "stopped", stop: "limit reached" })
    expect(result.ownFailure?.status).toBe(401)
    expect(call).toHaveBeenCalledTimes(1)
  })

  it("moves between shared keys only on a rejected key", async () => {
    const authFail = vi.fn(async (key: { provider: string }) => {
      if (key.provider === "openrouter") throw fail(401, "User not found")
      return "anthropic reply"
    })
    expect(await tryKeysInTurn([SHARED_OR, SHARED_ANT], authFail)).toMatchObject({ kind: "reply", key: SHARED_ANT })

    const serverFail = vi.fn(async () => {
      throw fail(500)
    })
    const result = await tryKeysInTurn([SHARED_OR, SHARED_ANT], serverFail)
    expect(result).toMatchObject({ kind: "failed", key: SHARED_OR })
    expect(serverFail).toHaveBeenCalledTimes(1)
  })

  it("meters the plan once even when several shared keys are tried", async () => {
    const beforeShared = vi.fn(async () => null)
    const call = vi.fn(async () => {
      throw fail(403)
    })
    const result = await tryKeysInTurn([OWN, SHARED_OR, SHARED_ANT], call, { ownFallsThrough: true, beforeShared })
    expect(result).toMatchObject({ kind: "failed", key: SHARED_ANT })
    expect(result.ownFailure?.status).toBe(403)
    expect(beforeShared).toHaveBeenCalledTimes(1)
    expect(call).toHaveBeenCalledTimes(3)
  })
})
