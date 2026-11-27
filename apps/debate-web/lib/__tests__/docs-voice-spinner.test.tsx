// @vitest-environment jsdom
/**
 * The Voice reader's follow-along spinner
 * (`packages/debate-help-docs/components/guides/voice-read-spinner.tsx`): the
 * grab.js Spinner variants it picks from, the injectable random pick, and
 * the spinner's accessibility and reduced-motion behavior.
 */
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  VOICE_SPINNER_VARIANTS,
  VoiceSpinner,
  mountVoiceSpinner,
  pickVoiceSpinnerVariant,
} from "../../../../packages/debate-help-docs/components/guides/voice-read-spinner"
import { createVoiceBall } from "../../../../packages/debate-help-docs/components/guides/voice-read-ball"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  document.body.innerHTML = ""
  vi.unstubAllGlobals()
})

describe("pickVoiceSpinnerVariant", () => {
  it("chooses from the seven grab.js variants (not the plain spokes)", () => {
    expect([...VOICE_SPINNER_VARIANTS]).toEqual(["circle", "pinwheel", "circle-filled", "ellipsis", "ring", "bars", "infinite"])
  })

  it("maps the injected random number onto a variant", () => {
    expect(pickVoiceSpinnerVariant(() => 0)).toBe("circle")
    expect(pickVoiceSpinnerVariant(() => 0.5)).toBe("ellipsis")
    expect(pickVoiceSpinnerVariant(() => 0.999999)).toBe("infinite")
    expect(pickVoiceSpinnerVariant(() => 1)).toBe("infinite")
    expect(pickVoiceSpinnerVariant(() => Number.NaN)).toBe("circle")
  })

  it("covers every variant across the range", () => {
    const seen = new Set(Array.from({ length: 70 }, (_, i) => pickVoiceSpinnerVariant(() => i / 70)))
    expect(seen.size).toBe(VOICE_SPINNER_VARIANTS.length)
  })
})

describe("VoiceSpinner", () => {
  for (const variant of VOICE_SPINNER_VARIANTS) {
    it(`renders the ${variant} variant as a labelled status at 18px`, async () => {
      const host = document.createElement("div")
      document.body.append(host)
      const root = createRoot(host)
      await act(async () => root.render(<VoiceSpinner variant={variant} />))
      const status = host.querySelector("[role=status]")!
      expect(status.getAttribute("aria-label")).toBe("Reading aloud")
      expect(status.getAttribute("data-voice-spinner")).toBe(variant)
      const svg = status.querySelector("svg")!
      expect(svg.getAttribute("aria-hidden")).toBe("true")
      expect(svg.getAttribute("width")).toBe("18")
      await act(async () => root.unmount())
    })
  }

  it("freezes the SVG animations under prefers-reduced-motion", async () => {
    const pauseAnimations = vi.fn()
    const unpauseAnimations = vi.fn()
    SVGSVGElement.prototype.pauseAnimations = pauseAnimations
    SVGSVGElement.prototype.unpauseAnimations = unpauseAnimations
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("reduce"),
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    const host = document.createElement("div")
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => root.render(<VoiceSpinner variant="ring" />))
    expect(pauseAnimations).toHaveBeenCalled()
    expect(unpauseAnimations).not.toHaveBeenCalled()
    await act(async () => root.unmount())
  })

  it("keeps animating when motion is not reduced", async () => {
    const pauseAnimations = vi.fn()
    const unpauseAnimations = vi.fn()
    SVGSVGElement.prototype.pauseAnimations = pauseAnimations
    SVGSVGElement.prototype.unpauseAnimations = unpauseAnimations
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }))
    const host = document.createElement("div")
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => root.render(<VoiceSpinner variant="infinite" />))
    expect(pauseAnimations).not.toHaveBeenCalled()
    await act(async () => root.unmount())
  })
})

describe("the ball", () => {
  it("hosts the spinner and removes it on destroy", async () => {
    let unmount = () => {}
    const ball = createVoiceBall(document, (host) => {
      unmount = mountVoiceSpinner(host, "pinwheel")
      return unmount
    })
    await act(async () => void (await Promise.resolve()))
    expect(document.querySelector("[data-voice-ball] [role=status][data-voice-spinner=pinwheel]")).toBeTruthy()
    await act(async () => ball.destroy())
    expect(document.querySelector("[data-voice-ball]")).toBeNull()
    expect(document.querySelector("[data-voice-spinner]")).toBeNull()
  })

  it("is a bare, positioned element without a mount", () => {
    const ball = createVoiceBall(document)
    expect(document.querySelector("[data-voice-ball]")?.childElementCount).toBe(0)
    ball.destroy()
  })
})
