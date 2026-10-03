import { describe, expect, it } from "vitest"
import {
  MAX_PINNED_DEBATES,
  PINNED_DEBATES_KEY,
  orderPinnedRounds,
  readPinnedDebateIds,
  togglePinnedDebate,
  writePinnedDebateIds,
} from "../src/state/pinnedDebates"
import type { Round } from "../src/types/flow"

function memoryStorage(initial?: string) {
  const data = new Map<string, string>()
  if (initial !== undefined) data.set(PINNED_DEBATES_KEY, initial)
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  }
}

describe("pinnedDebates", () => {
  it("reads nothing from an empty, malformed or non-array store", () => {
    expect(readPinnedDebateIds(memoryStorage())).toEqual([])
    expect(readPinnedDebateIds(memoryStorage("{not json"))).toEqual([])
    expect(readPinnedDebateIds(memoryStorage('{"a":1}'))).toEqual([])
  })

  it("reads the legacy number[] format in array order", () => {
    expect(readPinnedDebateIds(memoryStorage("[5,3,5,\"x\"]"))).toEqual([5, 3])
  })

  it("writes syncable records keyed by a string id", () => {
    const storage = memoryStorage()
    writePinnedDebateIds([7, 9], storage)
    const stored = JSON.parse(storage.getItem(PINNED_DEBATES_KEY)!)
    expect(stored).toEqual([
      { id: "7", pinnedAt: expect.any(Number) },
      { id: "9", pinnedAt: expect.any(Number) },
    ])
    expect(readPinnedDebateIds(storage)).toEqual([7, 9])
  })

  it("orders by pinnedAt even when records arrive out of order (account merge)", () => {
    const storage = memoryStorage(
      JSON.stringify([
        { id: "2", pinnedAt: 200 },
        { id: "1", pinnedAt: 100 },
        { id: "bad", pinnedAt: 1 },
      ]),
    )
    expect(readPinnedDebateIds(storage)).toEqual([1, 2])
  })

  it("keeps existing pin times when another round is toggled", () => {
    const storage = memoryStorage(JSON.stringify([{ id: "1", pinnedAt: 100 }]))
    togglePinnedDebate(2, storage)
    const stored = JSON.parse(storage.getItem(PINNED_DEBATES_KEY)!)
    expect(stored[0]).toEqual({ id: "1", pinnedAt: 100 })
    expect(readPinnedDebateIds(storage)).toEqual([1, 2])
  })

  it("unpins on a second toggle and upgrades legacy data", () => {
    const storage = memoryStorage("[1,2]")
    expect(togglePinnedDebate(1, storage)).toEqual([2])
    expect(JSON.parse(storage.getItem(PINNED_DEBATES_KEY)!)).toEqual([{ id: "2", pinnedAt: expect.any(Number) }])
  })

  it("drops the oldest pin past the cap", () => {
    const ids = Array.from({ length: MAX_PINNED_DEBATES + 1 }, (_, i) => i + 1)
    expect(writePinnedDebateIds(ids, memoryStorage())).toEqual(ids.slice(1))
  })

  it("orders rounds by pin order and skips rounds that no longer exist", () => {
    const rounds = [{ id: 1 }, { id: 2 }] as Round[]
    expect(orderPinnedRounds(rounds, [2, 99, 1]).map((r) => r.id)).toEqual([2, 1])
  })
})
