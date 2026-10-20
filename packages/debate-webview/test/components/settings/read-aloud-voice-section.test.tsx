/** @vitest-environment jsdom */
/**
 * @fileoverview Settings → Preferences → Read aloud voice: shows the stored
 * engine and voice, and follows a choice made in the card editor's gear menu.
 */
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { storeVoiceId } from "@debate/editor/read-voice"
import { ReadAloudVoiceSection } from "../../../src/components/settings/ReadAloudVoiceSection"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  localStorage.clear()
  document.body.innerHTML = ""
})

function mount() {
  const host = document.createElement("div")
  document.body.appendChild(host)
  const root = createRoot(host)
  act(() => root.render(<ReadAloudVoiceSection />))
  return { host, root }
}

describe("ReadAloudVoiceSection", () => {
  it("starts on Kokoro and follows a Cloudflare voice picked elsewhere", () => {
    const { host, root } = mount()
    expect(host.querySelector("#settings-read-engine")?.textContent).toContain("Kokoro (on this device)")
    expect(host.querySelector("#settings-read-voice")?.textContent).toContain("Heart")
    act(() => storeVoiceId("deepgram:aura-luna-en"))
    expect(host.querySelector("#settings-read-engine")?.textContent).toContain("Cloudflare Workers AI")
    expect(host.querySelector("#settings-read-voice")?.textContent).toContain("Luna")
    expect(host.textContent).toContain("Deepgram Aura")
    act(() => root.unmount())
  })
})
