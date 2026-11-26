/** @vitest-environment jsdom */
/**
 * @fileoverview `FlowChartView` is what both flow-chart modals show once a
 * chart exists: the bottom line, legend, speech focus chips, layout switch,
 * the clicked bubble's details, and every argument written out. The D3 graph
 * is stubbed (it has its own suite) and exposes the props it was given.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act } from "react"
import type { DebateFlowChart } from "../src/lib/debate-flow-chart"
import { flowChartSpeechColumns } from "../src/lib/debate-flow-chart"

const graph = vi.hoisted(() => ({ props: null as null | Record<string, any> }))

vi.mock("../src/components/videos/watch/flow-chart/DebateFlowChartGraph", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/components/videos/watch/flow-chart/DebateFlowChartGraph")>()),
  DebateFlowChartGraph: (props: Record<string, any>) => {
    graph.props = props
    return <svg data-testid="graph" />
  },
}))

const { FlowChartView } = await import("../src/components/videos/watch/flow-chart/FlowChartView")
const { click, flush, mount } = await import("./helpers/mount")

const CHART: DebateFlowChart = {
  summary: "Aff wins on the link.",
  nodes: [
    { id: "a1", side: "aff", label: "Cap bad", explanation: "It causes war.", speech: "1AC" },
    { id: "a1w", side: "aff", label: "Scarcity", explanation: "Warrant text.", speech: "1AC", parent: "a1" },
    { id: "n1", side: "neg", label: "Perm", explanation: "", speech: "1NC" },
  ],
  links: [
    { source: "n1", target: "a1", kind: "answers", label: "do both" },
    { source: "a1w", target: "n1", kind: "related" },
  ],
}
const COLUMNS = flowChartSpeechColumns(CHART, [
  { label: "1AC", side: "aff" },
  { label: "1NC", side: "neg" },
])

function view(chart = CHART, extra: Record<string, unknown> = {}) {
  return (
    <FlowChartView
      chart={chart}
      columns={COLUMNS}
      legend={{ aff: "Affirmative speeches", neg: "Negative speeches" }}
      columnsName="Speeches"
      columnName="Speech"
      {...extra}
    />
  )
}

const button = (root: ParentNode, text: string) =>
  [...root.querySelectorAll("button")].find((b) => b.textContent?.trim() === text) as HTMLButtonElement

beforeEach(() => {
  graph.props = null
})
afterEach(() => vi.unstubAllGlobals())

describe("FlowChartView", () => {
  it("shows the bottom line, the legend and every argument with its warrants", async () => {
    const mounted = await mount(view())
    const text = mounted.container.textContent ?? ""
    expect(text).toContain("Bottom line: Aff wins on the link.")
    expect(text).toContain("Affirmative speeches")
    expect(text).toContain("Negative speeches")
    expect(text).toContain("Scroll to zoom, click a bubble to read it.")
    expect(text).toContain("AFF · Cap bad — It causes war.")
    expect(text).toContain("NEG · Perm")
    expect(text).toContain("Scarcity — Warrant text.")
    await mounted.unmount()
  })

  it("omits the bottom line when the chart has none", async () => {
    const mounted = await mount(view({ ...CHART, summary: undefined }))
    expect(mounted.container.textContent).not.toContain("Bottom line")
    await mounted.unmount()
  })

  it("greys out other speeches when a speech chip is toggled, and clears on All", async () => {
    const mounted = await mount(view())
    expect(graph.props?.focusSpeeches.size).toBe(0)
    expect(button(mounted.container, "All").getAttribute("aria-pressed")).toBe("true")

    await click(button(mounted.container, "1NC"))
    expect([...graph.props?.focusSpeeches]).toEqual(["1NC"])
    expect(button(mounted.container, "1NC").getAttribute("aria-pressed")).toBe("true")
    expect(button(mounted.container, "All").getAttribute("aria-pressed")).toBe("false")

    await click(button(mounted.container, "1AC"))
    expect([...graph.props?.focusSpeeches].sort()).toEqual(["1AC", "1NC"])
    await click(button(mounted.container, "1NC"))
    expect([...graph.props?.focusSpeeches]).toEqual(["1AC"])

    await click(button(mounted.container, "All"))
    expect(graph.props?.focusSpeeches.size).toBe(0)
    await mounted.unmount()
  })

  it("switches layout, and returns to columns when a speech is focused", async () => {
    const mounted = await mount(view())
    expect(graph.props?.layout).toBe("columns")
    await click(button(mounted.container, "Free arrange"))
    expect(graph.props?.layout).toBe("free")
    expect(mounted.container.textContent).toContain("Drag bubbles to rearrange, scroll to zoom")
    await click(button(mounted.container, "1AC"))
    expect(graph.props?.layout).toBe("columns")
    await click(button(mounted.container, "Free arrange"))
    await click(button(mounted.container, "Speech columns"))
    expect(graph.props?.layout).toBe("columns")
    await mounted.unmount()
  })

  it("details the clicked bubble: side, speech, parent, explanation and links", async () => {
    const mounted = await mount(view(CHART, { sideNames: { aff: "PRO", neg: "CON" } }))
    await flush(() => graph.props?.onSelect("a1"))
    let text = mounted.container.textContent ?? ""
    expect(text).toContain("PRO")
    expect(text).toContain("1AC")
    expect(text).toContain("Perm answers this: do both")

    await flush(() => graph.props?.onSelect("a1w"))
    text = mounted.container.textContent ?? ""
    expect(text).toContain("Part of: Cap bad")
    expect(text).toContain("related → Perm")

    await flush(() => graph.props?.onSelect("n1"))
    text = mounted.container.textContent ?? ""
    expect(text).toContain("CON")
    expect(text).toContain("answers → Cap bad: do both")
    expect(text).toContain("Scarcity related this")

    await flush(() => graph.props?.onSelect(null))
    expect(mounted.container.textContent).not.toContain("Part of:")
    await mounted.unmount()
  })

  it("clears the selection and focus when a new chart arrives", async () => {
    const mounted = await mount(view())
    await click(button(mounted.container, "1AC"))
    await flush(() => graph.props?.onSelect("a1"))
    await mounted.rerender(view({ ...CHART, summary: "New chart" }))
    expect(graph.props?.selectedId).toBeNull()
    expect(graph.props?.focusSpeeches.size).toBe(0)
    await mounted.unmount()
  })

  it("copies the outline to the clipboard and briefly confirms", async () => {
    vi.useFakeTimers()
    const writeText = vi.fn(async () => {})
    vi.stubGlobal("navigator", { clipboard: { writeText } })
    const mounted = await mount(view())
    await click(button(mounted.container, "Copy as outline"))
    expect(writeText).toHaveBeenCalledTimes(1)
    expect((writeText.mock.calls[0] as unknown as [string])[0]).toContain("Cap bad")
    expect(mounted.container.querySelector("svg.lucide-check")).not.toBeNull()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600)
    })
    expect(mounted.container.querySelector("svg.lucide-check")).toBeNull()
    await mounted.unmount()
    vi.useRealTimers()
  })

  it("ignores a blocked clipboard", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn(async () => Promise.reject(new Error("denied"))) } })
    const mounted = await mount(view())
    await click(button(mounted.container, "Copy as outline"))
    expect(mounted.container.querySelector("svg.lucide-check")).toBeNull()
    await mounted.unmount()
  })
})
