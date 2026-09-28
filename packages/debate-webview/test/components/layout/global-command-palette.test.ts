import { describe, expect, it } from "vitest"
import { isPaletteShortcut } from "../../../src/components/layout/GlobalCommandPalette"

const key = (init: Partial<Pick<KeyboardEvent, "metaKey" | "ctrlKey" | "shiftKey" | "altKey" | "code" | "key">>) => ({
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  code: "KeyP",
  key: "p",
  ...init,
})

describe("isPaletteShortcut", () => {
  it("opens on Cmd-P (Mac) and Ctrl-P (Windows/Linux), the browser's Print chord", () => {
    expect(isPaletteShortcut(key({ metaKey: true }))).toBe(true)
    expect(isPaletteShortcut(key({ ctrlKey: true }))).toBe(true)
  })

  it("matches by physical key, so non-Latin layouts still open it", () => {
    expect(isPaletteShortcut(key({ ctrlKey: true, key: "з" }))).toBe(true)
  })

  it("leaves plain P and the shifted/alt chords alone", () => {
    expect(isPaletteShortcut(key({}))).toBe(false)
    expect(isPaletteShortcut(key({ ctrlKey: true, shiftKey: true, key: "P" }))).toBe(false)
    expect(isPaletteShortcut(key({ metaKey: true, altKey: true }))).toBe(false)
  })

  it("no longer opens on the old Ctrl/Cmd-Shift-Space chord", () => {
    expect(isPaletteShortcut(key({ ctrlKey: true, shiftKey: true, code: "Space", key: " " }))).toBe(false)
  })
})
