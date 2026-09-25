/**
 * @fileoverview Covers the 30-minute per-feature sign-in prompt cooldown.
 * The property worth pinning is that it survives a new tab — the whole
 * reason it moved off `sessionStorage` — plus the cooldown boundary itself
 * and the same "never throws" guarantee every other storage-backed module
 * here has, since a throw would turn a rate-limited prompt into a broken
 * page.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  PROMPT_COOLDOWN_MS,
  markSignInPromptShown,
  wasSignInPromptShownRecently,
} from "../../src/lib/sign-in-prompt-cooldown"

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

describe("wasSignInPromptShownRecently", () => {
  beforeEach(() => {
    installLocalStorage()
  })

  it("is false for a feature that has never been shown", () => {
    expect(wasSignInPromptShownRecently("Favorites", 1_000)).toBe(false)
  })

  it("is false when there is no localStorage at all (a server render)", () => {
    vi.stubGlobal("localStorage", undefined)
    expect(wasSignInPromptShownRecently("Favorites")).toBe(false)
  })

  it("is false when localStorage throws (a browser refusing storage)", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("storage disabled")
      },
    })
    expect(wasSignInPromptShownRecently("Favorites")).toBe(false)
  })

  it("is true immediately after being marked shown", () => {
    markSignInPromptShown("Favorites", 1_000)
    expect(wasSignInPromptShownRecently("Favorites", 1_000)).toBe(true)
  })

  it("stays true up to (but not including) the cooldown boundary", () => {
    markSignInPromptShown("Favorites", 1_000)
    expect(wasSignInPromptShownRecently("Favorites", 1_000 + PROMPT_COOLDOWN_MS - 1)).toBe(true)
  })

  it("is false once the cooldown has fully elapsed", () => {
    markSignInPromptShown("Favorites", 1_000)
    expect(wasSignInPromptShownRecently("Favorites", 1_000 + PROMPT_COOLDOWN_MS)).toBe(false)
  })

  it("survives a new tab, unlike the sessionStorage-backed version it replaced", () => {
    // A second tab shares this browser's localStorage but starts with no
    // module-level state of its own — reading fresh from storage is the
    // whole point, so this test never touches any in-memory state.
    markSignInPromptShown("Favorites", 1_000)
    expect(wasSignInPromptShownRecently("Favorites", 1_500)).toBe(true)
  })

  it("tracks each feature independently", () => {
    markSignInPromptShown("Favorites", 1_000)
    expect(wasSignInPromptShownRecently("Judge Profiles", 1_000)).toBe(false)
  })
})

describe("markSignInPromptShown", () => {
  beforeEach(() => {
    installLocalStorage()
  })

  it("does not clobber another feature's cooldown", () => {
    markSignInPromptShown("Favorites", 1_000)
    markSignInPromptShown("Judge Profiles", 2_000)
    expect(wasSignInPromptShownRecently("Favorites", 2_000)).toBe(true)
    expect(wasSignInPromptShownRecently("Judge Profiles", 2_000)).toBe(true)
  })

  it("re-marking a feature restarts its cooldown", () => {
    markSignInPromptShown("Favorites", 1_000)
    markSignInPromptShown("Favorites", 1_000 + PROMPT_COOLDOWN_MS)
    expect(wasSignInPromptShownRecently("Favorites", 1_000 + PROMPT_COOLDOWN_MS)).toBe(true)
  })

  it("does not throw when localStorage is unavailable", () => {
    vi.stubGlobal("localStorage", undefined)
    expect(() => markSignInPromptShown("Favorites")).not.toThrow()
  })

  it("does not throw when localStorage refuses the write", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("storage disabled")
      },
    })
    expect(() => markSignInPromptShown("Favorites")).not.toThrow()
  })
})
