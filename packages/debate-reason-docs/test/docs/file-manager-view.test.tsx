/** @vitest-environment jsdom */
/**
 * @fileoverview The SVAR file manager's actions, routed back to the real rows.
 *
 * SVAR itself is replaced with a stand-in that captures the `init` callback
 * and records the handlers registered on its event bus, so each action can be
 * fired by path exactly as the widget would fire it.
 */
import { act } from "react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

type Handler = (event: Record<string, unknown>) => unknown
const svar = vi.hoisted(() => ({
  on: new Map<string, Handler>(),
  intercept: new Map<string, Handler>(),
  data: [] as Array<{ id: string }>,
  theme: "",
}))
vi.mock("@svar-ui/react-filemanager", () => ({
  Filemanager: ({ data, init }: { data: Array<{ id: string }>; init: (api: unknown) => void }) => {
    svar.data = data
    if (svar.on.size === 0 && svar.intercept.size === 0) {
      init({
        on: (name: string, fn: Handler) => svar.on.set(name, fn),
        intercept: (name: string, fn: Handler) => svar.intercept.set(name, fn),
      })
    }
    return <div data-testid="svar">{data.map((d) => d.id).join("|")}</div>
  },
  Willow: ({ children }: { children: unknown }) => {
    svar.theme = "light"
    return <>{children}</>
  },
  WillowDark: ({ children }: { children: unknown }) => {
    svar.theme = "dark"
    return <>{children}</>
  },
}))

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))
vi.mock("sonner", () => ({ toast }))

import FileManagerView, { type FileManagerViewProps } from "../../src/docs/file-manager/FileManagerView"
import { FileManagerDialog } from "../../src/docs/file-manager/FileManagerDialog"
import type { ReasonDocument } from "../../src/docs/types"
import type { TopicStarterItem } from "../../src/docs/topic-starters/TopicStarterTree"
import { cleanup, flush, installDomShims, mount } from "../helpers/dom"

beforeAll(installDomShims)
afterEach(() => {
  cleanup()
  svar.on.clear()
  svar.intercept.clear()
  vi.clearAllMocks()
  document.documentElement.classList.remove("dark")
})

const doc = (id: number, title: string, parentId: number | null, isFolder = false): ReasonDocument =>
  ({ id, title, content: "x", format: "html", parentId, isFolder, updatedAt: 0 }) as ReasonDocument
const topic = (id: number, title: string, parentId: number | null, isFolder = false): TopicStarterItem => ({
  id,
  title,
  content: "y",
  parentId,
  isFolder,
  tags: "[]",
})

const DOCS = [doc(1, "Case", null), doc(2, "Impacts", null, true), doc(3, "Warming", 2)]
const TOPICS = [topic(10, "Energy", null, true), topic(11, "Solar", 10)]

function handlers() {
  return {
    onOpenDocument: vi.fn(),
    onOpenTopic: vi.fn(),
    onCreate: vi.fn(),
    onUpload: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onMove: vi.fn(),
    onDuplicate: vi.fn(),
    onDownload: vi.fn(),
    onDownloadTopic: vi.fn(),
    onSaveTopicCopy: vi.fn(),
    onPublish: vi.fn(),
  }
}

function setup(overrides: Partial<FileManagerViewProps> = {}) {
  const h = handlers()
  const onDone = vi.fn()
  mount(<FileManagerView documents={DOCS} topics={TOPICS} onDone={onDone} {...h} {...overrides} />)
  const fire = (kind: "on" | "intercept", name: string, event: Record<string, unknown>) => {
    let result: unknown
    act(() => {
      result = svar[kind].get(name)!(event)
    })
    return result
  }
  return { h, onDone, fire }
}

