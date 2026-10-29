// @vitest-environment jsdom
/**
 * @fileoverview Integration test for `DebateFlowPage` (panels/DebateRoundPanel)
 * — the page that wires the flow store, the timer state and every handler
 * into its layout children.
 *
 * The heavy layout children (sidebar, Debate Editor split view, ebb, dialogs,
 * resizable panels) are replaced by stubs that record the props they were
 * given, so each test drives a real handler through a child's callback prop
 * and asserts what reached the real `useFlowStore` / the next render's props.
 * The page's own hooks run for real; only the webcam room transport and the
 * featured-round doc fetch are mocked.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const cap = vi.hoisted(() => ({ props: {} as Record<string, any>, renders: {} as Record<string, number> }))

vi.mock("next/navigation", () => ({
  usePathname: () => (globalThis as { __pathname?: string }).__pathname ?? "/flow",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

function stub(name: string, renderChildren = false) {
  return (props: Record<string, unknown>) => {
    cap.props[name] = props
    cap.renders[name] = (cap.renders[name] ?? 0) + 1
    return renderChildren ? (props.children as never) ?? null : null
  }
}

vi.mock("@debate-ai/flow-ebb", () => ({ EbbFlowEmbed: stub("EbbFlowEmbed") }))
vi.mock("../src/layout/FlowPageSidebar", () => ({ FlowPageSidebar: stub("FlowPageSidebar") }))
vi.mock("../src/layout/FlowMainContent", () => ({ FlowMainContent: stub("FlowMainContent") }))
vi.mock("../src/layout/SpeechDocPanel", () => ({ SpeechDocPanel: stub("SpeechDocPanel") }))
vi.mock("../src/layout/SpeechControlsTopBar", () => ({
  SpeechControlsTopBar: stub("SpeechControlsTopBar"),
  SpeechViewControls: stub("SpeechViewControls"),
}))
vi.mock("../src/panels/DebateStartPanel", () => ({ DebateStartPanel: stub("DebateStartPanel") }))
vi.mock("../src/dialogs/FlowHistoryDialog", () => ({ FlowHistoryDialog: stub("FlowHistoryDialog") }))
vi.mock("../src/dialogs/CreateRoundDialog", () => ({ RoundEditorDialog: stub("RoundEditorDialog") }))
vi.mock("../src/ui/primitives/resizable", () => ({
  ResizablePanelGroup: stub("ResizablePanelGroup", true),
  ResizablePanel: stub("ResizablePanel", true),
  ResizableHandle: stub("ResizableHandle"),
}))
vi.mock("../src/ui/primitives/sheet", () => ({
  Sheet: stub("Sheet", true),
  SheetContent: stub("SheetContent", true),
}))

const room = vi.hoisted(() => ({ broadcast: vi.fn(), join: vi.fn() }))
vi.mock("../src/webcam/useWebcamRoom", () => ({
  useWebcamRoom: () => ({ join: room.join, broadcast: room.broadcast, status: "joined", participants: [], self: null }),
}))

const featured = vi.hoisted(() => ({ loadFeaturedSpeechDocs: vi.fn() }))
vi.mock("../src/round/featured-rounds", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/round/featured-rounds")>()
  return { ...actual, loadFeaturedSpeechDocs: featured.loadFeaturedSpeechDocs }
})

vi.mock("../src/state/argumentTrees", () => ({ buildAndSaveArgumentTreeIfChanged: vi.fn() }))

import { DebateFlowPage } from "../src/panels/DebateRoundPanel"
import { useFlowStore } from "../src/state/store"
import { settings } from "../src/state/settings"
import { FEATURED_ROUNDS } from "../src/round/featured-rounds"
import type { Flow, Round } from "../src/types/flow"
import { resetBulkStorageForTests } from "@debate-ai/research-evidence/src/account-sync/bulk-storage"
import { cleanup, mount, run, flush } from "./dom-helpers"

const NOW = 1_760_000_000_000

function makeFlow(id: number, extra: Partial<Flow> = {}): Flow {
  return {
    content: `Flow ${id}`,
    level: 0,
    columns: ["1AC", "1NC", "2AC", "2NC"],
    invert: false,
    focus: false,
    index: 0,
    lastFocus: [],
    children: [],
    id,
    ...extra,
  }
}

function makeRound(id: number, extra: Partial<Round> = {}): Round {
  return {
    id,
    tournamentName: "Glenbrooks",
    roundLevel: "Octas",
    debaters: { aff: ["Ann Lee", "Bo Park"], neg: ["Cy Diaz", ""] },
    schools: { aff: ["Lynbrook", "Lynbrook"], neg: ["Monta Vista", ""] },
    judges: ["judge@x.com"],
    flowIds: [],
    timestamp: NOW,
    status: "completed",
    ...extra,
  }
}

/** Seeds both localStorage (read by `useInitialLoad`/`getRounds`) and the store. */
function seed(flows: Flow[], rounds: Round[] = [], selected = 0) {
  localStorage.setItem("flows", JSON.stringify(flows))
  localStorage.setItem("rounds", JSON.stringify(rounds))
  useFlowStore.setState({ flows, rounds, selected })
}

