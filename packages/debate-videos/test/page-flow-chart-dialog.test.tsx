/** @vitest-environment jsdom */
/**
 * The docs toolbar's page flow chart modal: on submit it fetches the page's
 * Markdown, sends its sections with the prompt to /api/reason-ai, and shows
 * the chart with one focus chip per section.
 */
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

vi.mock("../src/components/videos/watch/flow-chart/DebateFlowChartGraph", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/components/videos/watch/flow-chart/DebateFlowChartGraph")>()),
  DebateFlowChartGraph: () => <svg data-testid="graph" />,
}))

import PageFlowChartDialog from "../src/components/videos/watch/flow-chart/PageFlowChartDialog"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root | null = null

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

afterEach(() => {
  act(() => root?.unmount())
  root = null
  document.body.innerHTML = ""
  window.localStorage.clear()
  vi.unstubAllGlobals()
})

async function flush() {
  for (let i = 0; i < 8; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
}

const REPLY = {
  summary: "The alt solves.",
  nodes: [
    { id: "a1", side: "aff", label: "Cap causes war", text: "The link.", speech: "§1" },
    { id: "n1", side: "neg", label: "Perm", text: "Do both.", speech: "§2" },
  ],
  links: [{ from: "n1", to: "a1", kind: "answers" }],
}

describe("PageFlowChartDialog", () => {
  it("charts the page's sections from the prompt", async () => {
    const calls: Array<{ url: string; body?: string }> = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, body: init?.body as string | undefined })
        if (url === "/docs/cap.mdx") {
          return new Response("Intro words.\n\n## The link\nCapitalism causes war.\n\n## Perm\nDo both.")
        }
        return Response.json({ text: JSON.stringify(REPLY) })
      }),
    )
    const container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    act(() =>
      root!.render(
        <PageFlowChartDialog open onOpenChange={() => {}} pageKey="/docs/cap" title="Cap K" markdownUrl="/docs/cap.mdx" />,
      ),
    )
    await flush()
    const generate = [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("Generate flow chart"))
    expect(generate).toBeTruthy()
    await act(async () => generate!.click())
    await flush()

    expect(calls.map((call) => call.url)).toEqual(["/docs/cap.mdx", "/api/reason-ai"])
    const prompt = JSON.parse(calls[1].body!).messages[0].content as string
    expect(prompt).toContain("Page: Cap K")
    expect(prompt).toContain("## The link [§2]")
    expect(document.body.textContent).toContain("The alt solves.")
    const chip = [...document.querySelectorAll("button")].find((b) => b.textContent === "§2")
    expect(chip?.getAttribute("title")).toContain("§2 The link")
    expect(window.localStorage.getItem("debate-ai:page-flow-chart:/docs/cap")).toContain("Cap causes war")
  })
})
