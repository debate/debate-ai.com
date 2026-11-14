/** @vitest-environment jsdom */
/**
 * @fileoverview Settings → Sound & speech → Sound effects: says where the
 * level is saved, starts on the stored level, and follows an account merge
 * (the tool-record sync writes the key and fires a `storage` event).
 */
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { SOUND_EFFECT_LEVEL_KEY } from "@debate-ai/timer"
import { SoundEffectsSection } from "../../../src/components/settings/sections/SoundEffectsSection"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  document.body.innerHTML = ""
  localStorage.clear()
})

async function mount() {
  const host = document.createElement("div")
  document.body.appendChild(host)
  await act(async () => createRoot(host).render(<SoundEffectsSection />))
  return host
}

function triggerText(host: HTMLElement): string {
  return host.querySelector("#settings-sound-effects")?.textContent ?? ""
}

describe("SoundEffectsSection", () => {
  it("says the level is saved to the account when signed in", async () => {
    const host = await mount()
    expect(host.textContent).toContain("Saved to your account when you're signed in, and kept on this device otherwise.")
    expect(host.textContent).not.toContain("never synced")
  })

  it("starts on the stored (JSON-encoded) level", async () => {
    localStorage.setItem(SOUND_EFFECT_LEVEL_KEY, JSON.stringify("minimal"))
    const host = await mount()
    expect(triggerText(host)).toContain("Minimal")
  })

  it("upgrades a bare pre-sync level so the account sync can read it", async () => {
    localStorage.setItem(SOUND_EFFECT_LEVEL_KEY, "off")
    const host = await mount()
    expect(triggerText(host)).toContain("Off")
    expect(localStorage.getItem(SOUND_EFFECT_LEVEL_KEY)).toBe(JSON.stringify("off"))
  })

  it("follows an account merge written by the tool-record sync", async () => {
    const host = await mount()
    expect(triggerText(host)).toContain("All effects")

    const newValue = JSON.stringify("off")
    localStorage.setItem(SOUND_EFFECT_LEVEL_KEY, newValue)
    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", { key: SOUND_EFFECT_LEVEL_KEY, newValue }))
    })

    expect(triggerText(host)).toContain("Off")
  })
})
