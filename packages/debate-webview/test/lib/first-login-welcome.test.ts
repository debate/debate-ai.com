/**
 * @fileoverview Covers the once-per-browser flag for the
 * first-sign-in welcome notification. The property worth
 * pinning is the default: a browser that has never seen
 * the welcome must still be due for it (`false`), and the
 * module must never throw when `localStorage` is
 * unavailable (a server render, or a browser that refuses
 * storage) — a throw here would be a welcome turning into
 * a broken page.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  markFirstLoginWelcomeShown,
  wasFirstLoginWelcomeShown,
} from "../../src/lib/first-login-welcome"

/** A minimal localStorage, since these tests run in the node environment. */
function installLocalStorage(): void {
  const store = new Map<string, string>()
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("wasFirstLoginWelcomeShown", () => {
  it("defaults to false, so a first sign-in is due the welcome", () => {
    installLocalStorage()
    expect(wasFirstLoginWelcomeShown()).toBe(false)
  })

  it("is false when there is no localStorage at all (a server render)", () => {
    vi.stubGlobal("localStorage", undefined)
    expect(wasFirstLoginWelcomeShown()).toBe(false)
  })

  it("is false when localStorage throws (a browser refusing storage)", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("storage disabled")
      },
    })
    expect(wasFirstLoginWelcomeShown()).toBe(false)
  })
})

describe("markFirstLoginWelcomeShown", () => {
  beforeEach(() => {
    installLocalStorage()
  })

  it("persists the shown flag across reads", () => {
    markFirstLoginWelcomeShown()
    expect(wasFirstLoginWelcomeShown()).toBe(true)
  })

  it("does not throw when localStorage is unavailable", () => {
    vi.stubGlobal("localStorage", undefined)
    expect(() => markFirstLoginWelcomeShown()).not.toThrow()
  })

  it("does not throw when localStorage refuses the write", () => {
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new Error("storage disabled")
      },
    })
    expect(() => markFirstLoginWelcomeShown()).not.toThrow()
  })
})
