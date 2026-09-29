import { describe, expect, it } from "vitest"
import { isPaletteShortcut } from "../../../src/components/layout/GlobalCommandPalette"

const key = (init: Partial<Pick<KeyboardEvent, "metaKey" | "ctrlKey" | "shiftKey" | "altKey" | "code" | "key">>) => ({
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  code: "KeyK",
  key: "k",
  ...init,
})

describe("isPaletteShortcut", () => {
  it("opens on Cmd-K (Mac) and Ctrl-K (Windows/Linux)", () => {
    expect(isPaletteShortcut(key({ metaKey: true }))).toBe(true)
    expect(isPaletteShortcut(key({ ctrlKey: true }))).toBe(true)
  })

  it("matches by physical key, so non-Latin layouts still open it", () => {
    expect(isPaletteShortcut(key({ ctrlKey: true, key: "к" }))).toBe(true)
  })

  it("leaves plain K and the shifted/alt chords alone", () => {
    expect(isPaletteShortcut(key({}))).toBe(false)
    expect(isPaletteShortcut(key({ ctrlKey: true, shiftKey: true, key: "K" }))).toBe(false)
    expect(isPaletteShortcut(key({ metaKey: true, altKey: true }))).toBe(false)
  })

  it("still answers to the old Ctrl/Cmd-P chord, so docs that name it keep working", () => {
    expect(isPaletteShortcut(key({ metaKey: true, code: "KeyP", key: "p" }))).toBe(true)
    expect(isPaletteShortcut(key({ ctrlKey: true, code: "KeyP", key: "p" }))).toBe(true)
  })

  it("no longer opens on the old Ctrl/Cmd-Shift-Space chord", () => {
    expect(isPaletteShortcut(key({ ctrlKey: true, shiftKey: true, code: "Space", key: " " }))).toBe(false)
  })
})
