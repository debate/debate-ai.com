/** Vitest runs in `node`, so this asserts on `react-dom/server` markup. */
import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { TooltipProvider } from "../src/ui/primitives/tooltip"
import { SpeechFallacyHintsButton } from "../src/layout/SpeechFallacyHintsButton"

const render = (findings: Parameters<typeof SpeechFallacyHintsButton>[0]["findings"]) =>
  renderToStaticMarkup(
    <TooltipProvider>
      <SpeechFallacyHintsButton speechName="1AC" findings={findings} />
    </TooltipProvider>,
  )

describe("SpeechFallacyHintsButton", () => {
  it("renders nothing for a clean speech", () => {
    expect(render([])).toBe("")
  })

  it("shows a labelled count button when fallacies were found", () => {
    const html = render([{ kind: "straw-man", excerpt: "so you want", index: 0, explanation: "x" }])
    expect(html).toContain('aria-label="1AC possible fallacies (1)"')
  })
})
