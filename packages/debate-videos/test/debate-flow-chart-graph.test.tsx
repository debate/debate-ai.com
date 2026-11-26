/** @vitest-environment jsdom */
/**
 * @fileoverview `DebateFlowChartGraph` draws the round's mind map with D3
 * (loaded lazily inside an effect). Rendered here against real D3 in jsdom:
 * one bubble per argument carrying the speech tag and an accessible name, a
 * header per speech column in the columns layout, links with arrowheads, and
 * the click / keyboard / focus-highlight behaviour the dialog relies on.
 * jsdom has no layout, so only structure and attributes are asserted — not
 * pixel positions.
 */

import { act } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  FLOW_CHART_COLORS,
  headerText,
  DebateFlowChartGraph,
  type FlowChartLayout,
} from "../src/components/videos/watch/flow-chart/DebateFlowChartGraph"
import { flowChartSpeechColumns, type DebateFlowChart } from "../src/lib/debate-flow-chart"
import { mount } from "./helpers/mount"

const CHART: DebateFlowChart = {
  summary: "The alt solves.",
  nodes: [
    { id: "a1", side: "aff", label: "Capitalism causes extinction through resource wars", explanation: "The link.", speech: "1AC" },
    { id: "a1w", side: "aff", label: "Warrant: scarcity", explanation: "Sub-point.", speech: "1AC", parent: "a1" },
    { id: "n1", side: "neg", label: "Perm severs", explanation: "Do both.", speech: "1NC" },
    { id: "n2", side: "neg", label: "Unattributed", explanation: "", speech: undefined },
  ],
  links: [
    { source: "n1", target: "a1", kind: "answers", label: "perm" },
    { source: "a1w", target: "a1", kind: "extends" },
    { source: "n2", target: "n1", kind: "related" },
  ],
}

const COLUMNS = flowChartSpeechColumns(CHART, [
  { label: "1AC", side: "aff" },
  { label: "1NC", side: "neg" },
])

async function settle() {
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
}

interface Props {
  layout?: FlowChartLayout
  focus?: string[]
  selectedId?: string | null
  onSelect?: (id: string | null) => void
}

function graph({ layout = "columns", focus = [], selectedId = null, onSelect = () => {} }: Props = {}) {
  return (
    <DebateFlowChartGraph
      chart={CHART}
      columns={COLUMNS}
      layout={layout}
      focusSpeeches={new Set(focus)}
      selectedId={selectedId}
      onSelect={onSelect}
      className="chart"
    />
  )
}

const bubbles = (root: ParentNode) => [...root.querySelectorAll<SVGGElement>('g[role="button"]')]
const rectFill = (g: Element) => g.querySelector("rect")?.getAttribute("fill")

const svgProto = SVGSVGElement.prototype as unknown as Record<string, unknown>

beforeEach(() => {
  // d3-zoom measures the SVG through width/height.baseVal, which jsdom lacks.
  for (const dimension of ["width", "height"]) {
    Object.defineProperty(svgProto, dimension, { configurable: true, get: () => ({ baseVal: { value: 600 } }) })
  }
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 0))
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id))
})
afterEach(() => {
  vi.unstubAllGlobals()
  delete svgProto.width
  delete svgProto.height
})

describe("headerText", () => {
  it("shows the label alone, or a placeholder for the blank column", () => {
    expect(headerText({ label: "1NC" })).toBe("1NC")
    expect(headerText({ label: "" })).toBe("Other")
  })

  it("appends a section title and clips it with an ellipsis", () => {
    expect(headerText({ label: "1AC", title: "Plan" })).toBe("1AC Plan")
    const clipped = headerText({ label: "1AC", title: "A very long section heading indeed" })
    expect(clipped).toHaveLength(22)
    expect(clipped.endsWith("…")).toBe(true)
  })
})

