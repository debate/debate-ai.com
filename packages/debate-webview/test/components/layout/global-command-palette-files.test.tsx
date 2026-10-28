/** @vitest-environment jsdom */
/**
 * @fileoverview Ctrl/Cmd-K finds the sidebar's files by name and contents.
 *
 * The docs provider is stood in for, so the palette sees a fixed set of the
 * reader's files and topic starters — one of them a `.cmir` whose text only
 * Debate Editor's engine (registered here as a fake) can read.
 */
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const nav = vi.hoisted(() => ({ push: vi.fn(), pathname: "/tools" }))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push }),
  usePathname: () => nav.pathname,
}))

const docs = vi.hoisted(() => ({ value: null as unknown }))
vi.mock("@debate-ai/reason-docs/docs/ReasonDocsProvider", () => ({
  useOptionalReasonDocs: () => docs.value,
}))

import { GlobalCommandPalette, isKShortcut, openGlobalCommandPalette } from "../../../src/components/layout/command-palette/GlobalCommandPalette"
import { registerStoredCmir, type StoredCmir } from "@debate-ai/reason-docs/lib/debate-editor/lazy-stored-cmir"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const DOCUMENTS = [
  { id: 1, title: "Warming Aff", content: "<p>Emissions cause <b>tipping points</b>.</p>", format: "html", parentId: 3, isFolder: false, updatedAt: 0 },
  { id: 2, title: "Econ DA", content: "<h4>Spending Link</h4><p>A recession follows the plan.</p>", format: "html", parentId: null, isFolder: false, updatedAt: 0 },
  { id: 3, title: "Impacts", content: "", format: "html", parentId: null, isFolder: true, updatedAt: 0 },
]
const TOPICS = [
  { id: 10, title: "Energy", content: "", parentId: null, isFolder: true, tags: "[]" },
  { id: 11, title: "Solar Neg", content: "H4sIgzipped", format: "cmir", parentId: 10, isFolder: false, tags: "[]" },
]

function makeDocs() {
  return {
    documents: DOCUMENTS,
    topicItems: TOPICS,
    ensureLoaded: vi.fn(),
    openDocument: vi.fn(),
    selectTopicDocument: vi.fn(),
    documentHtml: (doc: { content: string }) => doc.content,
  }
}

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
  Element.prototype.scrollIntoView ??= () => {}
  globalThis.Audio = class {
    play() {
      return Promise.resolve()
    }
  } as unknown as typeof Audio
  registerStoredCmir({
    storedContentToHtml: () => "<p>Photovoltaic subsidies collapse the grid.</p>",
  } as unknown as StoredCmir)
})

let root: Root
let host: HTMLDivElement
let current: ReturnType<typeof makeDocs>

beforeEach(() => {
  nav.pathname = "/tools"
  current = makeDocs()
  docs.value = current
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<GlobalCommandPalette />))
})

afterEach(() => {
  act(() => root.unmount())
  document.body.innerHTML = ""
  nav.push.mockReset()
})

function type(text: string) {
  const input = document.querySelector<HTMLInputElement>("[cmdk-input]")!
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
  act(() => {
    setValue.call(input, text)
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
}

const fileRows = () => {
  const group = [...document.querySelectorAll("[cmdk-group]")].find(
    (g) => g.querySelector("[cmdk-group-heading]")?.textContent === "Files",
  )
  return group ? [...group.querySelectorAll<HTMLElement>("[cmdk-item]")] : []
}

describe("GlobalCommandPalette file search", () => {
  it("loads the files when it opens and lists none until something is typed", () => {
    act(() => openGlobalCommandPalette())
    expect(current.ensureLoaded).toHaveBeenCalled()
    expect(fileRows()).toHaveLength(0)
  })

  it("finds a file by name, showing where it lives", () => {
    act(() => openGlobalCommandPalette())
    type("warming")
    expect(fileRows()).toHaveLength(1)
    expect(fileRows()[0]!.textContent).toContain("Warming Aff")
    expect(fileRows()[0]!.textContent).toContain("My files / Impacts")
  })

  it("finds a file by its contents, with the matching text", () => {
    act(() => openGlobalCommandPalette())
    type("recession")
    expect(fileRows()[0]!.textContent).toContain("Econ DA")
    expect(fileRows()[0]!.textContent).toContain("A recession follows the plan.")
  })

  it("finds a file by an outline heading, naming the heading", () => {
    act(() => openGlobalCommandPalette())
    type("spending link")
    expect(fileRows()[0]!.textContent).toContain("Econ DA")
    expect(fileRows()[0]!.textContent).toContain("§ Spending Link")
  })

  it("lists matching videos and lectures from the library and opens a watch page", async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          videos: [["xyz789", "How to Flow", "2024-09-01T00:00:00Z", "Coach Channel", 50, "", "lectures_basics"]],
        }),
      ),
    )
    vi.stubGlobal("fetch", fetchMock)
    try {
      act(() => openGlobalCommandPalette())
      type("flow")
      expect(fetchMock).not.toHaveBeenCalled()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(250)
      })
      expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain("q=flow")
      const group = [...document.querySelectorAll("[cmdk-group]")].find(
        (g) => g.querySelector("[cmdk-group-heading]")?.textContent === "Videos & Lectures",
      )
      const [row] = [...(group?.querySelectorAll<HTMLElement>("[cmdk-item]") ?? [])]
      expect(row!.textContent).toContain("How to Flow")
      expect(row!.textContent).toContain("Lecture")
      act(() => row!.click())
      expect(nav.push).toHaveBeenCalledWith(expect.stringMatching(/^\/videos\//))
    } finally {
      vi.useRealTimers()
      vi.unstubAllGlobals()
    }
  })

  it("reads a .cmir topic starter's text through the engine and opens it", async () => {
    act(() => openGlobalCommandPalette())
    type("photovoltaic")
    await act(async () => {})
    const [row] = fileRows()
    expect(row!.textContent).toContain("Solar Neg")
    act(() => row!.click())
    expect(current.selectTopicDocument).toHaveBeenCalledWith(TOPICS[1])
    expect(nav.push).toHaveBeenCalledWith("/docs/vcx27/energy/solar-neg")
  })

  it("opens one of the reader's own files", () => {
    act(() => openGlobalCommandPalette())
    type("tipping")
    act(() => fileRows()[0]!.click())
    expect(current.openDocument).toHaveBeenCalledWith(1)
    expect(nav.push).toHaveBeenCalledWith("/reason-editor?doc=impacts/warming-aff")
  })

  it("answers Ctrl/Cmd-K on the editor route but leaves Ctrl/Cmd-P to the editor", () => {
    nav.pathname = "/reason-editor"
    act(() => root.render(<GlobalCommandPalette />))
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "p", code: "KeyP", ctrlKey: true }))
    })
    expect(document.querySelector("[cmdk-input]")).toBeNull()
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", code: "KeyK", ctrlKey: true }))
    })
    expect(document.querySelector("[cmdk-input]")).not.toBeNull()
  })

  it("tells the K chord from the P chord", () => {
    expect(isKShortcut({ key: "k", code: "KeyK" })).toBe(true)
    expect(isKShortcut({ key: "л", code: "KeyK" })).toBe(true)
    expect(isKShortcut({ key: "p", code: "KeyP" })).toBe(false)
  })
})
