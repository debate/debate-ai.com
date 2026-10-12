/**
 * @fileoverview Covers the "Hide dock" choice in the dock's Settings menu.
 * What matters: a reader who never chose sees the dock (`false`), the choice
 * is stored and broadcast so every dock instance follows it, and a browser
 * that refuses storage still gets the choice for the page it is on.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/** A minimal localStorage, since these tests run in the node environment. */
function installLocalStorage(): Map<string, string> {
  const store = new Map<string, string>()
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  })
  return store
}

/** A window that records the events dispatched on it. */
function installWindow(): string[] {
  const events: string[] = []
  vi.stubGlobal("window", {
    dispatchEvent: (event: Event) => {
      events.push(event.type)
      return true
    },
  })
  return events
}

/** A fresh copy of the module, so its in-memory fallback starts empty. */
async function load() {
  vi.resetModules()
  return import("../../../src/lib/nav/dock-hidden")
}

beforeEach(() => {
  installWindow()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("dock-hidden", () => {
  it("defaults to shown", async () => {
    installLocalStorage()
    const { readDockHidden } = await load()
    expect(readDockHidden()).toBe(false)
  })

  it("stores the choice and clears it when shown again", async () => {
    const store = installLocalStorage()
    const { DOCK_HIDDEN_KEY, readDockHidden, setDockHidden } = await load()
    setDockHidden(true)
    expect(store.get(DOCK_HIDDEN_KEY)).toBe("1")
    expect(readDockHidden()).toBe(true)
    setDockHidden(false)
    expect(store.has(DOCK_HIDDEN_KEY)).toBe(false)
    expect(readDockHidden()).toBe(false)
  })

  it("toggles, and broadcasts each change once", async () => {
    installLocalStorage()
    const events = installWindow()
    const { readDockHidden, setDockHidden, toggleDockHidden } = await load()
    toggleDockHidden()
    expect(readDockHidden()).toBe(true)
    setDockHidden(true) // no change, no event
    toggleDockHidden()
    expect(readDockHidden()).toBe(false)
    expect(events).toEqual(["app-dock-hidden-change", "app-dock-hidden-change"])
  })

  it("keeps the choice for the page when storage throws", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked")
      },
      setItem: () => {
        throw new Error("blocked")
      },
      removeItem: () => {
        throw new Error("blocked")
      },
    })
    const { readDockHidden, setDockHidden } = await load()
    expect(readDockHidden()).toBe(false)
    setDockHidden(true)
    expect(readDockHidden()).toBe(true)
  })
})
