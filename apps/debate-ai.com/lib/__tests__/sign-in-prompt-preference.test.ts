/**
 * @fileoverview Covers the persistent "don't ask me again" opt-out for the
 * guest sign-in prompt. The property worth pinning is the default: a guest
 * who has never touched the setting must still be prompted (`false`), and the
 * module must never throw when `localStorage` is unavailable (a server
 * render, or a browser that refuses storage) — a throw here would be a
 * blocked prompt turning into a broken page.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { isSignInPromptOptedOut, setSignInPromptOptedOut } from "../sign-in-prompt-preference"

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

describe("isSignInPromptOptedOut", () => {
  it("defaults to false, so a guest is prompted until they say otherwise", () => {
    installLocalStorage()
    expect(isSignInPromptOptedOut()).toBe(false)
  })

  it("is false when there is no localStorage at all (a server render)", () => {
    vi.stubGlobal("localStorage", undefined)
    expect(isSignInPromptOptedOut()).toBe(false)
  })

  it("is false when localStorage throws (a browser refusing storage)", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("storage disabled")
      },
    })
    expect(isSignInPromptOptedOut()).toBe(false)
  })
})

describe("setSignInPromptOptedOut", () => {
  beforeEach(() => {
    installLocalStorage()
  })

  it("persists an opt-out across reads", () => {
    setSignInPromptOptedOut(true)
    expect(isSignInPromptOptedOut()).toBe(true)
  })

  it("clears the opt-out, going back to being prompted", () => {
    setSignInPromptOptedOut(true)
    setSignInPromptOptedOut(false)
    expect(isSignInPromptOptedOut()).toBe(false)
  })

  it("does not throw when localStorage is unavailable", () => {
    vi.stubGlobal("localStorage", undefined)
    expect(() => setSignInPromptOptedOut(true)).not.toThrow()
  })

  it("does not throw when localStorage refuses the write", () => {
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new Error("storage disabled")
      },
      removeItem: () => {
        throw new Error("storage disabled")
      },
    })
    expect(() => setSignInPromptOptedOut(true)).not.toThrow()
    expect(() => setSignInPromptOptedOut(false)).not.toThrow()
  })
})
