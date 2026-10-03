import { describe, expect, it } from "vitest";
import {
  MAX_PINNED_DEBATES,
  PINNED_DEBATES_KEY,
  readPinnedDebateIds,
  togglePinnedDebate,
  writePinnedDebateIds,
} from "../src/state/pinnedDebates";
import { findToolRecordCollection, isSyncableToolRecord } from "../../debate-data-sync/src/state/toolRecordCollections";

function memoryStorage(initial?: unknown) {
  const map = new Map<string, string>();
  if (initial !== undefined) map.set(PINNED_DEBATES_KEY, typeof initial === "string" ? initial : JSON.stringify(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    raw: () => JSON.parse(map.get(PINNED_DEBATES_KEY) ?? "null"),
  };
}

describe("pinned debates store", () => {
  it("reads the legacy bare number[] in order", () => {
    expect(readPinnedDebateIds(memoryStorage([3, 1, 2]))).toEqual([3, 1, 2]);
  });

  it("ignores corrupt, non-array and duplicate entries", () => {
    expect(readPinnedDebateIds(memoryStorage("{not json"))).toEqual([]);
    expect(readPinnedDebateIds(memoryStorage({ a: 1 }))).toEqual([]);
    expect(readPinnedDebateIds(memoryStorage([1, "x", null, Number.NaN, 1, 2]))).toEqual([1, 2]);
  });

  it("stores pins as id-keyed records the tool-record sync accepts", () => {
    const storage = memoryStorage();
    togglePinnedDebate(42, storage, 1000);

    expect(storage.raw()).toEqual([{ id: "42", roundId: 42, pinnedAt: 1000 }]);
    const collection = findToolRecordCollection("pinnedDebates")!;
    expect(collection.storageKey).toBe(PINNED_DEBATES_KEY);
    expect(isSyncableToolRecord(collection, storage.raw()[0])).toBe(true);
  });

  it("rewrites a legacy list as records on the next write, keeping its order", () => {
    const storage = memoryStorage([7, 5]);
    expect(togglePinnedDebate(9, storage, 5000)).toEqual([7, 5, 9]);
    expect(storage.raw().map((pin: { roundId: number }) => pin.roundId)).toEqual([7, 5, 9]);
  });

  it("toggles a pin off and keeps the others' timestamps", () => {
    const storage = memoryStorage();
    togglePinnedDebate(1, storage, 100);
    togglePinnedDebate(2, storage, 200);
    expect(togglePinnedDebate(1, storage, 300)).toEqual([2]);
    expect(storage.raw()).toEqual([{ id: "2", roundId: 2, pinnedAt: 200 }]);
  });

  it("orders merged pins by pinnedAt, not array position", () => {
    const storage = memoryStorage([
      { id: "2", roundId: 2, pinnedAt: 500 },
      { id: "1", roundId: 1, pinnedAt: 100 },
    ]);
    expect(readPinnedDebateIds(storage)).toEqual([1, 2]);
  });

  it("drops the oldest pin once the cap is exceeded", () => {
    const storage = memoryStorage();
    const ids = Array.from({ length: MAX_PINNED_DEBATES + 1 }, (_, i) => i + 1);
    expect(writePinnedDebateIds(ids, storage, 1000)).toEqual(ids.slice(1));
  });

  it("does not throw when storage rejects the write", () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(() => togglePinnedDebate(1, storage)).not.toThrow();
  });
});
