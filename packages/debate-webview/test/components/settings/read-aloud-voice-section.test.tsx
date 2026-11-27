/** @vitest-environment jsdom */
/**
 * @fileoverview Settings → Sound & speech → Read aloud voice & speed: shows the
 * stored speed, engine and voice, and follows changes made elsewhere.
 */
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { storeReadSpeed, storeVoiceId } from "@debate-ai/editor/read-voice"
import { ReadAloudVoiceSection } from "../../../src/components/settings/sections/ReadAloudVoiceSection"

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

function openDialog(host: HTMLElement) {
  act(() => {
    host.querySelector("button")!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
  })
}

describe("ReadAloudVoiceSection", () => {
  it("starts on Kokoro and follows a Cloudflare voice picked elsewhere", () => {
    const { host, root } = mount()
    openDialog(host)
    expect(document.body.querySelector("#settings-read-engine")?.textContent).toContain(
      "Kokoro (on this device)",
    )
    expect(document.body.querySelector("#settings-read-voice")?.textContent).toContain("Heart")
    act(() => storeVoiceId("deepgram:aura-luna-en"))
    expect(document.body.querySelector("#settings-read-engine")?.textContent).toContain(
      "Cloudflare Workers AI",
    )
    expect(document.body.querySelector("#settings-read-voice")?.textContent).toContain("Luna")
    expect(document.body.textContent).toContain("Deepgram Aura")
    act(() => root.unmount())
  })

  it("shows the 2x default speed and follows a speed stored elsewhere", () => {
    const { host, root } = mount()
    openDialog(host)
    const slider = document.body.querySelector<HTMLInputElement>("#settings-read-speed")!
    expect(slider.value).toBe("2")
    expect(document.body.textContent).toContain("Speed: 2.0x")
    act(() => storeReadSpeed(1.5))
    expect(slider.value).toBe("1.5")
    expect(document.body.textContent).toContain("Speed: 1.5x")
    act(() => root.unmount())
  })
})

describe("ReadAloudVoiceSection tag and author & year voices", () => {
  it("has a section per part that follows the part before it until set", () => {
    const { host, root } = mount()
    openDialog(host)
    expect(document.body.textContent).toContain("Tag")
    expect(document.body.textContent).toContain("Author & year")
    expect(document.body.textContent).toContain("Highlighted text")
    expect(document.body.textContent).not.toContain("Tag, author & year")
    act(() => storeVoiceId("deepgram:aura-luna-en"))
    expect(document.body.querySelector("#settings-read-tag-voice")?.textContent).toContain("Luna")
    expect(document.body.querySelector("#settings-read-author-voice")?.textContent).toContain("Luna")
    act(() => storeVoiceId("kokoro:am_puck", "tag"))
    expect(document.body.querySelector("#settings-read-tag-voice")?.textContent).toContain("Puck")
    expect(document.body.querySelector("#settings-read-author-voice")?.textContent).toContain("Puck")
    act(() => storeVoiceId("deepgram:aura-orion-en", "author"))
    expect(document.body.querySelector("#settings-read-author-voice")?.textContent).toContain("Orion")
    expect(document.body.querySelector("#settings-read-tag-voice")?.textContent).toContain("Puck")
    expect(document.body.querySelector("#settings-read-voice")?.textContent).toContain("Luna")
    act(() => storeReadSpeed(3, "tag"))
    expect(document.body.querySelector<HTMLInputElement>("#settings-read-tag-speed")!.value).toBe("3")
    expect(document.body.querySelector<HTMLInputElement>("#settings-read-author-speed")!.value).toBe("3")
    expect(document.body.querySelector<HTMLInputElement>("#settings-read-speed")!.value).toBe("2")
    act(() => root.unmount())
  })
})
