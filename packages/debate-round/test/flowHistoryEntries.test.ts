import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  addFlowHistoryEntry,
  FLOW_HISTORY_KEY,
  flowFromHistoryEntry,
  HISTORY_COALESCE_MS,
  MAX_HISTORY_ENTRIES,
  readFlowHistory,
  writeFlowHistory,
  type FlowHistoryEntry,
} from "../src/state/flowHistoryEntries"
import { useFlowStore } from "../src/state/store"
import type { Flow } from "../src/types/flow"

function makeFlow(id: number, content = "AC", extra: Partial<Flow> = {}): Flow {
  return {
    content,
    level: 0,
    columns: ["AC", "NC"],
    invert: false,
    focus: false,
    index: 0,
    lastFocus: [],
    children: [],
    id,
    ...extra,
  }
}

describe("addFlowHistoryEntry", () => {
  it("adds a newest-first entry labelled with the flow name", () => {
    const history = addFlowHistoryEntry([], makeFlow(1, "1AC"), 1000)
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({ id: "1-1000", timestamp: 1000, label: "1AC" })
  })

  it("skips a snapshot identical to that flow's newest entry (focus changes ignored)", () => {
    const first = addFlowHistoryEntry([], makeFlow(1), 1000)
    const again = addFlowHistoryEntry(first, makeFlow(1, "AC", { focus: true, lastFocus: [0] }), 999_999)
    expect(again).toBe(first)
  })

  it("coalesces rapid edits to the same flow into its newest entry", () => {
    const first = addFlowHistoryEntry([], makeFlow(1, "AC"), 1000)
    const edited = addFlowHistoryEntry(first, makeFlow(1, "AC edited"), 1000 + HISTORY_COALESCE_MS - 1)
    expect(edited).toHaveLength(1)
    expect(edited[0].id).toBe(first[0].id)
    expect(edited[0].flow.content).toBe("AC edited")
  })

  it("keeps a new version once the coalesce window has passed", () => {
    const first = addFlowHistoryEntry([], makeFlow(1, "AC"), 1000)
    const later = addFlowHistoryEntry(first, makeFlow(1, "AC v2"), 1000 + HISTORY_COALESCE_MS)
    expect(later).toHaveLength(2)
  })

  it("doesn't let one flow's edits push other flows out", () => {
    let history: FlowHistoryEntry[] = addFlowHistoryEntry([], makeFlow(2, "NC"), 0)
    for (let i = 1; i <= 200; i++) history = addFlowHistoryEntry(history, makeFlow(1, `AC ${i}`), 1000 + i * 1000)
    expect(history.some((e) => e.flow.id === 2)).toBe(true)
  })

  it("caps the log", () => {
    let history: FlowHistoryEntry[] = []
    for (let i = 0; i < MAX_HISTORY_ENTRIES + 10; i++) history = addFlowHistoryEntry(history, makeFlow(i), i)
    expect(history).toHaveLength(MAX_HISTORY_ENTRIES)
    expect(history[0].flow.id).toBe(MAX_HISTORY_ENTRIES + 9)
  })

  it("snapshots rather than aliasing the live flow", () => {
    const flow = makeFlow(1)
    const history = addFlowHistoryEntry([], flow, 1)
    flow.content = "mutated"
    expect(history[0].flow.content).toBe("AC")
  })
})

describe("writeFlowHistory", () => {
  it("drops the oldest entries on a quota error instead of wiping history", () => {
    const entries = Array.from({ length: 8 }, (_, i) => addFlowHistoryEntry([], makeFlow(i), i)[0])
    const saved: string[] = []
    const storage = {
      setItem: (_k: string, v: string) => {
        if ((JSON.parse(v) as unknown[]).length > 4) throw new DOMException("full", "QuotaExceededError")
        saved.push(v)
      },
      removeItem: vi.fn(),
    }
    expect(writeFlowHistory(entries, storage)).toBe(4)
    const kept = JSON.parse(saved[0]) as FlowHistoryEntry[]
    expect(kept.map((e) => e.flow.id)).toEqual([0, 1, 2, 3])
    expect(storage.removeItem).not.toHaveBeenCalled()
  })

  it("reads back what it wrote and ignores malformed rows", () => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    }
    const entries = addFlowHistoryEntry([], makeFlow(5), 5)
    writeFlowHistory(entries, storage)
    expect(readFlowHistory(storage)).toEqual(entries)
    store.set(FLOW_HISTORY_KEY, JSON.stringify([{ nope: true }, ...entries]))
    expect(readFlowHistory(storage)).toEqual(entries)
    store.set(FLOW_HISTORY_KEY, "{bad")
    expect(readFlowHistory(storage)).toEqual([])
  })
})

describe("flowFromHistoryEntry", () => {
  it("restores an archived flow un-archived with a fresh id and index", () => {
    const [entry] = addFlowHistoryEntry([], makeFlow(1, "AC", { archived: true }), 1)
    expect(flowFromHistoryEntry(entry, 3, 42)).toMatchObject({ id: 42, index: 3, archived: false, content: "AC" })
  })
})

describe("useFlowStore history", () => {
  let store: Map<string, string>
  beforeEach(() => {
    store = new Map()
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    })
    useFlowStore.setState({ flows: [makeFlow(1, "AC")], selected: 0 })
  })
  afterEach(() => vi.unstubAllGlobals())

  it("saves entries and opens a restored one immediately", () => {
    useFlowStore.getState().saveToHistory(makeFlow(9, "Old NC", { archived: true }))
    const [entry] = useFlowStore.getState().getFlowHistory()
    expect(entry.label).toBe("Old NC")

    const index = useFlowStore.getState().loadFromHistory(entry.id)
    const state = useFlowStore.getState()
    expect(index).toBe(1)
    expect(state.selected).toBe(1)
    expect(state.flows[1]).toMatchObject({ content: "Old NC", archived: false, index: 1 })
  })

  it("returns null for an entry that no longer exists", () => {
    expect(useFlowStore.getState().loadFromHistory("missing")).toBeNull()
    expect(useFlowStore.getState().flows).toHaveLength(1)
  })
})
