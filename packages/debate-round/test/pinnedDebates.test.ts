import { describe, expect, it } from "vitest"
import {
  MAX_PINNED_DEBATES,
  PINNED_DEBATES_KEY,
  readPinnedDebateIds,
  togglePinnedDebate,
  writePinnedDebateIds,
} from "../src/state/pinnedDebates"

function memoryStorage(initial?: string) {
  const data = new Map<string, string>()
  if (initial !== undefined) data.set(PINNED_DEBATES_KEY, initial)
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    stored: () => JSON.parse(data.get(PINNED_DEBATES_KEY) ?? "null"),
  }
}

describe("pinnedDebates", () => {
  it("stores pins as { roundId, pinnedAt } records with a string id", () => {
    const storage = memoryStorage()
    writePinnedDebateIds([5, 7], storage)

    expect(storage.stored()).toEqual([
      { roundId: "5", pinnedAt: expect.any(Number) },
      { roundId: "7", pinnedAt: expect.any(Number) },
    ])
    expect(readPinnedDebateIds(storage)).toEqual([5, 7])
  })

  it("reads a legacy number[] and rewrites it as records", () => {
    const storage = memoryStorage(JSON.stringify([3, 4, 3]))

    expect(readPinnedDebateIds(storage)).toEqual([3, 4])
    expect(storage.stored().map((r: { roundId: string }) => r.roundId)).toEqual(["3", "4"])
  })

  it("accepts records pulled from the account, including numeric-looking strings", () => {
    const storage = memoryStorage(
      JSON.stringify([{ roundId: "12", pinnedAt: 1 }, { roundId: "", pinnedAt: 2 }, { roundId: "abc" }, null]),
    )

    expect(readPinnedDebateIds(storage)).toEqual([12])
  })

  it("keeps an existing pin's time when another pin changes", () => {
    const storage = memoryStorage(JSON.stringify([{ roundId: "1", pinnedAt: 111 }]))
    togglePinnedDebate(2, storage)

    expect(storage.stored()[0]).toEqual({ roundId: "1", pinnedAt: 111 })
    expect(readPinnedDebateIds(storage)).toEqual([1, 2])
  })

  it("unpins a pinned round on toggle", () => {
    const storage = memoryStorage(JSON.stringify([{ roundId: "1", pinnedAt: 1 }]))

    expect(togglePinnedDebate(1, storage)).toEqual([])
    expect(storage.stored()).toEqual([])
  })

  it("caps the list, dropping the oldest pin", () => {
    const storage = memoryStorage()
    const ids = Array.from({ length: MAX_PINNED_DEBATES + 1 }, (_, i) => i + 1)

    expect(writePinnedDebateIds(ids, storage)).toEqual(ids.slice(1))
  })

  it("returns [] for malformed storage", () => {
    expect(readPinnedDebateIds(memoryStorage("{not json"))).toEqual([])
    expect(readPinnedDebateIds(memoryStorage('{"a":1}'))).toEqual([])
  })
})
