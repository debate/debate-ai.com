/** @vitest-environment jsdom */
/**
 * @fileoverview `cn` merges class names (later Tailwind utilities win) and
 * `setStateInURL` reads and writes the page's query string for shareable
 * filter links.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cn, setStateInURL } from "../src/ui/lib/utils"

describe("cn", () => {
  it("joins truthy classes and drops falsy ones", () => {
    expect(cn("a", false, null, undefined, "b", { c: true, d: false })).toBe("a b c")
  })

  it("lets a later Tailwind utility override an earlier conflicting one", () => {
    expect(cn("px-2 text-sm", "px-4")).toBe("text-sm px-4")
  })
})

describe("setStateInURL", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/videos?q=old&view=grid")
  })
  afterEach(() => vi.restoreAllMocks())

  it("reads the current parameters when called with no state", () => {
    expect(setStateInURL()).toEqual({ q: "old", view: "grid" })
    expect(window.location.search).toBe("?q=old&view=grid")
  })

  it("writes parameters, replacing the history entry by default", () => {
    const replace = vi.spyOn(window.history, "replaceState")
    const push = vi.spyOn(window.history, "pushState")
    const result = setStateInURL({ q: "kritik", page: "2" })
    expect(result).toEqual({ q: "kritik", view: "grid", page: "2" })
    expect(window.location.search).toBe("?q=kritik&view=grid&page=2")
    expect(replace).toHaveBeenCalledTimes(1)
    expect(push).not.toHaveBeenCalled()
  })

  it("pushes a history entry when asked", () => {
    const push = vi.spyOn(window.history, "pushState")
    setStateInURL({ view: "list" }, { addToBrowserHistory: true })
    expect(push).toHaveBeenCalledTimes(1)
    expect(window.location.search).toBe("?q=old&view=list")
  })

  it("removes nullish and empty values", () => {
    expect(setStateInURL({ q: null, view: "" })).toEqual({})
    expect(window.location.search).toBe("")
  })

  it("keeps empty values when removeNullish is off, but never serializes null", () => {
    setStateInURL({ q: "", view: null }, { removeNullish: false })
    expect(window.location.search).toBe("?q=&view=grid")
  })

  it("does not touch history for an empty state object", () => {
    const replace = vi.spyOn(window.history, "replaceState")
    setStateInURL({})
    expect(replace).not.toHaveBeenCalled()
  })
})