describe("FileManagerView", () => {
  it("shows the reader's files and the Topic Starters by path", () => {
    setup()
    expect(svar.data.map((d) => d.id)).toEqual([
      "/Topic Starters",
      "/Impacts",
      "/Impacts/Warming",
      "/Case",
      "/Topic Starters/Energy",
      "/Topic Starters/Energy/Solar",
    ])
    expect(svar.theme).toBe("light")
  })

  it("opens and downloads files from either area, closing on open", () => {
    const { h, onDone, fire } = setup()
    fire("on", "open-file", { id: "/Impacts/Warming" })
    expect(h.onOpenDocument).toHaveBeenCalledWith(3)
    expect(onDone).toHaveBeenCalledTimes(1)
    fire("on", "open-file", { id: "/Topic Starters/Energy/Solar" })
    expect(h.onOpenTopic).toHaveBeenCalledWith(TOPICS[1])
    fire("on", "open-file", { id: "/Impacts" })
    expect(onDone).toHaveBeenCalledTimes(2)

    fire("on", "download-file", { id: "/Case" })
    expect(h.onDownload).toHaveBeenCalledWith(1)
    fire("on", "download-file", { id: "/Topic Starters/Energy/Solar" })
    expect(h.onDownloadTopic).toHaveBeenCalledWith(TOPICS[1])
  })

  it("creates files, folders and uploads in the reader's folders only", () => {
    const { h, fire } = setup()
    expect(fire("intercept", "create-file", { file: { name: "New", type: "file" }, parent: "/Impacts" })).toBe(false)
    expect(h.onCreate).toHaveBeenCalledWith(2, false)
    fire("intercept", "create-file", { file: { name: "Dir", type: "folder" }, parent: "/" })
    expect(h.onCreate).toHaveBeenLastCalledWith(null, true)
    const file = new File(["x"], "brief.docx")
    fire("intercept", "create-file", { file: { name: "brief.docx", file }, parent: "/Impacts" })
    expect(h.onUpload).toHaveBeenCalledWith([file], 2)

    fire("intercept", "create-file", { file: { name: "Nope" }, parent: "/Topic Starters/Energy" })
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("read-only"))
    expect(h.onCreate).toHaveBeenCalledTimes(2)
  })

  it("renames and deletes the reader's rows and refuses to touch topic starters", () => {
    const { h, fire } = setup()
    expect(fire("intercept", "rename-file", { id: "/Case", name: " Case 2 " })).toBe(false)
    expect(h.onRename).toHaveBeenCalledWith(1, "Case 2")
    fire("intercept", "rename-file", { id: "/Topic Starters/Energy", name: "Nope" })
    expect(h.onRename).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalled()

    expect(fire("intercept", "delete-files", { ids: ["/Case", "/Topic Starters/Energy/Solar"] })).toBe(false)
    expect(h.onDelete).toHaveBeenCalledTimes(1)
    expect(h.onDelete).toHaveBeenCalledWith(1)
  })

  it("routes moves and copies by where each row comes from and lands", () => {
    const { h, fire } = setup()
    // Within the reader's files: a move is a move, a copy a duplicate.
    expect(fire("intercept", "move-files", { ids: ["/Case"], target: "/Impacts" })).toBe(false)
    expect(h.onMove).toHaveBeenCalledWith(1, 2)
    fire("intercept", "copy-files", { ids: ["/Impacts/Warming"], target: "/" })
    expect(h.onDuplicate).toHaveBeenCalledWith(3, null)

    // Out of Topic Starters, either way, is a saved copy.
    fire("intercept", "move-files", { ids: ["/Topic Starters/Energy/Solar"], target: "/Impacts" })
    fire("intercept", "copy-files", { ids: ["/Topic Starters/Energy"], target: "/" })
    expect(h.onSaveTopicCopy).toHaveBeenNthCalledWith(1, TOPICS[1], 2)
    expect(h.onSaveTopicCopy).toHaveBeenNthCalledWith(2, TOPICS[0], null)

    // Into Topic Starters is a publish — files only.
    fire("intercept", "copy-files", { ids: ["/Case"], target: "/Topic Starters/Energy" })
    expect(h.onPublish).toHaveBeenCalledWith(1, 10)
    fire("intercept", "move-files", { ids: ["/Impacts/Warming"], target: "/Topic Starters" })
    expect(h.onPublish).toHaveBeenLastCalledWith(3, null)
    fire("intercept", "move-files", { ids: ["/Impacts"], target: "/Topic Starters" })
    expect(toast.error).toHaveBeenCalledWith("Only files can be added to Topic Starters.")

    // Within Topic Starters nothing moves, and a file is no destination.
    fire("intercept", "move-files", { ids: ["/Topic Starters/Energy/Solar"], target: "/Topic Starters" })
    fire("intercept", "move-files", { ids: ["/Case"], target: "/Impacts/Warming" })
    expect(h.onMove).toHaveBeenCalledTimes(1)
    expect(h.onSaveTopicCopy).toHaveBeenCalledTimes(2)
  })

  it("follows the app's dark mode", async () => {
    document.documentElement.classList.add("dark")
    setup()
    await flush()
    expect(svar.theme).toBe("dark")
  })
})

describe("FileManagerDialog", () => {
  it("loads the file manager only once it is opened", async () => {
    const h = handlers()
    const onOpenChange = vi.fn()
    const { rerender } = mount(
      <FileManagerDialog open={false} onOpenChange={onOpenChange} documents={DOCS} topics={[]} {...h} />,
    )
    expect(document.querySelector("[data-testid=svar]")).toBeNull()
    rerender(<FileManagerDialog open onOpenChange={onOpenChange} documents={DOCS} topics={[]} {...h} />)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    await flush()
    expect(document.querySelector("[data-testid=svar]")?.textContent).toContain("/Case")
    act(() => {
      svar.on.get("open-file")!({ id: "/Case" })
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