async function renderPage(props: Parameters<typeof DebateFlowPage>[0] = {}) {
  await mount(<DebateFlowPage {...props} />)
  await flush()
}

const P = () => cap.props

beforeEach(() => {
  cap.props = {}
  cap.renders = {}
  localStorage.clear()
  resetBulkStorageForTests()
  ;(globalThis as { __pathname?: string }).__pathname = "/flow"
  useFlowStore.setState({ flows: [], rounds: [], selected: 0 })
  settings.setValue("debateStyle", 0)
  room.broadcast.mockReset()
  featured.loadFeaturedSpeechDocs.mockReset()
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 })
  vi.spyOn(console, "log").mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe("DebateFlowPage — start screen", () => {
  it("shows the start screen with stored rounds, history and the featured catalog when no flow is open", async () => {
    localStorage.setItem("rounds", JSON.stringify([makeRound(3)]))
    await renderPage({ startScreenActions: "badge" })
    const start = P().DebateStartPanel
    expect(start).toBeDefined()
    expect(start.rounds.map((r: Round) => r.id)).toEqual([3])
    expect(start.featuredRounds).toBe(FEATURED_ROUNDS)
    expect(start.headerActions).toBe("badge")
    expect(start.pinnedIds).toEqual([])
    expect(P().FlowMainContent).toBeUndefined()
    expect(document.title).toBe("Debate AI")
    expect(P().SpeechControlsTopBar.showRecordingMenu).toBe(true)
  })

  it("creates a flow in the current debate style from the start screen and persists it", async () => {
    await renderPage()
    await run(() => P().DebateStartPanel.onCreateFlow())
    const { flows } = useFlowStore.getState()
    expect(flows).toHaveLength(1)
    expect(flows[0].columns.length).toBeGreaterThan(0)
    expect(JSON.parse(localStorage.getItem("flows")!).map((f: Flow) => f.id)).toEqual([flows[0].id])
  })

  it("pins and unpins a round from the start screen", async () => {
    await renderPage()
    await run(() => P().DebateStartPanel.onTogglePin(7))
    expect(P().DebateStartPanel.pinnedIds).toEqual([7])
    await run(() => P().DebateStartPanel.onTogglePin(7))
    expect(P().DebateStartPanel.pinnedIds).toEqual([])
  })

  it("opens a round by archiving the other flows and selecting its first flow; ignores rounds with no flows", async () => {
    const flows = [makeFlow(1, { archived: true }), makeFlow(2, { archived: true }), makeFlow(3, { archived: true })]
    seed(flows)
    useFlowStore.setState({ selected: 99 })
    await renderPage()
    expect(P().DebateStartPanel).toBeDefined()
    await run(() => P().DebateStartPanel.onOpenRound(makeRound(5, { flowIds: [404] })))
    expect(useFlowStore.getState().selected).toBe(99)
    await run(() => P().DebateStartPanel.onOpenRound(makeRound(5, { flowIds: [2, 3] })))
    expect(useFlowStore.getState().flows.map((f) => f.archived)).toEqual([true, false, false])
    expect(useFlowStore.getState().selected).toBe(1)
  })

  it("restores a recent flow from history, and refreshes the list when the entry is gone", async () => {
    localStorage.setItem(
      "flow-history",
      JSON.stringify([{ id: "h1", label: "Old", timestamp: NOW, flow: makeFlow(8, { content: "Old" }) }]),
    )
    await renderPage()
    expect(P().DebateStartPanel.history.map((h: { id: string }) => h.id)).toEqual(["h1"])

    localStorage.removeItem("flow-history")
    await run(() => P().DebateStartPanel.onOpenHistoryEntry("h1"))
    expect(P().DebateStartPanel.history).toEqual([])

    localStorage.setItem(
      "flow-history",
      JSON.stringify([{ id: "h2", label: "Again", timestamp: NOW, flow: makeFlow(9, { content: "Again" }) }]),
    )
    await run(() => P().DebateStartPanel.onOpenHistoryEntry("h2"))
    expect(useFlowStore.getState().flows).toHaveLength(1)
    expect(P().FlowMainContent.currentFlow.content).toBe("Again")
  })

  it("opens a featured round: builds a local round + flow from the fetched docs and reports missing speeches", async () => {
    const f = FEATURED_ROUNDS[0]
    featured.loadFeaturedSpeechDocs.mockResolvedValue({ docs: { "1AC": "<p>1AC</p>" }, missing: ["1NC", "2AC"] })
    seed([makeFlow(1)], [], 5)
    useFlowStore.setState({ flows: [], selected: 0 })
    localStorage.removeItem("flows")
    await renderPage()
    await run(() => P().DebateStartPanel.onOpenFeatured(f))
    await flush()
    const { flows, rounds, selected } = useFlowStore.getState()
    expect(flows).toHaveLength(1)
    expect(flows[0].speechDocs).toEqual({ "1AC": "<p>1AC</p>" })
    expect(rounds).toHaveLength(1)
    expect(rounds[0].slug).toBe(f.slug)
    expect(flows[0].roundId).toBe(rounds[0].id)
    expect(selected).toBe(0)
    expect(settings.data.debateStyle.value).toBeGreaterThan(0)
  })

  it("reports a featured round that fails to load, and reopens an already-built one without refetching", async () => {
    const f = FEATURED_ROUNDS[0]
    featured.loadFeaturedSpeechDocs.mockRejectedValueOnce(new Error("None of the docs could be loaded."))
    await renderPage()
    await run(() => P().DebateStartPanel.onOpenFeatured(f))
    await flush()
    expect(P().DebateStartPanel.featuredError).toBe("None of the docs could be loaded.")
    expect(P().DebateStartPanel.loadingFeaturedKey).toBeNull()

    featured.loadFeaturedSpeechDocs.mockRejectedValueOnce("plain string")
    await run(() => P().DebateStartPanel.onOpenFeatured(f))
    await flush()
    expect(P().DebateStartPanel.featuredError).toBe("plain string")

    // A local round already built from this featured round is simply reopened.
    const built = makeRound(50, { slug: f.slug, flowIds: [60] })
    localStorage.setItem("rounds", JSON.stringify([built]))
    // selected points past the flows, so the start screen (and its handler) stays mounted.
    await run(() => useFlowStore.setState({ flows: [makeFlow(60, { archived: true })], rounds: [built], selected: 5 }))
    featured.loadFeaturedSpeechDocs.mockClear()
    await run(() => P().DebateStartPanel?.onOpenFeatured(f))
    expect(featured.loadFeaturedSpeechDocs).not.toHaveBeenCalled()
    expect(useFlowStore.getState().flows[0].archived).toBe(false)
    expect(useFlowStore.getState().selected).toBe(0)
  })

  it("ignores a second featured open while one is still loading", async () => {
    const f = FEATURED_ROUNDS[0]
    let resolve!: (v: unknown) => void
    featured.loadFeaturedSpeechDocs.mockImplementation(() => new Promise((r) => (resolve = r)))
    await renderPage()
    await run(() => {
      void P().DebateStartPanel.onOpenFeatured(f)
    })
    expect(P().DebateStartPanel.loadingFeaturedKey).toBe(f.key)
    await run(() => {
      void P().DebateStartPanel.onOpenFeatured(f)
    })
    expect(featured.loadFeaturedSpeechDocs).toHaveBeenCalledTimes(1)
    await run(() => resolve({ docs: { "1AC": "x" }, missing: [] }))
    await flush()
    expect(P().DebateStartPanel?.featuredError ?? null).toBeNull()
    expect(useFlowStore.getState().flows).toHaveLength(1)
  })

  it("builds a shared /debate/<featured slug> link's round on first visit", async () => {
    const f = FEATURED_ROUNDS[0]
    ;(globalThis as { __pathname?: string }).__pathname = `/debate/${f.slug}`
    featured.loadFeaturedSpeechDocs.mockResolvedValue({ docs: { "1AC": "x" }, missing: [] })
    await renderPage()
    await flush()
    expect(featured.loadFeaturedSpeechDocs).toHaveBeenCalledWith(f)
    expect(useFlowStore.getState().rounds[0]?.slug).toBe(f.slug)
  })

  it("start screen's create-round and history shortcuts open the dialogs", async () => {
    await renderPage()
    await run(() => P().DebateStartPanel.onCreateRound())
    expect(P().RoundEditorDialog.open).toBe(true)
    expect(P().RoundEditorDialog.roundId).toBeUndefined()
    await run(() => P().DebateStartPanel.onOpenHistory())
    expect(P().FlowHistoryDialog.open).toBe(true)
  })
})

