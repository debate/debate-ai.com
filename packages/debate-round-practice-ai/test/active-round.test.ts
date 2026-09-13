import { beforeEach, describe, expect, it, vi } from "vitest"
import type { StartedDebate } from "../src/ui/BotSelection"
import { clearActiveRound, readActiveRound, writeActiveRound } from "../src/ui/active-round"

/** Minimal in-memory `localStorage` mock — this package's Vitest environment is `node`, with no DOM. */
class MemoryStorage {
  private store = new Map<string, string>()
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
  clear(): void {
    this.store.clear()
  }
}

const ROUND: StartedDebate = {
  debateId: "42",
  botName: "Aristotle",
  botLevel: "Legends",
  topic: "This house would ban homework",
  stance: "For",
  phaseTimings: [{ name: "Opening", time: 180 }],
}

beforeEach(() => {
  vi.stubGlobal("window", {})
  vi.stubGlobal("localStorage", new MemoryStorage())
})

describe("readActiveRound", () => {
  it("returns null without a window, so a server render never resumes", () => {
    vi.stubGlobal("window", undefined)
    writeActiveRound("u1", ROUND)
    expect(readActiveRound("u1")).toBeNull()
  })

  it("returns null when nothing is stored", () => {
    expect(readActiveRound("u1")).toBeNull()
  })

  it("returns null for corrupt JSON", () => {
    localStorage.setItem("practiceVsAiActiveRound_u1", "{not json")
    expect(readActiveRound("u1")).toBeNull()
  })

  it("returns null for a value missing required fields", () => {
    localStorage.setItem("practiceVsAiActiveRound_u1", JSON.stringify({ debateId: "42" }))
    expect(readActiveRound("u1")).toBeNull()
  })

  it("returns null when a phase timing entry is malformed", () => {
    localStorage.setItem(
      "practiceVsAiActiveRound_u1",
      JSON.stringify({ ...ROUND, phaseTimings: [{ name: "Opening" }] }),
    )
    expect(readActiveRound("u1")).toBeNull()
  })

  it("returns the saved round once written", () => {
    writeActiveRound("u1", ROUND)
    expect(readActiveRound("u1")).toEqual(ROUND)
  })

  it("namespaces rounds per user", () => {
    writeActiveRound("u1", ROUND)
    expect(readActiveRound("u2")).toBeNull()
  })

  it("falls back to a shared guest bucket when signed out", () => {
    writeActiveRound(undefined, ROUND)
    expect(readActiveRound(undefined)).toEqual(ROUND)
    expect(localStorage.getItem("practiceVsAiActiveRound_guest")).not.toBeNull()
  })
})

describe("clearActiveRound", () => {
  it("removes the stored round", () => {
    writeActiveRound("u1", ROUND)
    clearActiveRound("u1")
    expect(readActiveRound("u1")).toBeNull()
  })

  it("is a no-op when nothing was stored", () => {
    expect(() => clearActiveRound("u1")).not.toThrow()
  })
})
