/**
 * @fileoverview The model fallback the `/api/vsbot/*` routes use: a bad
 * OpenRouter key no longer turns every bot turn into a canned line when
 * another provider's key works.
 */
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }))
vi.mock("../store", () => ({ createPracticeVsAiStore: vi.fn() }))

const { createFallbackModelClient } = await import("../backend")

const failing = (message: string) => ({ generateText: vi.fn(async () => Promise.reject(new Error(message))) })
const answering = (text: string) => ({ generateText: vi.fn(async () => text) })

describe("createFallbackModelClient", () => {
  it("is null with no keys and the client itself with one", () => {
    const only = answering("hi")
    expect(createFallbackModelClient([])).toBeNull()
    expect(createFallbackModelClient([only])).toBe(only)
  })

  it("moves on to the next key when one fails", async () => {
    const openrouter = failing("AI API returned 401: User not found")
    const anthropic = answering("Two off. First, the spending DA.")
    const client = createFallbackModelClient([openrouter, anthropic])!
    vi.spyOn(console, "error").mockImplementation(() => {})
    await expect(client.generateText("prompt")).resolves.toBe("Two off. First, the spending DA.")
    expect(openrouter.generateText).toHaveBeenCalledOnce()
  })

  it("rethrows the last error when every key fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const client = createFallbackModelClient([failing("first"), failing("second")])!
    await expect(client.generateText("prompt")).rejects.toThrow("second")
  })
})
