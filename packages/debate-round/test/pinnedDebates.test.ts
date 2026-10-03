import { describe, expect, it } from "vitest"
import {
  LEGACY_PINNED_DEBATES_KEY,
  MAX_PINNED_DEBATES,
  PINNED_DEBATES_KEY,
  orderPinnedRounds,
  pinnedDebateRecordId,
  readPinnedDebateIds,
  readPinnedDebateRecords,
  togglePinnedDebate,
  writePinnedDebateIds,
} from "../src/state/pinnedDebates"
import type { Round } from "../src/types/flow"

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  }
}

describe("pinned debates store", () => {
  it("stores pins as sync-ready records keyed by round", () => {
    const storage = memoryStorage()
    writePinnedDebateIds([3, 7], storage, 1000)

    const stored = JSON.parse(storage.data.get(PINNED_DEBATES_KEY)!)
    expect(stored.map((r: { id: string }) => r.id)).toEqual(["round-3", "round-7"])
    expect(stored.every((r: { pinnedAt: number }) => typeof r.pinnedAt === "number")).toBe(true)
    expect(readPinnedDebateIds(storage)).toEqual([3, 7])
  })

  it("lifts the legacy id list when the new key is absent, preserving order", () => {
    const storage = memoryStorage({ [LEGACY_PINNED_DEBATES_KEY]: "[5,2,5,\"x\"]" })
    expect(readPinnedDebateIds(storage)).toEqual([5, 2])
  })

  it("prefers the new key over the legacy one, even when the new list is empty", () => {
    const storage = memoryStorage({
      [PINNED_DEBATES_KEY]: "[]",
      [LEGACY_PINNED_DEBATES_KEY]: "[1]",
    })
    expect(readPinnedDebateIds(storage)).toEqual([])
  })

  it("ignores malformed storage and malformed records", () => {
    expect(readPinnedDebateIds(memoryStorage({ [PINNED_DEBATES_KEY]: "{oops" }))).toEqual([])
    expect(readPinnedDebateIds(memoryStorage({ [PINNED_DEBATES_KEY]: "{}" }))).toEqual([])
    const storage = memoryStorage({
      [PINNED_DEBATES_KEY]: JSON.stringify([
        { id: "x", roundId: 1, pinnedAt: 10 },
        { roundId: "2", pinnedAt: 20 },
        null,
        { id: "dup", roundId: 1, pinnedAt: 30 },
      ]),
    })
    expect(readPinnedDebateRecords(storage)).toEqual([
      { id: pinnedDebateRecordId(1), roundId: 1, pinnedAt: 10 },
    ])
  })

  it("orders by pinnedAt, so pins merged from another device interleave correctly", () => {
    const storage = memoryStorage({
      [PINNED_DEBATES_KEY]: JSON.stringify([
        { id: "round-9", roundId: 9, pinnedAt: 300 },
        { id: "round-4", roundId: 4, pinnedAt: 100 },
      ]),
    })
    expect(readPinnedDebateIds(storage)).toEqual([4, 9])
  })

  it("toggles a pin on and off", () => {
    const storage = memoryStorage()
    expect(togglePinnedDebate(1, storage)).toEqual([1])
    expect(togglePinnedDebate(2, storage)).toEqual([1, 2])
    expect(togglePinnedDebate(1, storage)).toEqual([2])
    expect(readPinnedDebateIds(storage)).toEqual([2])
  })

  it("keeps existing pins' timestamps when another pin changes", () => {
    const storage = memoryStorage()
    writePinnedDebateIds([1], storage, 1000)
    const before = readPinnedDebateRecords(storage)[0].pinnedAt
    togglePinnedDebate(2, storage)
    expect(readPinnedDebateRecords(storage)[0].pinnedAt).toBe(before)
  })

  it("migrates the legacy list into the new key on the first write", () => {
    const storage = memoryStorage({ [LEGACY_PINNED_DEBATES_KEY]: "[8]" })
    togglePinnedDebate(9, storage)
    expect(JSON.parse(storage.data.get(PINNED_DEBATES_KEY)!).map((r: { roundId: number }) => r.roundId)).toEqual([8, 9])
  })

  it("drops the oldest pin once past the cap", () => {
    const storage = memoryStorage()
    const ids = Array.from({ length: MAX_PINNED_DEBATES + 1 }, (_, i) => i + 1)
    expect(writePinnedDebateIds(ids, storage)).toEqual(ids.slice(1))
  })

  it("does not throw when storage rejects the write", () => {
    const failing = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota")
      },
    }
    expect(() => writePinnedDebateIds([1], failing)).not.toThrow()
  })
})

describe("orderPinnedRounds", () => {
  const round = (id: number) => ({ id }) as Round

  it("follows pin order and skips rounds that no longer exist", () => {
    expect(orderPinnedRounds([round(1), round(2), round(3)], [3, 99, 1]).map((r) => r.id)).toEqual([3, 1])
  })

  it("keeps the newest pins when merged pins exceed the cap", () => {
    const ids = Array.from({ length: MAX_PINNED_DEBATES + 3 }, (_, i) => i + 1)
    const result = orderPinnedRounds(ids.map(round), ids).map((r) => r.id)
    expect(result).toHaveLength(MAX_PINNED_DEBATES)
    expect(result.at(-1)).toBe(ids.at(-1))
  })
})
