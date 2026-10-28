// @vitest-environment jsdom
/**
 * @fileoverview Tests for the debate flow page's own hooks — the ones
 * `DebateFlowPage` composes: initial load/persistence/font-size/argument-tree
 * effects, timer state, split-mode navigation, speech-doc handlers, flow
 * handlers, URL <-> round sync, prep-note deep links, mobile detection and
 * recording status — plus `utils/storage-utils`' localStorage accounting.
 *
 * Persistence is the case this package's CLAUDE.md singles out ("data loss
 * in the flow grid … is the worst bug this repo can ship"), so the
 * `useFlowPersistence` tests cover the bulk-store write-through (no trim,
 * no quota alert) and `useInitialLoad`'s hydration.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const nav = vi.hoisted(() => ({
  pathname: "/",
  replace: vi.fn(),
  search: new URLSearchParams(),
}))
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
  useSearchParams: () => nav.search,
}))

const argumentTrees = vi.hoisted(() => ({ buildAndSaveArgumentTreeIfChanged: vi.fn() }))
vi.mock("../src/state/argumentTrees", () => argumentTrees)

import type { Flow, Round } from "../src/types/flow"
import { settings } from "../src/state/settings"
import { useFlowStore } from "../src/state/store"
import {
  useInitialLoad,
  useFontSizeSettings,
  useFlowPersistence,
  useArgumentTreeAutoSync,
} from "../src/hooks/useFlowEffects"
import { useTimerState } from "../src/hooks/useTimerState"
import { useSplitModeHandlers } from "../src/hooks/useSplitModeHandlers"
import { useSpeechHandlers, shareSpeech } from "../src/hooks/useSpeechHandlers"
import { useFlowHandlers } from "../src/hooks/useFlowHandlers"
import { useRoundFromSlug } from "../src/hooks/useRoundFromSlug"
import { useSyncUrlWithRound } from "../src/hooks/useSyncUrlWithRound"
import { useJumpToPrepNoteBox } from "../src/hooks/useJumpToPrepNoteBox"
import { useOpenRoundFromLink } from "../src/hooks/useOpenRoundFromLink"
import { useMobileDetection } from "../src/hooks/useMobileDetection"
import { useSpeechRecordingStatus } from "../src/hooks/useSpeechRecordingStatus"
import { useDebateFlowState } from "../src/hooks/useDebateFlowState"
import {
  getLocalStorageSize,
  getStorageInfo,
  logStorageInfo,
  safeSetItem,
  cleanupOldSpeechDocs,
} from "../src/utils/storage-utils"
import {
  configureBulkStorage,
  getBulkItem,
  resetBulkStorageForTests,
} from "@debate-ai/research-evidence/src/account-sync/bulk-storage"
import { cleanup, renderHook, run, flush } from "./dom-helpers"

function makeFlow(id: number, extra: Partial<Flow> = {}): Flow {
  return {
    content: `Flow ${id}`,
    level: 0,
    columns: ["1AC", "1NC", "2AC", "2NC"],
    invert: false,
    focus: false,
    index: id,
    lastFocus: [],
    children: [],
    id,
    ...extra,
  }
}

function makeRound(id: number, extra: Partial<Round> = {}): Round {
  return {
    id,
    tournamentName: "T",
    roundLevel: "R1",
    debaters: { aff: ["a@x.com", "b@x.com"], neg: ["c@x.com", "d@x.com"] },
    judges: ["j@x.com"],
    flowIds: [],
    timestamp: 1,
    status: "active",
    ...extra,
  }
}

function quotaError() {
  return new DOMException("full", "QuotaExceededError")
}

beforeEach(() => {
  localStorage.clear()
  resetBulkStorageForTests()
  nav.pathname = "/"
  nav.replace.mockReset()
  nav.search = new URLSearchParams()
  argumentTrees.buildAndSaveArgumentTreeIfChanged.mockReset()
  useFlowStore.setState({ flows: [], selected: 0, rounds: [] })
  settings.setValue("debateStyle", 0)
  settings.setValue("fontSize", 2)
  vi.spyOn(console, "log").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  resetBulkStorageForTests()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe("storage-utils", () => {
  it("sums key+value bytes per key", () => {
    localStorage.setItem("ab", "cd")
    localStorage.setItem("x", "")
    expect(getLocalStorageSize()).toEqual({ total: 5, byKey: { ab: 4, x: 1 } })
  })

  it("reports usage against a 10 MB quota with near-limit/critical flags", () => {
    localStorage.setItem("k", "v")
    const info = getStorageInfo()
    expect(info.totalBytes).toBe(2)
    expect(info.totalFormatted).toBe("2 Bytes")
    expect(info.estimatedQuota).toBe(10 * 1024 * 1024)
    expect(info.isNearLimit).toBe(false)
    expect(info.isCritical).toBe(false)
  })

  it("logs a sorted per-key breakdown and warns when usage is high", () => {
    localStorage.setItem("big", "x".repeat(100))
    localStorage.setItem("small", "y")
    const log = console.log as unknown as ReturnType<typeof vi.fn>
    const info = logStorageInfo()
    expect(info.byKey.big).toBe(103)
    const lines = log.mock.calls.map((c) => String(c[0]))
    expect(lines[0]).toBe("=== LocalStorage Usage ===")
    expect(lines.findIndex((l) => l.includes("big:"))).toBeLessThan(lines.findIndex((l) => l.includes("small:")))
    expect(console.warn).not.toHaveBeenCalled()

    // Push the estimate over 90% of the quota without actually storing 9 MB.
    const big = Blob
    vi.stubGlobal(
      "Blob",
      class extends big {
        get size() {
          return 5 * 1024 * 1024
        }
      },
    )
    const high = logStorageInfo()
    expect(high.isNearLimit).toBe(true)
    expect(high.isCritical).toBe(true)
    expect(high.percentUsed).toBe(100)
    expect(console.warn).toHaveBeenCalled()
    expect(console.error).toHaveBeenCalled()
  })

  it("safeSetItem returns true on success, false on a quota error, and rethrows anything else", () => {
    expect(safeSetItem("a", "1")).toBe(true)
    expect(localStorage.getItem("a")).toBe("1")

    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw quotaError()
    })
    expect(safeSetItem("b", "2")).toBe(false)
    setItem.mockImplementationOnce(() => {
      throw new Error("other")
    })
    expect(() => safeSetItem("c", "3")).toThrow("other")
  })

  it("cleanupOldSpeechDocs removes only speech docs of flows that no longer exist", () => {
    localStorage.setItem("speech-doc-1-1AC", "keep")
    localStorage.setItem("speech-doc-2-1AC", "drop")
    localStorage.setItem("speech-doc-3-1NC", "drop")
    localStorage.setItem("unrelated", "keep")
    expect(cleanupOldSpeechDocs([1])).toBe(2)
    expect(Object.keys(localStorage).sort()).toEqual(["speech-doc-1-1AC", "unrelated"])
    expect(cleanupOldSpeechDocs([1])).toBe(0)
  })
})

describe("useInitialLoad", () => {
  it("loads saved flows and rounds and prunes orphaned speech docs", async () => {
    localStorage.setItem("flows", JSON.stringify([makeFlow(4)]))
    localStorage.setItem("rounds", JSON.stringify([makeRound(9)]))
    localStorage.setItem("speech-doc-4-1AC", "mine")
    localStorage.setItem("speech-doc-5-1AC", "orphan")
    const setFlows = vi.fn()
    const setRounds = vi.fn()
    const hook = await renderHook(() => useInitialLoad(setFlows, setRounds))
    await flush()
    expect(setFlows).toHaveBeenCalledWith([expect.objectContaining({ id: 4 })])
    expect(setRounds).toHaveBeenCalledWith([expect.objectContaining({ id: 9 })])
    expect(localStorage.getItem("speech-doc-5-1AC")).toBeNull()
    expect(localStorage.getItem("speech-doc-4-1AC")).toBe("mine")
    expect(hook.result.current).toBe(true)
  })

  it("reports not-loaded until the bulk store hydrates, then loaded with nothing stored", async () => {
    const setFlows = vi.fn()
    const setRounds = vi.fn()
    const hook = await renderHook(() => useInitialLoad(setFlows, setRounds))
    await flush()
    expect(hook.result.current).toBe(true)
    expect(setFlows).not.toHaveBeenCalled()
    expect(setRounds).not.toHaveBeenCalled()
  })

  it("logs and skips corrupt stored JSON, still marking the load finished", async () => {
    localStorage.setItem("flows", "{bad")
    localStorage.setItem("rounds", "{bad")
    const setFlows = vi.fn()
    const setRounds = vi.fn()
    const hook = await renderHook(() => useInitialLoad(setFlows, setRounds))
    await flush()
    expect(setFlows).not.toHaveBeenCalled()
    expect(setRounds).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledWith("Failed to load flows:", expect.anything())
    expect(console.error).toHaveBeenCalledWith("Failed to load rounds:", expect.anything())
    expect(hook.result.current).toBe(true)
  })

  it("reads flows from the durable backend and migrates the legacy localStorage copy out", async () => {
    const stored: Record<string, string> = { flows: JSON.stringify([makeFlow(7)]) }
    const backend = {
      getMany: vi.fn(async (keys: readonly string[]) => Object.fromEntries(keys.map((k) => [k, stored[k] ?? null]))),
      set: vi.fn(async (k: string, v: string) => {
        stored[k] = v
      }),
      remove: vi.fn(async () => {}),
    }
    configureBulkStorage({ primary: backend })
    localStorage.setItem("rounds", JSON.stringify([makeRound(3)]))
    const setFlows = vi.fn()
    const setRounds = vi.fn()
    const hook = await renderHook(() => useInitialLoad(setFlows, setRounds))
    await flush(5)
    expect(hook.result.current).toBe(true)
    expect(setFlows).toHaveBeenCalledWith([expect.objectContaining({ id: 7 })])
    expect(setRounds).toHaveBeenCalledWith([expect.objectContaining({ id: 3 })])
    // The legacy rounds copy was back-filled into the backend, then dropped.
    expect(JSON.parse(stored.rounds)[0].id).toBe(3)
    expect(localStorage.getItem("rounds")).toBeNull()
  })

  it("does not set state when unmounted before hydration finishes", async () => {
    let release!: (value: Record<string, string | null>) => void
    const backend = {
      getMany: vi.fn(
        () =>
          new Promise<Record<string, string | null>>((resolve) => {
            release = resolve
          }),
      ),
      set: vi.fn(async () => {}),
      remove: vi.fn(async () => {}),
    }
    configureBulkStorage({ primary: backend })
    const setFlows = vi.fn()
    const hook = await renderHook(() => useInitialLoad(setFlows, vi.fn()))
    expect(hook.result.current).toBe(false)
    expect(backend.getMany).toHaveBeenCalledTimes(1)
    hook.unmount()
    await run(() => release({ flows: JSON.stringify([makeFlow(1)]) }))
    await flush()
    expect(setFlows).not.toHaveBeenCalled()
  })
})

describe("useFontSizeSettings", () => {
  it("applies the font size option as --font-size and follows later changes", async () => {
    await renderHook(() => useFontSizeSettings())
    expect(document.documentElement.style.getPropertyValue("--font-size")).toBe("14px")
    await run(() => settings.setValue("fontSize", 4))
    expect(document.documentElement.style.getPropertyValue("--font-size")).toBe("16px")
  })
})

describe("useFlowPersistence", () => {
  it("writes flows to the bulk store (localStorage with no durable backend), and skips an empty list", async () => {
    const hook = await renderHook((flows: Flow[]) => useFlowPersistence(flows), [] as Flow[])
    expect(localStorage.getItem("flows")).toBeNull()
    expect(getBulkItem("flows")).toBeNull()
    await hook.rerender([makeFlow(1)])
    expect(JSON.parse(localStorage.getItem("flows")!)[0].id).toBe(1)
    expect(JSON.parse(getBulkItem("flows")!)[0].id).toBe(1)
  })

  it("keeps every flow, archived ones included — there is no trim", async () => {
    const flows = [makeFlow(100), ...Array.from({ length: 12 }, (_, i) => makeFlow(i + 1, { archived: true }))]
    await renderHook(() => useFlowPersistence(flows))
    const saved = JSON.parse(getBulkItem("flows")!) as Flow[]
    expect(saved).toHaveLength(13)
    expect(saved.map((f) => f.id)).toEqual(flows.map((f) => f.id))
  })

  it("never alerts on a full localStorage: the flows stay in memory for this visit", async () => {
    const alertSpy = vi.fn()
    vi.stubGlobal("alert", alertSpy)
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw quotaError()
    })
    await renderHook(() => useFlowPersistence([makeFlow(1), makeFlow(2, { archived: true })]))
    expect(alertSpy).not.toHaveBeenCalled()
    expect(localStorage.getItem("flows")).toBeNull()
    expect(JSON.parse(getBulkItem("flows")!).map((f: Flow) => f.id)).toEqual([1, 2])
  })

  it("writes through to a durable backend and drops the legacy copy once it lands", async () => {
    localStorage.setItem("flows", "old")
    const backend = {
      getMany: vi.fn(async () => ({})),
      set: vi.fn(async () => {}),
      remove: vi.fn(async () => {}),
    }
    configureBulkStorage({ primary: backend })
    const hook = await renderHook((flows: Flow[]) => useFlowPersistence(flows), [makeFlow(5)])
    await flush()
    expect(backend.set).toHaveBeenCalledWith("flows", expect.stringContaining('"id":5'))
    expect(localStorage.getItem("flows")).toBeNull()
    expect(JSON.parse(getBulkItem("flows")!)[0].id).toBe(5)

    await hook.rerender([makeFlow(5), makeFlow(6)])
    expect(backend.set).toHaveBeenCalledTimes(2)
    expect(JSON.parse(getBulkItem("flows")!).map((f: Flow) => f.id)).toEqual([5, 6])
  })
})

describe("useArgumentTreeAutoSync", () => {
  it("debounces the tree sync for the selected flow and resets on change", async () => {
    vi.useFakeTimers()
    const a = makeFlow(1)
    const b = makeFlow(2)
    const hook = await renderHook(({ flows, sel }: { flows: Flow[]; sel: number }) => useArgumentTreeAutoSync(flows, sel), {
      flows: [a, b],
      sel: 0,
    })
    vi.advanceTimersByTime(1000)
    await hook.rerender({ flows: [a, b], sel: 1 })
    vi.advanceTimersByTime(1499)
    expect(argumentTrees.buildAndSaveArgumentTreeIfChanged).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(argumentTrees.buildAndSaveArgumentTreeIfChanged).toHaveBeenCalledWith(b, "2")
    expect(argumentTrees.buildAndSaveArgumentTreeIfChanged).toHaveBeenCalledTimes(1)

    await hook.rerender({ flows: [], sel: 0 })
    vi.advanceTimersByTime(5000)
    expect(argumentTrees.buildAndSaveArgumentTreeIfChanged).toHaveBeenCalledTimes(1)
  })
})

describe("useTimerState", () => {
  it("initialises speech and prep timers from the current debate style", async () => {
    const hook = await renderHook(() => useTimerState())
    const s = hook.result.current
    expect(s.speechState.state).toEqual({ name: "paused" })
    expect(s.speechState.time).toBe(s.debateStyle.timerSpeeches[0].time * 60_000)
    if (s.debateStyle.prepTime) {
      expect(s.prepState?.time).toBe(s.debateStyle.prepTime * 60_000)
      expect(s.prepSecondaryState?.time).toBe(s.debateStyle.prepTime * 60_000)
    }
    expect(s.activeTimer).toBeNull()
  })

  it("gives per-speech defaults by (case-insensitive) name and stores per-speech updates", async () => {
    const hook = await renderHook(() => useTimerState())
    const style = hook.result.current.debateStyle
    const second = style.timerSpeeches[1]
    expect(hook.result.current.getSpeechTimerState(second.name.toLowerCase()).time).toBe(second.time * 60_000)
    // Unknown speech names fall back to the first speech's length.
    expect(hook.result.current.getSpeechTimerState("nope").time).toBe(style.timerSpeeches[0].time * 60_000)

    await run(() => hook.result.current.setSpeechTimerState(second.name, { time: 42 }))
    expect(hook.result.current.perSpeechTimerStates[second.name]).toEqual({
      time: 42,
      resetTime: second.time * 60_000,
      state: { name: "paused" },
    })
    expect(hook.result.current.getSpeechTimerState(second.name).time).toBe(42)
  })

  it("reports the running speech, then a running prep timer, as the active timer", async () => {
    const hook = await renderHook(() => useTimerState())
    const first = hook.result.current.debateStyle.timerSpeeches[0]
    await run(() =>
      hook.result.current.setSpeechState({ resetTimeIndex: 0, time: 1, state: { name: "running", startTime: 500 } }),
    )
    expect(hook.result.current.activeTimer).toEqual({ label: first.name, totalTime: first.time * 60_000, startTime: 500 })

    await run(() => hook.result.current.setSpeechState({ resetTimeIndex: 0, time: 1, state: { name: "paused" } }))
    await run(() => hook.result.current.setPrepState({ time: 1, resetTime: 90_000, state: { name: "running", startTime: 7 } }))
    expect(hook.result.current.activeTimer).toEqual({ label: "Prep", totalTime: 90_000, startTime: 7 })

    await run(() => hook.result.current.setPrepState({ time: 1, resetTime: 90_000, state: { name: "paused" } }))
    await run(() =>
      hook.result.current.setPrepSecondaryState({ time: 1, resetTime: 60_000, state: { name: "running", startTime: 9 } }),
    )
    expect(hook.result.current.activeTimer).toEqual({ label: "Prep", totalTime: 60_000, startTime: 9 })
  })

  it("resets every timer when the debate style changes", async () => {
    const hook = await renderHook(() => useTimerState())
    const before = hook.result.current.debateStyle
    await run(() => hook.result.current.setSpeechTimerState("X", { time: 1 }))
    const options = (settings.data.debateStyle as unknown as { detail: { options: string[] } }).detail.options
    let other = 1
    for (let i = 1; i < options.length; i++) {
      settings.setValue("debateStyle", i)
      await flush(1)
      if (hook.result.current.debateStyle !== before) {
        other = i
        break
      }
    }
    expect(hook.result.current.debateStyle).not.toBe(before)
    expect(hook.result.current.perSpeechTimerStates).toEqual({})
    const style = hook.result.current.debateStyle
    expect(hook.result.current.speechState.time).toBe(style.timerSpeeches[0].time * 60_000)
    expect(hook.result.current.prepState === null).toBe(!style.prepTime)
    expect(other).toBeGreaterThan(0)

    // Walk every style so both the with-prep and no-prep branches run.
    for (let i = 0; i < options.length; i++) {
      await run(() => settings.setValue("debateStyle", i))
      const s = hook.result.current.debateStyle
      expect(hook.result.current.prepState === null).toBe(!s.prepTime)
    }
  })
})

describe("useSplitModeHandlers", () => {
  it("steps the pair and single views within the flow's columns and writes each side's doc", async () => {
    const updateFlow = vi.fn()
    const flows = [makeFlow(1, { speechDocs: { "1AC": "old" } })]
    const hook = await renderHook(() => useSplitModeHandlers(flows, 0, updateFlow))
    const h = () => hook.result.current
    expect([h().getLeftSpeech(), h().getRightSpeech()]).toEqual(["1AC", "1NC"])
    expect(h().canNavigatePrev).toBe(false)
    expect(h().canNavigateNext).toBe(true)

    await run(() => h().handlePreviousSpeeches())
    expect(h().leftSpeechIndex).toBe(0)

    await run(() => h().handleNextSpeeches())
    await run(() => h().handleNextSpeeches())
    expect([h().getLeftSpeech(), h().getRightSpeech()]).toEqual(["2AC", "2NC"])
    expect(h().canNavigateNext).toBe(false)
    await run(() => h().handleNextSpeeches())
    expect(h().rightSpeechIndex).toBe(3)

    await run(() => h().handlePreviousSpeeches())
    expect(h().leftSpeechIndex).toBe(1)

    await run(() => h().handleNextSingle())
    await run(() => h().handleNextSingle())
    expect(h().leftSpeechIndex).toBe(3)
    expect(h().canNavigateNextSingle).toBe(false)
    await run(() => h().handleNextSingle())
    expect(h().leftSpeechIndex).toBe(3)
    await run(() => h().handlePreviousSingle())
    expect(h().leftSpeechIndex).toBe(2)

    await run(() => h().handleUpdateLeftSpeech("left text"))
    expect(updateFlow).toHaveBeenLastCalledWith(0, { speechDocs: { "1AC": "old", "2AC": "left text" } })
    await run(() => h().handleUpdateRightSpeech("right text"))
    expect(updateFlow).toHaveBeenLastCalledWith(0, { speechDocs: { "1AC": "old", "2AC": "right text" } })
  })

  it("is inert with no selected flow", async () => {
    const updateFlow = vi.fn()
    const hook = await renderHook(() => useSplitModeHandlers([], 0, updateFlow))
    const h = () => hook.result.current
    await run(() => h().handleNextSpeeches())
    await run(() => h().handleNextSingle())
    await run(() => h().handlePreviousSingle())
    await run(() => h().handleUpdateLeftSpeech("x"))
    await run(() => h().handleUpdateRightSpeech("x"))
    expect(updateFlow).not.toHaveBeenCalled()
    expect(h().getLeftSpeech()).toBe("")
    expect(h().getRightSpeech()).toBe("")
    expect(h().canNavigateNext).toBe(false)
    expect(h().canNavigateNextSingle).toBe(false)
  })
})

describe("useSpeechHandlers", () => {
  it("shareSpeech resolves after a simulated delay with a participant count", async () => {
    vi.useFakeTimers()
    const p = shareSpeech(["a", "b"], "1AC", "x")
    vi.advanceTimersByTime(500)
    await expect(p).resolves.toEqual({ success: true, message: "Shared with 2 participants" })
  })

  it("updates the selected speech doc", async () => {
    const updateFlow = vi.fn()
    const hook = await renderHook(() => useSpeechHandlers([makeFlow(1, { speechDocs: { "1NC": "n" } })], 0, "1AC", updateFlow))
    await run(() => hook.result.current.handleUpdateSpeechDoc("hello"))
    expect(updateFlow).toHaveBeenCalledWith(0, { speechDocs: { "1NC": "n", "1AC": "hello" } })
  })

  it("shares a non-empty speech with the flow's round participants and records the share", async () => {
    vi.useFakeTimers({ now: 123_000 })
    const updateFlow = vi.fn()
    const flow = makeFlow(1, { roundId: 9, speechDocs: { "1AC": "content" } })
    const hook = await renderHook(() => useSpeechHandlers([flow], 0, "1AC", updateFlow, [makeRound(9)]))
    let done = false
    await run(() => {
      void hook.result.current.handleShareSpeech().then(() => (done = true))
    })
    await run(() => vi.advanceTimersByTimeAsync(500))
    expect(done).toBe(true)
    const shared = updateFlow.mock.calls[0][1].sharedSpeeches["1AC"]
    expect(shared.timestamp).toBe(123_500)
    expect(shared.emails).toEqual(expect.arrayContaining(["a@x.com", "c@x.com", "j@x.com"]))
  })

  it("unshares an already-shared speech, and refuses to share an empty one", async () => {
    const alertSpy = vi.fn()
    vi.stubGlobal("alert", alertSpy)
    const updateFlow = vi.fn()
    const shared = makeFlow(1, { speechDocs: { "1AC": "x" }, sharedSpeeches: { "1AC": { timestamp: 1, emails: [] }, "1NC": { timestamp: 2, emails: [] } } })
    const hook = await renderHook(() => useSpeechHandlers([shared], 0, "1AC", updateFlow))
    await run(() => hook.result.current.handleShareSpeech())
    expect(updateFlow).toHaveBeenCalledWith(0, { sharedSpeeches: { "1NC": { timestamp: 2, emails: [] } } })

    const empty = await renderHook(() => useSpeechHandlers([makeFlow(2, { speechDocs: { "1AC": "  " } })], 0, "1AC", updateFlow))
    await run(() => empty.result.current.handleShareSpeech())
    expect(alertSpy).toHaveBeenCalledWith("Cannot share empty speech document")
    expect(updateFlow).toHaveBeenCalledTimes(1)

    const none = await renderHook(() => useSpeechHandlers([], 0, "1AC", updateFlow))
    await run(() => none.result.current.handleShareSpeech())
    await run(() => none.result.current.handleUpdateSpeechDoc("x"))
    expect(updateFlow).toHaveBeenCalledTimes(1)
  })
})

describe("useFlowHandlers", () => {
  it("adds a flow in the current style, selects it and persists the list", async () => {
    const setFlows = vi.fn()
    const setSelected = vi.fn()
    const existing = [makeFlow(0)]
    const hook = await renderHook(() => useFlowHandlers(existing, setFlows, setSelected))
    await run(() => hook.result.current.addFlow())
    const next = setFlows.mock.calls[0][0] as Flow[]
    expect(next).toHaveLength(2)
    expect(setSelected).toHaveBeenCalledWith(next[1].id)
    expect(JSON.parse(localStorage.getItem("flows")!)).toHaveLength(2)
  })

  it("deletes a flow, selecting the next one (or the previous when deleting the last)", async () => {
    const setFlows = vi.fn()
    const setSelected = vi.fn()
    const flows = [makeFlow(1), makeFlow(2), makeFlow(3)]
    const hook = await renderHook(() => useFlowHandlers(flows, setFlows, setSelected))
    await run(() => hook.result.current.deleteFlow(2))
    expect(setSelected).toHaveBeenLastCalledWith(3)
    expect((setFlows.mock.calls[0][0] as Flow[]).map((f) => f.id)).toEqual([1, 3])
    await run(() => hook.result.current.deleteFlow(3))
    expect(setSelected).toHaveBeenLastCalledWith(2)
    await run(() => hook.result.current.deleteFlow(404))
    expect(setFlows).toHaveBeenCalledTimes(2)

    const single = await renderHook(() => useFlowHandlers([makeFlow(7)], setFlows, setSelected))
    setSelected.mockClear()
    await run(() => single.result.current.deleteFlow(7))
    expect(setSelected).not.toHaveBeenCalled()
    expect(setFlows).toHaveBeenLastCalledWith([])
  })

  it("selectSpeech sets the speech and opens the panel", async () => {
    const hook = await renderHook(() => useFlowHandlers([], vi.fn(), vi.fn()))
    const open = vi.fn()
    const pick = vi.fn()
    await run(() => hook.result.current.selectSpeech("2NR", open, pick))
    expect(pick).toHaveBeenCalledWith("2NR")
    expect(open).toHaveBeenCalledWith(true)
  })
})

describe("useRoundFromSlug", () => {
  it("activates the round matching /debate/<tournament>/<teams>, archiving the rest", async () => {
    useFlowStore.setState({
      flows: [makeFlow(1, { archived: true }), makeFlow(2)],
      rounds: [makeRound(9, { slug: "toc/a-b", flowIds: [1] })],
    })
    nav.pathname = "/debate/toc/a-b"
    await renderHook(() => useRoundFromSlug())
    expect(useFlowStore.getState().flows.map((f) => f.archived)).toEqual([false, true])
  })

  it("ignores non-round paths, unknown slugs, already-active rounds and rounds with no local flows", async () => {
    const flows = [makeFlow(1), makeFlow(2)]
    useFlowStore.setState({
      flows,
      rounds: [makeRound(9, { slug: "toc/active", flowIds: [1] }), makeRound(10, { slug: "toc/empty", flowIds: [99] })],
    })
    for (const p of ["/flow", "/debate/toc/unknown", "/debate/toc/active", "/debate/toc/empty"]) {
      nav.pathname = p
      await renderHook(() => useRoundFromSlug())
      expect(useFlowStore.getState().flows).toBe(flows)
      cleanup()
    }
  })
})

describe("useSyncUrlWithRound", () => {
  it("replaces the URL with the active round's slug once", async () => {
    useFlowStore.setState({ flows: [makeFlow(1, { roundId: 9 })], rounds: [makeRound(9, { slug: "toc/a-b" })] })
    const hook = await renderHook(() => useSyncUrlWithRound())
    expect(nav.replace).toHaveBeenCalledWith("/debate/toc/a-b")
    await hook.rerender(undefined)
    expect(nav.replace).toHaveBeenCalledTimes(1)
  })

  it("does nothing without an active round slug, or when already on its URL", async () => {
    useFlowStore.setState({ flows: [makeFlow(1)], rounds: [] })
    await renderHook(() => useSyncUrlWithRound())
    cleanup()
    useFlowStore.setState({ flows: [makeFlow(1, { roundId: 9 })], rounds: [makeRound(9)] })
    await renderHook(() => useSyncUrlWithRound())
    cleanup()
    nav.pathname = "/debate/toc/a-b"
    useFlowStore.setState({ flows: [makeFlow(1, { roundId: 9 })], rounds: [makeRound(9, { slug: "toc/a-b" })] })
    await renderHook(() => useSyncUrlWithRound())
    expect(nav.replace).not.toHaveBeenCalled()
  })
})

describe("useJumpToPrepNoteBox", () => {
  it("selects the deep-linked flow tab by id, once", async () => {
    useFlowStore.setState({ flows: [makeFlow(5), makeFlow(6)], selected: 0 })
    nav.search = new URLSearchParams("flowId=6&boxPath=0,1")
    await renderHook(() => useJumpToPrepNoteBox())
    expect(useFlowStore.getState().selected).toBe(1)
  })

  it("ignores missing params and unknown flows", async () => {
    useFlowStore.setState({ flows: [makeFlow(5)], selected: 0 })
    nav.search = new URLSearchParams("flowId=404&boxPath=0")
    await renderHook(() => useJumpToPrepNoteBox())
    cleanup()
    nav.search = new URLSearchParams("")
    await renderHook(() => useJumpToPrepNoteBox())
    expect(useFlowStore.getState().selected).toBe(0)
  })
})

describe("useOpenRoundFromLink", () => {
  it("brings the linked round's flows to the front and selects the first, once", async () => {
    useFlowStore.setState({
      flows: [makeFlow(1), makeFlow(2), makeFlow(3)],
      rounds: [makeRound(9, { flowIds: [2, 3] })],
      selected: 0,
    })
    nav.search = new URLSearchParams("roundId=9")
    await renderHook(() => useOpenRoundFromLink())
    const state = useFlowStore.getState()
    expect(state.selected).toBe(1)
    expect(state.flows.map((f) => f.archived)).toEqual([true, false, false])
  })

  it("ignores missing params, malformed ids, unknown rounds and rounds without flows", async () => {
    useFlowStore.setState({ flows: [makeFlow(1)], rounds: [makeRound(9, { flowIds: [77] })], selected: 0 })
    for (const query of ["", "roundId=abc", "roundId=1.5", "roundId=404", "roundId=9"]) {
      nav.search = new URLSearchParams(query)
      await renderHook(() => useOpenRoundFromLink())
      cleanup()
    }
    const state = useFlowStore.getState()
    expect(state.selected).toBe(0)
    expect(state.flows[0].archived).not.toBe(true)
  })
})

describe("useMobileDetection", () => {
  it("reports < 768px as mobile on mount and on resize", async () => {
    const set = vi.fn()
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 500 })
    await renderHook(() => useMobileDetection(set))
    expect(set).toHaveBeenLastCalledWith(true)
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1200 })
    await run(() => window.dispatchEvent(new Event("resize")))
    expect(set).toHaveBeenLastCalledWith(false)
  })
})

describe("useSpeechRecordingStatus", () => {
  it("reads a saved recording's duration, refreshes on save events, and deletes it", async () => {
    localStorage.setItem("debate-recording-1AC", JSON.stringify({ durationSeconds: 42 }))
    const hook = await renderHook((name: string) => useSpeechRecordingStatus(name), "1AC" as string)
    expect(hook.result.current).toMatchObject({ hasRecording: true, recordingDurationSec: 42 })

    await hook.rerender("1NC")
    expect(hook.result.current).toMatchObject({ hasRecording: false, recordingDurationSec: null })

    localStorage.setItem("debate-recording-1NC", "not json")
    await run(() => window.dispatchEvent(new CustomEvent("debate-recording-saved")))
    expect(hook.result.current).toMatchObject({ hasRecording: true, recordingDurationSec: null })

    localStorage.setItem("debate-recording-1NC", JSON.stringify({}))
    await run(() => window.dispatchEvent(new CustomEvent("debate-recording-saved")))
    expect(hook.result.current.recordingDurationSec).toBeNull()

    await run(() => hook.result.current.deleteRecording("debate-recording-1NC"))
    expect(localStorage.getItem("debate-recording-1NC")).toBeNull()
    expect(hook.result.current.hasRecording).toBe(false)

    localStorage.setItem("other-key", "x")
    await run(() => hook.result.current.deleteRecording("other-key"))
    expect(localStorage.getItem("other-key")).toBeNull()
  })
})

describe("useDebateFlowState", () => {
  it("starts in split/single-pane mode with closed dialogs and exposes setters", async () => {
    const hook = await renderHook(() => useDebateFlowState())
    const s = hook.result.current
    expect(s.splitMode).toBe(true)
    expect(s.singlePaneMode).toBe(true)
    expect(s.historyDialogOpen).toBe(false)
    expect(s.splitWidth).toBe(50)
    await run(() => hook.result.current.setSplitWidth(70))
    expect(hook.result.current.splitWidth).toBe(70)
  })
})
