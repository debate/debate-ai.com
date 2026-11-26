/** @vitest-environment jsdom */
/**
 * @fileoverview The watch page's flow chart modal: it first outlines the last
 * speeches that have a transcript but no summary, then sends every outline
 * with the viewer's prompt to the model and draws the reply. Covered here:
 * the happy path and what it caches and shares, a chart remembered from this
 * browser or shared by someone else, and each way a run can fail or be
 * abandoned.
 */

import { act } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { DebateFlowChart } from "../src/lib/debate-flow-chart"
import { DEFAULT_FLOW_CHART_INSTRUCTIONS } from "../src/lib/debate-flow-chart"
import type { RoundSpeech } from "../src/lib/round-speeches"
import { EMPTY_SHARED_VIDEO_AI, type SharedVideoAi } from "../src/lib/shared-video-ai"

const ai = vi.hoisted(() => ({
  requestSpeechSummary: vi.fn(),
  requestFlowChart: vi.fn(),
  shareVideoAiResult: vi.fn(async () => {}),
  shared: null as unknown,
}))

vi.mock("../src/lib/speech-ai-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/speech-ai-client")>()),
  requestSpeechSummary: ai.requestSpeechSummary,
  requestFlowChart: ai.requestFlowChart,
}))

vi.mock("../src/state/sharedVideoAi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/state/sharedVideoAi")>()),
  shareVideoAiResult: ai.shareVideoAiResult,
  useSharedVideoAi: () => ai.shared,
}))

vi.mock("../src/components/videos/watch/flow-chart/DebateFlowChartGraph", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/components/videos/watch/flow-chart/DebateFlowChartGraph")>()),
  DebateFlowChartGraph: () => <svg data-testid="graph" />,
}))

const { default: DebateFlowChartDialog } = await import("../src/components/videos/watch/flow-chart/DebateFlowChartDialog")
const { DebateFlowChartButton } = await import("../src/components/videos/watch/flow-chart/DebateFlowChartButton")
const { readSpeechSummaries, writeSpeechSummary } = await import("../src/state/speechAiCache")
const { click, flush, mount, type } = await import("./helpers/mount")

const speech = (label: string, side: "aff" | "neg", transcript = `${label} transcript`): RoundSpeech => ({
  key: label,
  label,
  heading: `${label} heading`,
  side,
  isSpeech: true,
  startSeconds: 0,
  parts: { transcript },
})

const SPEECHES = [speech("1AC", "aff"), speech("1NC", "neg"), speech("2AC", "aff"), speech("2NC", "neg"), speech("1AR", "aff")]

const CHART: DebateFlowChart = {
  summary: "Neg wins.",
  nodes: [
    { id: "a1", side: "aff", label: "Cap bad", explanation: "War.", speech: "1AC" },
    { id: "n1", side: "neg", label: "Perm", explanation: "Both.", speech: "1NC" },
  ],
  links: [{ source: "n1", target: "a1", kind: "answers" }],
}

const body = () => document.body
const find = (text: string) => [...body().querySelectorAll("button")].find((b) => b.textContent?.includes(text)) as HTMLButtonElement
const generateButton = () => find("Generate")
const status = () => body().querySelector('[aria-live="polite"]')?.textContent ?? ""

function dialog(props: Partial<React.ComponentProps<typeof DebateFlowChartDialog>> = {}) {
  return (
    <DebateFlowChartDialog
      open
      onOpenChange={() => {}}
      videoId="vid1"
      videoTitle="Final round"
      speeches={SPEECHES}
      round={{ format: "policy", aff: "Kansas", neg: "Harvard" } as never}
      {...props}
    />
  )
}

beforeEach(() => {
  window.localStorage.clear()
  ai.requestSpeechSummary.mockReset().mockImplementation(async (input: { heading: string }) => `- outline of ${input.heading}`)
  ai.requestFlowChart.mockReset().mockResolvedValue(CHART)
  ai.shareVideoAiResult.mockClear()
  ai.shared = EMPTY_SHARED_VIDEO_AI
})

afterEach(() => {
  document.body.innerHTML = ""
})

async function until(check: () => boolean) {
  for (let i = 0; i < 30 && !check(); i++) await flush(() => new Promise((resolve) => setTimeout(resolve, 5)))
}

