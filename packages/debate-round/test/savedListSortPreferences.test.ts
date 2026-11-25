// @vitest-environment jsdom
/**
 * @fileoverview Tests for `state/savedListSortPreferences.ts`: the sort a
 * "Saved to account" list remembers, stored in the synced
 * `savedListSortPreferences` tool-record collection.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  SAVED_LIST_SORT_PREFERENCES_STORAGE_KEY,
  getSavedListSort,
  isSavedListSortPreferencesStorageEvent,
  saveSavedListSort,
} from "../src/state/savedListSortPreferences"

const KEY = SAVED_LIST_SORT_PREFERENCES_STORAGE_KEY
const stored = () => JSON.parse(localStorage.getItem(KEY) ?? "null")

beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("getSavedListSort", () => {
  it("defaults to newest when nothing is saved", () => {
    expect(getSavedListSort("flow-history-saved")).toBe("newest")
  })

  it("returns the saved sort", () => {
    localStorage.setItem(KEY, JSON.stringify([{ id: "flow-history-saved", sort: "name", updatedAt: 1 }]))
    expect(getSavedListSort("flow-history-saved")).toBe("name")
  })

  it("falls back to newest on bad JSON, a non-array, an unknown sort or a malformed record", () => {
    for (const raw of [
      "{not json",
      JSON.stringify({ id: "flow-history-saved", sort: "name" }),
      JSON.stringify([{ id: "flow-history-saved", sort: "random", updatedAt: 1 }]),
      JSON.stringify([{ id: "flow-history-saved", sort: "name", updatedAt: "yesterday" }]),
      JSON.stringify([null, 3, "x"]),
    ]) {
      localStorage.setItem(KEY, raw)
      expect(getSavedListSort("flow-history-saved")).toBe("newest")
    }
  })

  it("returns newest without localStorage (SSR)", () => {
    vi.stubGlobal("localStorage", undefined)
    expect(getSavedListSort("flow-history-saved")).toBe("newest")
  })
})

describe("saveSavedListSort", () => {
  it("stores one record per surface, keyed by id, with the change time", () => {
    expect(saveSavedListSort("flow-history-saved", "oldest", 100)).toBe(true)
    expect(stored()).toEqual([{ id: "flow-history-saved", sort: "oldest", updatedAt: 100 }])
    expect(saveSavedListSort("flow-history-saved", "name", 200)).toBe(true)
    expect(stored()).toEqual([{ id: "flow-history-saved", sort: "name", updatedAt: 200 }])
  })

  it("writes nothing when the sort is already saved, so no sync is triggered", () => {
    saveSavedListSort("flow-history-saved", "name", 100)
    expect(saveSavedListSort("flow-history-saved", "name", 300)).toBe(false)
    expect(stored()).toEqual([{ id: "flow-history-saved", sort: "name", updatedAt: 100 }])
  })

  it("ignores an unknown sort or surface", () => {
    expect(saveSavedListSort("flow-history-saved", "random")).toBe(false)
    expect(saveSavedListSort("other" as never, "name")).toBe(false)
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it("keeps records it doesn't recognize and drops a malformed copy of its own surface", () => {
    const foreign = { id: "debate-history", sort: "name", updatedAt: 5 }
    localStorage.setItem(KEY, JSON.stringify([foreign, { id: "flow-history-saved", sort: "bogus" }]))
    expect(saveSavedListSort("flow-history-saved", "oldest", 9)).toBe(true)
    expect(stored()).toEqual([foreign, { id: "flow-history-saved", sort: "oldest", updatedAt: 9 }])
  })

  it("returns false when storage throws (quota or disabled)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError")
    })
    expect(saveSavedListSort("flow-history-saved", "name")).toBe(false)
  })
})

describe("isSavedListSortPreferencesStorageEvent", () => {
  it("matches its own key and a cleared store, nothing else", () => {
    expect(isSavedListSortPreferencesStorageEvent({ key: KEY })).toBe(true)
    expect(isSavedListSortPreferencesStorageEvent({ key: null })).toBe(true)
    expect(isSavedListSortPreferencesStorageEvent({ key: "flows" })).toBe(false)
  })
})
