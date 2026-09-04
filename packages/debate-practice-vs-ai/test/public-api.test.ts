import { describe, expect, it } from "vitest"
import { AiVersusRoundPanel } from "debate-practice-rounds"
import { AiVersusRoundPanel as ExportedPanel, DebatePracticeVsAi } from "../src"

describe("debate-practice-vs-ai public API", () => {
  it("exports the embeddable practice panel under a product-specific name", () => {
    expect(DebatePracticeVsAi).toBe(AiVersusRoundPanel)
    expect(ExportedPanel).toBe(AiVersusRoundPanel)
  })
})