describe("DebateFlowChartDialog", () => {
  it("outlines the last four speeches, charts the round, then saves and shares the result", async () => {
    const mounted = await mount(dialog())
    expect(body().textContent).toContain("0 of 5 speeches summarized · 4 more will be summarized first")
    await click(generateButton())
    await until(() => body().querySelector('[data-testid="graph"]') !== null)

    expect(ai.requestSpeechSummary.mock.calls.map((c) => (c[0] as { heading: string }).heading)).toEqual([
      "1NC heading",
      "2AC heading",
      "2NC heading",
      "1AR heading",
    ])
    expect(ai.requestSpeechSummary.mock.calls[0][0]).toMatchObject({ side: "neg", transcript: "1NC transcript", videoTitle: "Final round", format: "policy" })

    const request = ai.requestFlowChart.mock.calls[0][0]
    expect(request).toMatchObject({ instructions: DEFAULT_FLOW_CHART_INSTRUCTIONS, aff: "Kansas", neg: "Harvard", videoTitle: "Final round" })
    expect(request.speeches.map((s: { label: string }) => s.label)).toEqual(["1NC", "2AC", "2NC", "1AR"])

    expect(readSpeechSummaries("vid1")["1NC"]).toBe("- outline of 1NC heading")
    expect(ai.shareVideoAiResult).toHaveBeenCalledWith("vid1", { kind: "summary", key: "1NC", data: "- outline of 1NC heading" })
    expect(ai.shareVideoAiResult).toHaveBeenCalledWith("vid1", { kind: "flowchart", key: "", data: CHART })
    expect(window.localStorage.getItem("debate-ai:flow-chart:vid1")).toContain("Cap bad")
    expect(body().textContent).toContain("Bottom line: Neg wins.")
    expect(generateButton().textContent).toContain("Generate again")
    await mounted.unmount()
  })

  it("shows progress while summarizing", async () => {
    let release!: (value: string) => void
    ai.requestSpeechSummary.mockImplementationOnce(() => new Promise<string>((resolve) => (release = resolve)))
    const mounted = await mount(dialog({ speeches: [speech("1AC", "aff")] }))
    await click(generateButton())
    expect(status()).toBe("Summarizing 1AC (1 of 1)…")
    expect(body().querySelector("textarea")?.hasAttribute("disabled")).toBe(true)
    await flush(() => release("- done"))
    await until(() => ai.requestFlowChart.mock.calls.length > 0)
    await mounted.unmount()
  })

  it("keeps a customised prompt for next time, and sends it without sharing the chart", async () => {
    const mounted = await mount(dialog())
    const textarea = body().querySelector("textarea") as HTMLTextAreaElement
    await type(textarea, "Only the K")
    expect(find("Reset to default").disabled).toBe(false)
    await click(generateButton())
    await until(() => body().querySelector('[data-testid="graph"]') !== null)
    expect(ai.requestFlowChart.mock.calls[0][0].instructions).toBe("Only the K")
    expect(window.localStorage.getItem("debate-ai:flow-chart:instructions")).toBe("Only the K")
    expect(ai.shareVideoAiResult).not.toHaveBeenCalledWith("vid1", expect.objectContaining({ kind: "flowchart" }))
    await mounted.unmount()

    const reopened = await mount(dialog())
    expect((body().querySelector("textarea") as HTMLTextAreaElement).value).toBe("Only the K")
    await click(find("Reset to default"))
    expect((body().querySelector("textarea") as HTMLTextAreaElement).value).toBe(DEFAULT_FLOW_CHART_INSTRUCTIONS)
    await reopened.unmount()
  })

  it("can summarize every speech and counts the ones already outlined", async () => {
    writeSpeechSummary("vid1", "2AC", "- saved outline")
    const mounted = await mount(dialog())
    expect(body().textContent).toContain("1 of 5 speeches summarized · 3 more")
    await click(body().querySelector('input[type="checkbox"]') as HTMLInputElement)
    expect(body().textContent).toContain("1 of 5 speeches summarized · 4 more")
    await click(generateButton())
    await until(() => body().querySelector('[data-testid="graph"]') !== null)
    expect(ai.requestSpeechSummary).toHaveBeenCalledTimes(4)
    expect(ai.requestFlowChart.mock.calls[0][0].speeches[2]).toMatchObject({ label: "2AC", outline: "- saved outline" })
    await mounted.unmount()
  })

  it("reopens the chart this browser last made, with no model call", async () => {
    const first = await mount(dialog())
    await click(generateButton())
    await until(() => body().querySelector('[data-testid="graph"]') !== null)
    await first.unmount()
    ai.requestFlowChart.mockClear()

    const again = await mount(dialog())
    expect(body().querySelector('[data-testid="graph"]')).not.toBeNull()
    expect(ai.requestFlowChart).not.toHaveBeenCalled()
    await again.unmount()
  })

  it("shows the shared chart when this browser has none of its own", async () => {
    ai.shared = { ...EMPTY_SHARED_VIDEO_AI, flowChart: CHART } as SharedVideoAi
    const mounted = await mount(dialog())
    expect(body().textContent).toContain("Bottom line: Neg wins.")
    await mounted.unmount()
  })

  it("lays out with no speeches to chart: the button is disabled", async () => {
    const mounted = await mount(dialog({ speeches: [] }))
    expect(generateButton().disabled).toBe(true)
    expect(body().textContent).toContain("0 of 0 speeches summarized")
    await mounted.unmount()
  })

  it("explains when no speech has a transcript or summary", async () => {
    const mounted = await mount(dialog({ speeches: [speech("1AC", "aff", "")] }))
    await click(generateButton())
    await until(() => body().querySelector('[role="alert"]') !== null)
    expect(body().querySelector('[role="alert"]')?.textContent).toContain("No speech has a transcript or LLM summary yet")
    expect(ai.requestFlowChart).not.toHaveBeenCalled()
    await mounted.unmount()
  })

  it("stops at the first sign-in or limit error instead of failing every speech", async () => {
    ai.requestSpeechSummary.mockRejectedValue(new Error("Please sign in to use AI."))
    const mounted = await mount(dialog())
    await click(generateButton())
    await until(() => body().querySelector('[role="alert"]') !== null)
    expect(ai.requestSpeechSummary).toHaveBeenCalledTimes(1)
    expect(body().querySelector('[role="alert"]')?.textContent).toContain("Please sign in")
    expect(status()).toBe("")
    await mounted.unmount()
  })

  it("falls back to captions for a speech it could not summarize, and says so", async () => {
    ai.requestSpeechSummary.mockImplementation(async (input: { heading: string }) => {
      if (input.heading === "2AC heading") throw new Error("model busy")
      return `- outline of ${input.heading}`
    })
    const mounted = await mount(dialog())
    await click(generateButton())
    await until(() => body().querySelector('[data-testid="graph"]') !== null)
    const outlines = ai.requestFlowChart.mock.calls[0][0].speeches as Array<{ label: string; fromTranscript?: boolean }>
    expect(outlines.find((o) => o.label === "2AC")?.fromTranscript).toBe(true)
    expect(body().textContent).toContain("Couldn't summarize 2AC after 3 tries (model busy)")
    await mounted.unmount()
  })

  it("reports a failed chart request", async () => {
    ai.requestFlowChart.mockRejectedValue("nope")
    const mounted = await mount(dialog())
    await click(generateButton())
    await until(() => body().querySelector('[role="alert"]') !== null)
    expect(body().querySelector('[role="alert"]')?.textContent).toBe("The flow chart failed.")
    await mounted.unmount()
  })

  it("cancels a run in flight without showing an error", async () => {
    ai.requestSpeechSummary.mockImplementation(
      (_input: unknown, options: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new Error("aborted")))),
    )
    const mounted = await mount(dialog())
    await click(generateButton())
    expect(find("Cancel")).toBeTruthy()
    await click(find("Cancel"))
    await until(() => !find("Cancel"))
    expect(body().querySelector('[role="alert"]')).toBeNull()
    expect(ai.requestFlowChart).not.toHaveBeenCalled()
    await mounted.unmount()
  })

  it("aborts the run when the modal closes", async () => {
    let signal!: AbortSignal
    ai.requestSpeechSummary.mockImplementation(
      (_input: unknown, options: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          signal = options.signal
          signal.addEventListener("abort", () => reject(new Error("aborted")))
        }),
    )
    const mounted = await mount(dialog())
    await click(generateButton())
    await mounted.rerender(dialog({ open: false }))
    expect(signal.aborted).toBe(true)
    await mounted.unmount()
  })
})

describe("DebateFlowChartButton", () => {
  it("opens the lazily loaded modal when pressed", async () => {
    const mounted = await mount(<DebateFlowChartButton videoId="vid1" speeches={SPEECHES} />)
    expect(body().textContent).not.toContain("Debate flow chart")
    await click(mounted.container.querySelector('button[aria-label="Open the debate flow chart"]')!)
    await until(() => body().textContent?.includes("Debate flow chart") ?? false)
    expect(body().textContent).toContain("Debate flow chart")
    await mounted.unmount()
  })
})