describe("DebateFlowPage — flow view", () => {
  it("passes the current flow, its split speeches and its round down to the layout", async () => {
    const round = makeRound(9, { status: "active", title: "Glenbrooks octas", flowIds: [1] })
    seed([makeFlow(1, { roundId: 9, speechDocs: { "1AC": "a", "1NC": "n" } })], [round])
    await renderPage()
    const main = P().FlowMainContent
    expect(main.leftSpeech).toBe("1AC")
    expect(main.rightSpeech).toBe("1NC")
    expect(main.leftContent).toBe("a")
    expect(main.rightContent).toBe("n")
    expect(P().FlowPageSidebar.rounds.map((r: Round) => r.id)).toEqual([9])
    expect(P().SpeechControlsTopBar.participantEmails).toEqual(
      expect.arrayContaining(["Ann Lee", "Cy Diaz", "judge@x.com"]),
    )
    // Sidebar round exists → the recording menu lives in the sidebar instead.
    expect(P().SpeechControlsTopBar.showRecordingMenu).toBe(false)
  })

  it("moves the view controls into the round sidebar and activates a speech clicked there", async () => {
    seed([makeFlow(1, { roundId: 9 })], [makeRound(9, { flowIds: [1] })])
    await renderPage()
    expect(P().SpeechControlsTopBar.showViewControls).toBe(false)
    const controls = () => P().FlowPageSidebar.speechViewControls.props
    expect(controls()).toMatchObject({ speechName: "1AC", layoutMode: "single", quoteView: false })

    await run(() => P().FlowPageSidebar.onSelectSpeech("2ac"))
    expect(P().FlowMainContent.leftSpeech).toBe("2AC")
    expect(controls().speechName).toBe("2AC")

    // An unknown speech is ignored.
    await run(() => P().FlowPageSidebar.onSelectSpeech("3AR"))
    expect(P().FlowMainContent.leftSpeech).toBe("2AC")

    // With both panes shown, clicking the last speech pairs it on the right and makes it active.
    await run(() => controls().onToggleLayoutMode())
    expect(P().SpeechControlsTopBar.layoutMode).toBe("split")
    await run(() => P().FlowPageSidebar.onSelectSpeech("2NC"))
    expect([P().FlowMainContent.leftSpeech, P().FlowMainContent.rightSpeech]).toEqual(["2AC", "2NC"])
    expect(P().FlowMainContent.activeSplitSide).toBe("right")
    expect(P().SpeechControlsTopBar.speechName).toBe("2NC")
  })

  it("keeps the view controls in the top bar when no round is open", async () => {
    seed([makeFlow(1)])
    await renderPage()
    expect(P().SpeechControlsTopBar.showViewControls).toBe(true)
    expect(P().SpeechControlsTopBar.showRecordingMenu).toBe(true)
  })

  it("renames, archives, deletes and selects flows through the sidebar", async () => {
    seed([makeFlow(1), makeFlow(2)])
    await renderPage()
    await run(() => P().FlowPageSidebar.onRenameFlow(0, "Renamed"))
    expect(useFlowStore.getState().flows[0].content).toBe("Renamed")
    await run(() => P().FlowPageSidebar.onArchiveFlow(1))
    expect(useFlowStore.getState().flows[1].archived).toBe(true)
    await run(() => P().FlowPageSidebar.onArchiveFlow(1))
    expect(useFlowStore.getState().flows[1].archived).toBe(false)
    await run(() => P().FlowPageSidebar.onSelectFlow(1))
    expect(useFlowStore.getState().selected).toBe(1)
    await run(() => P().FlowPageSidebar.onDeleteFlow(0))
    expect(useFlowStore.getState().flows.map((f) => f.id)).toEqual([2])
    await run(() => P().FlowPageSidebar.onAddFlow())
    expect(useFlowStore.getState().flows).toHaveLength(2)
  })

  it("updates the left/right speech docs from the split view", async () => {
    seed([makeFlow(1, { speechDocs: {} })])
    await renderPage()
    await run(() => P().FlowMainContent.onUpdateLeftSpeech("left"))
    await run(() => P().FlowMainContent.onUpdateRightSpeech("right"))
    expect(useFlowStore.getState().flows[0].speechDocs).toEqual({ "1AC": "left", "1NC": "right" })
  })

  it("switches to the pinned ebb tab, hands it a queued tool action, and clears it once handled", async () => {
    seed([makeFlow(1)])
    await renderPage()
    await run(() => P().FlowPageSidebar.onSelectEbb())
    expect(P().EbbFlowEmbed).toBeDefined()
    expect(P().FlowPageSidebar.ebbActive).toBe(true)

    const action = { type: "new" }
    await run(() => P().FlowPageSidebar.onEbbToolAction(action))
    expect(P().EbbFlowEmbed.pendingAction).toBe(action)
    await run(() => P().EbbFlowEmbed.onPendingActionHandled())
    expect(P().EbbFlowEmbed.pendingAction).toBeNull()

    await run(() => P().FlowPageSidebar.onSelectFlow(0))
    expect(P().FlowPageSidebar.ebbActive).toBe(false)
  })

  it("opens the history and round editor dialogs; the history dialog's callbacks route back", async () => {
    seed([makeFlow(1)])
    await renderPage()
    await run(() => P().FlowPageSidebar.onOpenHistory())
    expect(P().FlowHistoryDialog.open).toBe(true)
    await run(() => P().FlowHistoryDialog.onEditRound(12))
    expect(P().RoundEditorDialog).toMatchObject({ open: true, roundId: 12 })
    await run(() => P().FlowHistoryDialog.onCreateRound())
    expect(P().RoundEditorDialog.roundId).toBeUndefined()
    await run(() => P().FlowPageSidebar.onSelectEbb())
    await run(() => P().FlowHistoryDialog.onFlowOpened())
    expect(P().FlowPageSidebar.ebbActive).toBe(false)
  })

  it("toggles single/split layout and steps speeches pairwise in split, singly in single-pane", async () => {
    seed([makeFlow(1)])
    await renderPage()
    expect(P().SpeechControlsTopBar.layoutMode).toBe("single")
    expect(P().FlowPageSidebar.canNavigatePrev).toBe(false)
    await run(() => P().FlowPageSidebar.onNavigateNext())
    expect(P().SpeechControlsTopBar.speechName).toBe("1NC")
    expect(P().FlowMainContent.rightSpeech).toBe("1NC")
    await run(() => P().FlowPageSidebar.onNavigatePrev())
    expect(P().SpeechControlsTopBar.speechName).toBe("1AC")

    await run(() => P().SpeechControlsTopBar.onToggleLayoutMode())
    expect(P().SpeechControlsTopBar.layoutMode).toBe("split")
    await run(() => P().FlowPageSidebar.onNavigateNext())
    expect([P().FlowMainContent.leftSpeech, P().FlowMainContent.rightSpeech]).toEqual(["1NC", "2AC"])

    // In split view the right pane can become the sidebar's selected speech.
    await run(() => P().FlowMainContent.onActiveSplitSideChange("right"))
    expect(P().SpeechControlsTopBar.speechName).toBe("2AC")
    await run(() => P().SpeechControlsTopBar.onQuoteViewToggle())
    expect(P().SpeechControlsTopBar.quoteView).toBe(true)
    await run(() => P().SpeechControlsTopBar.onViewModeChange("edit"))
    expect(P().SpeechControlsTopBar.viewMode).toBe("edit")
    await run(() => P().FlowMainContent.onActiveSplitSideChange("left"))
    await run(() => P().SpeechControlsTopBar.onQuoteViewToggle())
    expect(P().SpeechControlsTopBar.quoteView).toBe(true)
    await run(() => P().FlowPageSidebar.onNavigatePrev())
    expect(P().FlowMainContent.leftSpeech).toBe("1AC")
  })

  it("opens and closes the speech panel from the top bar", async () => {
    seed([makeFlow(1)])
    await renderPage()
    await run(() => P().SpeechControlsTopBar.onOpenSpeechPanel("1AC"))
    const panel = cap.props.ResizablePanel
    expect(panel.defaultSize).toBe(60)
    await run(() => P().SpeechControlsTopBar.onOpenSpeechPanel("1AC"))
    expect(cap.props.ResizablePanel.defaultSize).toBe(100)
  })

  it("resets the selected speech timer, switches it to cross-ex and resets prep through the top bar", async () => {
    seed([makeFlow(1)])
    await renderPage()
    const timer = () => P().FlowPageSidebar.timerState
    await run(() => P().SpeechControlsTopBar.onSwitchToCrossX())
    expect(timer().perSpeechTimerStates["1AC"]).toEqual({ time: 180_000, resetTime: 180_000, state: { name: "paused" } })
    await run(() => timer().setSpeechTimerState("1AC", { time: 5 }))
    await run(() => P().SpeechControlsTopBar.onResetSpeechTime())
    expect(timer().perSpeechTimerStates["1AC"].time).toBe(180_000)

    const prep = timer().debateStyle.prepTime
    await run(() => timer().setPrepState({ time: 1, resetTime: 1, state: { name: "paused" } }))
    await run(() => P().SpeechControlsTopBar.onResetPrepTimers())
    if (prep) {
      expect(timer().prepState.time).toBe(prep * 60_000)
      expect(timer().prepSecondaryState.time).toBe(prep * 60_000)
    } else {
      expect(timer().prepState.time).toBe(1)
    }
  })

  it("puts a running timer and the round's teams into the document title", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW + 61_000)
    seed([makeFlow(1, { roundId: 9 })], [makeRound(9, { flowIds: [1] })])
    await renderPage()
    const timer = P().FlowPageSidebar.timerState
    const first = timer.debateStyle.timerSpeeches[0]
    await run(() => timer.setSpeechState({ resetTimeIndex: 0, time: 1, state: { name: "running", startTime: NOW } }))
    const remaining = first.time * 60_000 - 61_000
    const m = Math.floor(remaining / 60000)
    const s = Math.floor((remaining % 60000) / 1000)
    expect(document.title).toBe(
      `${m}:${String(s).padStart(2, "0")} ${first.name} - Glenbrooks Octas - Lynbrook LP v Monta Vista D`,
    )
    await run(() => P().FlowPageSidebar.timerState.setSpeechState({ resetTimeIndex: 0, time: 1, state: { name: "paused" } }))
    expect(document.title).toBe("Debate AI")
  })

  it("titles a running timer without round details when the flow has no round", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW)
    seed([makeFlow(1)])
    await renderPage()
    await run(() =>
      P().FlowPageSidebar.timerState.setPrepState({ time: 1, resetTime: 120_000, state: { name: "running", startTime: NOW } }),
    )
    expect(document.title).toBe("2:00 Prep")
  })

  it("broadcasts speech and prep timer changes (not untouched timers) to the round's room", async () => {
    seed([makeFlow(1, { roundId: 9 })], [makeRound(9, { flowIds: [1] })])
    let now = NOW
    vi.spyOn(Date, "now").mockImplementation(() => (now += 1000))
    await renderPage()
    const sent = () => room.broadcast.mock.calls.filter((c) => c[0] === "timer-sync").map((c) => c[1].speechName)
    // Opening the round never pushes its default timers onto everyone else.
    expect(sent()).toEqual([])
    await run(() => P().FlowPageSidebar.timerState.setSpeechTimerState("1AC", { time: 1234 }))
    expect(sent()).toEqual(["1AC"])
    if (P().FlowPageSidebar.timerState.prepState) {
      await run(() =>
        P().FlowPageSidebar.timerState.setPrepState({ time: 1, resetTime: 120_000, state: { name: "running", startTime: NOW } }),
      )
      expect(sent()).toEqual(["1AC", "Prep (Aff)"])
    }
  })

  it("drags the split divider within 20–80%", async () => {
    seed([makeFlow(1)])
    await renderPage()
    const box = document.createElement("div")
    box.className = "split-container"
    const inner = document.createElement("span")
    box.appendChild(inner)
    document.body.appendChild(box)
    box.getBoundingClientRect = () => ({ left: 0, width: 200, top: 0, height: 10, right: 200, bottom: 10, x: 0, y: 0, toJSON: () => ({}) })

    await run(() => P().FlowMainContent.onMouseDown())
    await run(() => inner.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 150 })))
    expect(P().FlowMainContent.splitWidth).toBe(75)
    await run(() => inner.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 199 })))
    expect(P().FlowMainContent.splitWidth).toBe(80)
    await run(() => document.body.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 0 })))
    expect(P().FlowMainContent.splitWidth).toBe(80)
    await run(() => document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true })))
    await run(() => inner.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 10 })))
    expect(P().FlowMainContent.splitWidth).toBe(80)
  })

  it("shares mic and recording settings between the top bar and sidebar, and deletes the selected speech's recording", async () => {
    localStorage.setItem("debate-recording-1AC", JSON.stringify({ durationSeconds: 3 }))
    seed([makeFlow(1)])
    await renderPage()
    expect(P().SpeechControlsTopBar.hasRecording).toBe(true)
    expect(P().SpeechControlsTopBar.recordingKey).toBe("debate-recording-1AC")
    await run(() => P().SpeechControlsTopBar.onMicDeviceChange("mic-2"))
    expect(P().FlowPageSidebar.micDeviceId).toBe("mic-2")
    await run(() => P().FlowPageSidebar.onRecordingEnabledChange(false))
    expect(P().SpeechControlsTopBar.recordingEnabled).toBe(false)
    await run(() => P().SpeechControlsTopBar.onDeleteRecording("debate-recording-1AC"))
    expect(P().SpeechControlsTopBar.hasRecording).toBe(false)
    expect(P().SpeechControlsTopBar.recordingKey).toBeUndefined()
  })
})

describe("DebateFlowPage — mobile", () => {
  it("renders the sidebar in a sheet that the dock's open-sidebar event and close callback control", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 500 })
    seed([makeFlow(1)])
    await renderPage()
    expect(P().FlowPageSidebar.isMobile).toBe(true)
    expect(P().Sheet.open).toBe(false)
    await run(() => window.dispatchEvent(new Event("debate:open-sidebar")))
    expect(P().Sheet.open).toBe(true)
    await run(() => P().FlowPageSidebar.onCloseMobileMenu())
    expect(P().Sheet.open).toBe(false)
    // Mobile always steps one speech at a time and shows the top-bar recording menu.
    await run(() => P().FlowPageSidebar.onNavigateNext())
    expect(P().FlowMainContent.leftSpeech).toBe("1NC")
    expect(P().SpeechControlsTopBar.showRecordingMenu).toBe(true)
    await run(() => P().FlowPageSidebar.onSelectEbb())
    await run(() => P().FlowPageSidebar.onEditRound(4))
    expect(P().RoundEditorDialog.roundId).toBe(4)
  })
})
