/**
 * @fileoverview Covers the app-wide Backspace-goes-back shortcut. What
 * matters: a bare Backspace on the page goes back, and it never does while
 * the reader could be deleting text or a widget owns the key.
 */

import { afterEach, describe, expect, it, vi } from "vitest"

// Run effects immediately (and keep their cleanup) so the hook is testable
// without a renderer, in the node environment.
const cleanups: Array<() => void> = []
vi.mock("react", () => ({
  useEffect: (fn: () => void | (() => void)) => {
    const cleanup = fn()
    if (cleanup) cleanups.push(cleanup)
  },
}))

import {
  isBackspaceBack,
  isTypingTarget,
  onBackspaceBackKeyDown,
  useBackspaceBack,
  type BackspaceKeyEvent,
} from "../../../src/lib/nav/backspace-back"

/** A fake element: `owners` are the selectors `closest` should match. */
function el(tagName: string, opts: { editable?: boolean; owner?: boolean } = {}) {
  return {
    tagName,
    isContentEditable: opts.editable ?? false,
    closest: () => (opts.owner ? {} : null),
  } as unknown as EventTarget
}

function press(overrides: Partial<BackspaceKeyEvent> = {}): BackspaceKeyEvent {
  return {
    key: "Backspace",
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    repeat: false,
    defaultPrevented: false,
    isComposing: false,
    target: el("BODY"),
    ...overrides,
  }
}

describe("isBackspaceBack", () => {
  it("goes back on a bare Backspace outside a field", () => {
    expect(isBackspaceBack(press())).toBe(true)
    expect(isBackspaceBack(press({ target: el("BUTTON") }))).toBe(true)
    expect(isBackspaceBack(press({ target: null }))).toBe(true)
  })

  it("ignores other keys", () => {
    expect(isBackspaceBack(press({ key: "Delete" }))).toBe(false)
    expect(isBackspaceBack(press({ key: "b" }))).toBe(false)
  })

  it("stands aside in inputs, textareas, selects and editors", () => {
    for (const tag of ["INPUT", "TEXTAREA", "SELECT", "input"]) {
      expect(isBackspaceBack(press({ target: el(tag) }))).toBe(false)
    }
    expect(isBackspaceBack(press({ target: el("DIV", { editable: true }) }))).toBe(false)
  })

  it("stands aside inside widgets that own the keyboard", () => {
    expect(isBackspaceBack(press({ target: el("TD", { owner: true }) }))).toBe(false)
  })

  it("stands aside for modifiers, auto-repeat, IME and claimed presses", () => {
    for (const mod of ["altKey", "ctrlKey", "metaKey", "shiftKey"] as const) {
      expect(isBackspaceBack(press({ [mod]: true }))).toBe(false)
    }
    expect(isBackspaceBack(press({ repeat: true }))).toBe(false)
    expect(isBackspaceBack(press({ isComposing: true }))).toBe(false)
    expect(isBackspaceBack(press({ defaultPrevented: true }))).toBe(false)
  })
})

describe("isTypingTarget", () => {
  it("is false for nothing and for plain elements", () => {
    expect(isTypingTarget(null)).toBe(false)
    expect(isTypingTarget(el("SPAN"))).toBe(false)
  })
})

describe("onBackspaceBackKeyDown", () => {
  afterEach(() => vi.unstubAllGlobals())

  function setup(activeElement: unknown = null) {
    const back = vi.fn()
    vi.stubGlobal("window", { history: { back } })
    vi.stubGlobal("document", { activeElement })
    return back
  }

  it("goes back and claims the key", () => {
    const back = setup()
    const event = { ...press(), preventDefault: vi.fn() } as unknown as KeyboardEvent
    onBackspaceBackKeyDown(event)
    expect(back).toHaveBeenCalledTimes(1)
    expect(event.preventDefault).toHaveBeenCalled()
  })

  it("leaves the key alone while a field has focus", () => {
    const back = setup(el("INPUT"))
    const event = { ...press(), preventDefault: vi.fn() } as unknown as KeyboardEvent
    onBackspaceBackKeyDown(event)
    expect(back).not.toHaveBeenCalled()
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it("ignores keys that aren't the shortcut", () => {
    const back = setup()
    onBackspaceBackKeyDown({ ...press({ key: "a" }), preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(back).not.toHaveBeenCalled()
  })
})

describe("useBackspaceBack", () => {
  afterEach(() => {
    cleanups.length = 0
    vi.unstubAllGlobals()
  })

  it("adds the window listener when enabled and removes it on cleanup", () => {
    const addEventListener = vi.fn()
    const removeEventListener = vi.fn()
    vi.stubGlobal("window", { addEventListener, removeEventListener })
    useBackspaceBack(true)
    expect(addEventListener).toHaveBeenCalledWith("keydown", onBackspaceBackKeyDown)
    cleanups.forEach((fn) => fn())
    expect(removeEventListener).toHaveBeenCalledWith("keydown", onBackspaceBackKeyDown)
  })

  it("adds nothing when disabled", () => {
    const addEventListener = vi.fn()
    vi.stubGlobal("window", { addEventListener })
    useBackspaceBack(false)
    expect(addEventListener).not.toHaveBeenCalled()
  })
})