describe("DebateFlowChartGraph", () => {
  it("exposes the palette the legend and badges share", () => {
    expect(FLOW_CHART_COLORS.aff.strong).not.toBe(FLOW_CHART_COLORS.neg.strong)
  })

  it("draws one labelled bubble per argument with its speech tag", async () => {
    const mounted = await mount(graph())
    await settle()
    const svg = mounted.container.querySelector("svg")!
    expect(svg.getAttribute("role")).toBe("img")
    expect(svg.getAttribute("class")).toBe("chart")

    const nodes = bubbles(svg)
    expect(nodes).toHaveLength(4)
    expect(nodes[0].getAttribute("aria-label")).toBe(
      "1AC, Affirmative: Capitalism causes extinction through resource wars. The link.",
    )
    expect(nodes[2].getAttribute("aria-label")).toBe("1NC, Negative: Perm severs. Do both.")
    expect(nodes[3].getAttribute("aria-label")).toBe("Negative: Unattributed. ")
    const tags = [...svg.querySelectorAll(".speech-tag")].map((t) => t.textContent)
    expect(tags).toEqual(["1AC · AFF", "1AC · AFF", "1NC · NEG", "? · NEG"])
    expect(nodes[0].textContent).toContain("Capitalism causes extinction")
    expect(nodes[0].querySelector("title")?.textContent).toContain("The link.")
    expect(nodes[3].querySelector("title")?.textContent).toBe("Unattributed")
    await mounted.unmount()
  })

  it("adds a header per speech column in the columns layout, hidden in free arrange", async () => {
    const mounted = await mount(graph({ layout: "columns" }))
    await settle()
    const headerTexts = [...mounted.container.querySelectorAll("svg > g > g:first-child > g text")].map((t) => t.textContent)
    expect(headerTexts).toEqual(["1AC", "1NC", "Other"])
    const header = mounted.container.querySelector("svg > g > g:first-child > g")!
    expect(header.getAttribute("display")).toBeNull()

    await mounted.rerender(graph({ layout: "free" }))
    await settle()
    expect(header.getAttribute("display")).toBe("none")
    await mounted.unmount()
  })

  it("draws parent links plain and cross links dashed with arrowheads and a tooltip", async () => {
    const mounted = await mount(graph())
    await settle()
    const paths = [...mounted.container.querySelectorAll("svg g[fill='none'] > path")]
    // 1 parent link + 3 cross links.
    expect(paths).toHaveLength(4)
    const parent = paths[0]
    expect(parent.getAttribute("marker-end")).toBeNull()
    expect(parent.getAttribute("stroke-dasharray")).toBeNull()
    const answers = paths.find((p) => p.getAttribute("marker-end") === "url(#flow-arrow-answers)")!
    expect(answers.getAttribute("stroke-dasharray")).toBe("6 4")
    expect(answers.querySelector("title")?.textContent).toBe("answers: perm")
    expect(mounted.container.querySelector("#flow-arrow-extends")).not.toBeNull()
    expect(paths.every((p) => (p.getAttribute("d") ?? "").startsWith("M"))).toBe(true)
    await mounted.unmount()
  })

  it("selects a bubble on click and by keyboard, and clears on a click on the background", async () => {
    const onSelect = vi.fn()
    const mounted = await mount(graph({ onSelect }))
    await settle()
    const [first, , third] = bubbles(mounted.container)

    await act(async () => first.dispatchEvent(new MouseEvent("click", { bubbles: true })))
    expect(onSelect).toHaveBeenLastCalledWith("a1")

    await act(async () => third.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })))
    expect(onSelect).toHaveBeenLastCalledWith("n1")
    await act(async () => third.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true })))
    expect(onSelect).toHaveBeenCalledTimes(3)
    await act(async () => third.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true })))
    expect(onSelect).toHaveBeenCalledTimes(3)

    await act(async () => mounted.container.querySelector("svg")!.dispatchEvent(new MouseEvent("click", { bubbles: true })))
    expect(onSelect).toHaveBeenLastCalledWith(null)
    await mounted.unmount()
  })

  it("greys every speech outside the focus and restores them when it is cleared", async () => {
    const mounted = await mount(graph({ focus: ["1AC"] }))
    await settle()
    const [a1, a1w, n1] = bubbles(mounted.container)
    expect(rectFill(n1)).toBe("#e5e7eb")
    expect(rectFill(a1)).toBe(COLUMNS[0].color)
    expect(rectFill(a1w)).toBe(COLUMNS[0].light)

    await mounted.rerender(graph({ focus: [] }))
    await settle()
    expect(rectFill(n1)).toBe(COLUMNS[1].color)
    await mounted.unmount()
  })

  it("outlines the selected bubble and dims bubbles it is not linked to", async () => {
    const mounted = await mount(graph({ selectedId: "n1" }))
    await settle()
    const [a1, a1w, n1, n2] = bubbles(mounted.container)
    expect(n1.querySelector("rect")?.getAttribute("stroke")).toBe("#f59e0b")
    expect(n1.getAttribute("opacity")).toBe("1")
    // a1 answers n1 and n2 is related to it; the warrant touches neither.
    expect(a1.getAttribute("opacity")).toBe("1")
    expect(n2.getAttribute("opacity")).toBe("1")
    expect(a1w.getAttribute("opacity")).toBe("0.35")

    await mounted.rerender(graph({ selectedId: null }))
    await settle()
    expect(a1w.getAttribute("opacity")).toBe("1")
    await mounted.unmount()
  })

  it("lays bubbles out in the free arrangement and glides back to columns", async () => {
    const mounted = await mount(graph({ layout: "free" }))
    await settle()
    const nodes = bubbles(mounted.container)
    expect(nodes).toHaveLength(4)
    expect(nodes.every((n) => /^translate\(/.test(n.getAttribute("transform") ?? ""))).toBe(true)
    expect(nodes[0].getAttribute("cursor")).toBe("grab")

    await mounted.rerender(graph({ layout: "columns" }))
    await settle()
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 700))
    })
    expect(nodes[0].getAttribute("cursor")).toBe("pointer")
    await mounted.unmount()
  })

  it("renders an empty chart without bubbles", async () => {
    const mounted = await mount(
      <DebateFlowChartGraph
        chart={{ nodes: [], links: [] }}
        columns={[]}
        layout="columns"
        focusSpeeches={new Set()}
        selectedId={null}
        onSelect={() => {}}
      />,
    )
    await settle()
    expect(bubbles(mounted.container)).toHaveLength(0)
    await mounted.unmount()
  })

  it("stops its simulation on unmount and ignores a load that finished after it", async () => {
    const mounted = await mount(graph())
    await mounted.unmount()
    await settle()
    expect(document.querySelector("svg")).toBeNull()
  })
})
