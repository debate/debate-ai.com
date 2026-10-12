// @vitest-environment jsdom
/**
 * @fileoverview Interaction tests for `FlowHistoryDialog` — the round/flow
 * browser with its three tabs (Rounds, Saved to account, History).
 *
 * Runs against the real `useFlowStore` (rounds come from `localStorage`
 * through `getRounds()`, flows from the store), with only the network
 * clients (`saved-flows-client`, `saved-rounds-client`) mocked, so each test
 * asserts what actually lands in the store / on screen after a click.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"

import type { Flow, Round } from "../src/types/flow"
import { useFlowStore } from "../src/state/store"
import { cleanup, mount, click, typeInto, flush, buttonByText, byTitle, allByTitle, bodyText } from "./dom-helpers"

const flowsClient = vi.hoisted(() => ({
  listSavedFlows: vi.fn(),
  fetchSavedFlow: vi.fn(),
  saveFlowToAccount: vi.fn(),
  deleteSavedFlow: vi.fn(),
}))
const roundsClient = vi.hoisted(() => ({
  listSavedRounds: vi.fn(),
  fetchSavedRound: vi.fn(),
  saveRoundToAccount: vi.fn(),
  deleteSavedRound: vi.fn(),
}))

vi.mock("../src/round/saved-flows-client", () => flowsClient)
vi.mock("../src/round/saved-rounds-client", () => roundsClient)
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => createElement("img", { src: props.src as string, alt: props.alt as string }),
}))

import { FlowHistoryDialog } from "../src/dialogs/FlowHistoryDialog"

const NOW = 1_760_000_000_000
const ISO = new Date(NOW).toISOString()

function makeFlow(id: number, content: string, extra: Partial<Flow> = {}): Flow {
  return {
    content,
    level: 0,
    columns: ["1AC", "1NC"],
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
    roundLevel: "Octafinals",
    debaters: { aff: ["alice@x.com", "bob@x.com"], neg: ["carol@x.com", ""] },
    schools: { aff: ["Lynbrook", "Lynbrook"], neg: ["Monta Vista", ""] },
    judges: ["judy@x.com", ""],
    flowIds: [],
    timestamp: NOW,
    status: "completed",
    ...extra,
  }
}

function seed(flows: Flow[], rounds: Round[]) {
  localStorage.setItem("rounds", JSON.stringify(rounds))
  useFlowStore.setState({ flows, selected: 0, rounds })
}

async function renderDialog(props: Partial<Parameters<typeof FlowHistoryDialog>[0]> = {}) {
  const onOpenChange = vi.fn()
  const onEditRound = vi.fn()
  const onCreateRound = vi.fn()
  const onFlowOpened = vi.fn()
  await mount(
    createElement(FlowHistoryDialog, {
      open: true,
      onOpenChange,
      onEditRound,
      onCreateRound,
      onFlowOpened,
      ...props,
    }),
  )
  await flush()
  return { onOpenChange, onEditRound, onCreateRound, onFlowOpened }
}

beforeEach(() => {
  localStorage.clear()
  useFlowStore.setState({ flows: [], selected: 0, rounds: [] })
  for (const fn of [...Object.values(flowsClient), ...Object.values(roundsClient)]) fn.mockReset()
  flowsClient.listSavedFlows.mockResolvedValue([])
  roundsClient.listSavedRounds.mockResolvedValue([])
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("FlowHistoryDialog — Rounds tab", () => {
  it("shows the empty state when no rounds are recorded", async () => {
    await renderDialog()
    expect(bodyText()).toContain("Debate Round History")
    expect(bodyText()).toContain("No rounds recorded")
    expect(buttonByText("Save all rounds")).toBeUndefined()
  })

  it("lists rounds newest first with formatted debaters, schools, judges and flow chips", async () => {
    const flows = [makeFlow(1, "AC"), makeFlow(2, "", { speechNumber: 3 })]
    seed(flows, [
      makeRound(10, { tournamentName: "Older", timestamp: NOW - 1000, flowIds: [1, 2] }),
      makeRound(11, { tournamentName: "Newer", timestamp: NOW }),
    ])
    await renderDialog()
    const text = bodyText()
    expect(text.indexOf("Newer")).toBeLessThan(text.indexOf("Older"))
    expect(text).toContain("alice (Lynbrook), bob (Lynbrook)")
    expect(text).toContain("carol (Monta Vista)")
    expect(text).toContain("judy")
    expect(text).toContain("Speech 3")
    expect(byTitle("Open AC")).not.toBeNull()
  })

  it("filters rounds by tournament, debater, judge and flow name, case-insensitively", async () => {
    seed([makeFlow(1, "Kritik flow")], [
      makeRound(10, { tournamentName: "Glenbrooks", flowIds: [1] }),
      makeRound(11, {
        tournamentName: "TOC",
        roundLevel: "Finals",
        debaters: { aff: ["zed@x.com", ""], neg: ["yan@x.com", ""] },
        schools: undefined,
        judges: ["quinn@x.com"],
      }),
    ])
    await renderDialog()
    const search = document.querySelector('input[placeholder^="Search rounds"]')!

    await typeInto(search, "glen")
    expect(bodyText()).toContain("Glenbrooks")
    expect(bodyText()).not.toContain("TOC")

    await typeInto(search, "QUINN")
    expect(bodyText()).toContain("TOC")
    expect(bodyText()).not.toContain("Glenbrooks")

    await typeInto(search, "finals")
    expect(bodyText()).toContain("TOC")

    await typeInto(search, "zed")
    expect(bodyText()).toContain("TOC")

    await typeInto(search, "kritik")
    expect(bodyText()).toContain("Glenbrooks")
    expect(bodyText()).not.toContain("TOC")

    await typeInto(search, "no-such-thing")
    expect(bodyText()).toContain("No rounds recorded")
  })

  it("clicking a round archives every other flow, selects the round's first flow and closes", async () => {
    seed([makeFlow(1, "Other"), makeFlow(2, "Mine A"), makeFlow(3, "Mine B")], [makeRound(10, { flowIds: [2, 3] })])
    const { onOpenChange, onFlowOpened } = await renderDialog()
    await click(document.querySelector(".cursor-pointer"))
    const { flows, selected } = useFlowStore.getState()
    expect(flows.map((f) => f.archived)).toEqual([true, false, false])
    expect(selected).toBe(1)
    expect(onFlowOpened).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("clicking a round with no local flows archives everything but stays open", async () => {
    seed([makeFlow(1, "Other")], [makeRound(10, { flowIds: [99] })])
    const { onOpenChange } = await renderDialog()
    await click(document.querySelector(".cursor-pointer"))
    expect(useFlowStore.getState().flows[0].archived).toBe(true)
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("opens a single flow chip without loading the whole round", async () => {
    seed([makeFlow(1, "Other"), makeFlow(2, "Chip")], [makeRound(10, { flowIds: [2] })])
    const { onOpenChange, onFlowOpened } = await renderDialog()
    await click(byTitle("Open Chip"))
    expect(useFlowStore.getState().selected).toBe(1)
    expect(useFlowStore.getState().flows[0].archived).toBeUndefined()
    expect(onFlowOpened).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("edit and create buttons hand off to the callbacks and close", async () => {
    seed([], [makeRound(10)])
    const { onOpenChange, onEditRound, onCreateRound } = await renderDialog()
    await click(byTitle("Edit round details"))
    expect(onEditRound).toHaveBeenCalledWith(10)
    await click(buttonByText("Create New Round"))
    expect(onCreateRound).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("deletes a local round only after confirmation", async () => {
    seed([], [makeRound(10, { tournamentName: "Doomed" })])
    const confirmSpy = vi.fn(() => false)
    vi.stubGlobal("confirm", confirmSpy)
    await renderDialog()

    await click(byTitle("Delete this round from this browser"))
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('"Doomed — Octafinals"'))
    expect(bodyText()).toContain("Doomed")

    confirmSpy.mockReturnValue(true)
    await click(byTitle("Delete this round from this browser"))
    expect(bodyText()).not.toContain("Doomed")
    expect(JSON.parse(localStorage.getItem("rounds") ?? "[]")).toEqual([])
  })

  it("uses the bare round level in the delete prompt when there is no tournament name", async () => {
    seed([], [makeRound(10, { tournamentName: "" })])
    const confirmSpy = vi.fn(() => false)
    vi.stubGlobal("confirm", confirmSpy)
    await renderDialog()
    await click(byTitle("Delete this round from this browser"))
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('"Octafinals"'))
  })

  it("saves a single flow chip and shows the saved state", async () => {
    seed([makeFlow(2, "Chip")], [makeRound(10, { flowIds: [2] })])
    flowsClient.saveFlowToAccount.mockResolvedValue({ conflict: false, summary: { clientId: 2, label: "Chip", updatedAt: ISO } })
    await renderDialog()
    await click(byTitle("Save this flow to your account"))
    expect(flowsClient.saveFlowToAccount).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }), {
      baseUpdatedAt: null,
      force: false,
    })
    expect(byTitle("Saved to your account")).not.toBeNull()
  })

  it("marks a flow chip conflicting, then force-saves it on the next click", async () => {
    seed([makeFlow(2, "Chip")], [makeRound(10, { flowIds: [2] })])
    flowsClient.saveFlowToAccount.mockResolvedValueOnce({ conflict: true, current: { clientId: 2, label: "Chip", updatedAt: ISO } })
    await renderDialog()
    await click(byTitle("Save this flow to your account"))
    const conflictTitle = "Saved from elsewhere since you last loaded it — click again to overwrite"
    const conflictChip = allByTitle(conflictTitle).find((el) => el.tagName === "BUTTON" && el.closest("span"))
    expect(conflictChip).toBeDefined()

    flowsClient.saveFlowToAccount.mockResolvedValueOnce({ conflict: false, summary: { clientId: 2, label: "Chip", updatedAt: ISO } })
    await click(conflictChip)
    expect(flowsClient.saveFlowToAccount).toHaveBeenLastCalledWith(expect.objectContaining({ id: 2 }), {
      baseUpdatedAt: null,
      force: true,
    })
  })

  it("shows an error icon when a flow save throws", async () => {
    seed([makeFlow(2, "Chip")], [makeRound(10, { flowIds: [2] })])
    flowsClient.saveFlowToAccount.mockRejectedValue(new Error("boom"))
    await renderDialog()
    await click(byTitle("Save this flow to your account"))
    expect(document.querySelector("span .text-destructive")).not.toBeNull()
  })

  it("saves a round together with its local flows", async () => {
    seed([makeFlow(2, "Chip")], [makeRound(10, { flowIds: [2] })])
    flowsClient.saveFlowToAccount.mockResolvedValue({ conflict: false, summary: { clientId: 2, label: "Chip", updatedAt: ISO } })
    roundsClient.saveRoundToAccount.mockResolvedValue({ conflict: false, summary: { clientId: 10, label: "R", updatedAt: ISO } })
    await renderDialog()
    await click(byTitle("Save this round (and its flows) to your account"))
    expect(flowsClient.saveFlowToAccount).toHaveBeenCalledTimes(1)
    expect(roundsClient.saveRoundToAccount).toHaveBeenCalledWith(expect.objectContaining({ id: 10 }), {
      baseUpdatedAt: null,
      force: false,
    })
    expect(allByTitle("Saved to your account").length).toBe(2)
  })

  it("flags a round conflict, force-saves on retry, and reports a thrown save as an error", async () => {
    seed([], [makeRound(10)])
    roundsClient.saveRoundToAccount.mockResolvedValueOnce({ conflict: true, current: { clientId: 10, label: "R", updatedAt: ISO } })
    await renderDialog()
    await click(byTitle("Save this round (and its flows) to your account"))
    const conflictTitle = "Saved from elsewhere since you last loaded it — click again to overwrite"
    expect(byTitle(conflictTitle)).not.toBeNull()

    roundsClient.saveRoundToAccount.mockRejectedValueOnce(new Error("down"))
    await click(byTitle(conflictTitle))
    expect(roundsClient.saveRoundToAccount).toHaveBeenLastCalledWith(expect.objectContaining({ id: 10 }), {
      baseUpdatedAt: null,
      force: true,
    })
    expect(document.querySelector("button .text-destructive")).not.toBeNull()
  })

  it("'Save all rounds' saves each shared flow once, reports the count, and skips clean items next time", async () => {
    seed([makeFlow(1, "A"), makeFlow(2, "B")], [makeRound(10, { flowIds: [1, 2] }), makeRound(11, { flowIds: [2] })])
    flowsClient.saveFlowToAccount.mockImplementation(async (flow: Flow) => ({
      conflict: false,
      summary: { clientId: flow.id, label: flow.content, updatedAt: ISO },
    }))
    roundsClient.saveRoundToAccount.mockImplementation(async (round: Round) => ({
      conflict: false,
      summary: { clientId: round.id, label: "R", updatedAt: ISO },
    }))
    await renderDialog()
    await click(buttonByText("Save all rounds"))
    await flush()
    expect(flowsClient.saveFlowToAccount).toHaveBeenCalledTimes(2)
    expect(roundsClient.saveRoundToAccount).toHaveBeenCalledTimes(2)
    expect(bodyText()).toContain("Saved 2 rounds.")

    await click(buttonByText("Save all rounds"))
    await flush()
    // Nothing changed since the first pass, so nothing is PUT again.
    expect(flowsClient.saveFlowToAccount).toHaveBeenCalledTimes(2)
    expect(roundsClient.saveRoundToAccount).toHaveBeenCalledTimes(2)
    expect(bodyText()).toContain("Saved 2 rounds.")
  })

  it("'Save all rounds' counts conflicts and errors as failures", async () => {
    seed([], [makeRound(10), makeRound(11), makeRound(12)])
    roundsClient.saveRoundToAccount.mockImplementation(async (round: Round) => {
      if (round.id === 10) return { conflict: true, current: { clientId: 10, label: "R", updatedAt: ISO } }
      if (round.id === 11) throw new Error("nope")
      return { conflict: false, summary: { clientId: round.id, label: "R", updatedAt: ISO } }
    })
    await renderDialog()
    await click(buttonByText("Save all rounds"))
    await flush()
    expect(bodyText()).toContain("Saved 1, 2 failed.")
  })

  it("'Save flows not in a round' saves only unreferenced flows and summarises", async () => {
    seed([makeFlow(1, "In round"), makeFlow(2, "Loose"), makeFlow(3, "Loose 2")], [makeRound(10, { flowIds: [1] })])
    flowsClient.saveFlowToAccount.mockImplementation(async (flow: Flow) =>
      flow.id === 3
        ? { conflict: true, current: { clientId: 3, label: "x", updatedAt: ISO } }
        : { conflict: false, summary: { clientId: flow.id, label: flow.content, updatedAt: ISO } },
    )
    await renderDialog()
    const btn = buttonByText("Save flows not in a round")!
    expect(btn.textContent).toContain("(2)")
    await click(btn)
    await flush()
    expect(flowsClient.saveFlowToAccount.mock.calls.map((c) => (c[0] as Flow).id).sort()).toEqual([2, 3])
    expect(bodyText()).toContain("Saved 1, 1 failed.")
  })

  it("'Save flows not in a round' skips already-saved flows and reports a full success", async () => {
    seed([makeFlow(2, "Loose")], [])
    flowsClient.saveFlowToAccount.mockResolvedValue({ conflict: false, summary: { clientId: 2, label: "Loose", updatedAt: ISO } })
    await renderDialog()
    await click(buttonByText("Save flows not in a round"))
    await flush()
    expect(bodyText()).toContain("Saved 1 flow.")
    await click(buttonByText("Save flows not in a round"))
    await flush()
    expect(flowsClient.saveFlowToAccount).toHaveBeenCalledTimes(1)
    expect(bodyText()).toContain("Saved 1 flow.")
  })

  it("'Save flows not in a round' reports a thrown save as failed", async () => {
    seed([makeFlow(2, "Loose")], [])
    flowsClient.saveFlowToAccount.mockRejectedValue(new Error("x"))
    await renderDialog()
    await click(buttonByText("Save flows not in a round"))
    await flush()
    expect(bodyText()).toContain("Saved 0, 1 failed.")
  })
})

describe("FlowHistoryDialog — Saved to account tab", () => {
  it("shows the signed-out message when the account lists resolve to null", async () => {
    flowsClient.listSavedFlows.mockResolvedValue(null)
    roundsClient.listSavedRounds.mockResolvedValue(null)
    await renderDialog()
    await click(buttonByText("Saved to account"))
    expect(bodyText()).toContain("Sign in to save flows to your account")
  })

  it("shows load errors for flows and rounds", async () => {
    flowsClient.listSavedFlows.mockRejectedValue(new Error("Flows exploded"))
    roundsClient.listSavedRounds.mockRejectedValue("not an error")
    await renderDialog()
    await click(buttonByText("Saved to account"))
    expect(bodyText()).toContain("Flows exploded")
  })

  it("shows the round list error under a loaded flow list, and the generic flow message for non-Errors", async () => {
    flowsClient.listSavedFlows.mockResolvedValue([])
    roundsClient.listSavedRounds.mockRejectedValue(new Error("Rounds exploded"))
    await renderDialog()
    await click(buttonByText("Saved to account"))
    expect(bodyText()).toContain("No flows saved to your account yet")
    expect(bodyText()).toContain("Rounds exploded")
    cleanup()

    flowsClient.listSavedFlows.mockRejectedValue("weird")
    await renderDialog()
    await click(buttonByText("Saved to account"))
    expect(bodyText()).toContain("Failed to load your saved flows.")
  })

  it("lists saved flows (badging ones saved via a local round) and saved rounds", async () => {
    seed([], [makeRound(10, { flowIds: [5] })])
    flowsClient.listSavedFlows.mockResolvedValue([
      { clientId: 5, label: "Round flow", updatedAt: ISO },
      { clientId: 6, label: "Loose flow", updatedAt: ISO },
    ])
    roundsClient.listSavedRounds.mockResolvedValue([{ clientId: 10, label: "Saved round", updatedAt: ISO }])
    await renderDialog()
    await click(buttonByText("Saved to account"))
    const text = bodyText()
    expect(text).toContain("Round flow")
    expect(text).toContain("Loose flow")
    expect(text).toContain("Saved round")
    expect(document.querySelectorAll('[title^="Saved as part of"]').length).toBe(1)
  })

  it("shows the empty saved-rounds state", async () => {
    await renderDialog()
    await click(buttonByText("Saved to account"))
    expect(bodyText()).toContain("No rounds saved to your account yet")
  })

  it("loads a cloud flow: replaces a same-id local flow and selects it", async () => {
    seed([makeFlow(1, "One"), makeFlow(5, "Stale")], [])
    flowsClient.listSavedFlows.mockResolvedValue([{ clientId: 5, label: "Fresh", updatedAt: ISO }])
    flowsClient.fetchSavedFlow.mockResolvedValue(makeFlow(5, "Fresh"))
    const { onOpenChange, onFlowOpened } = await renderDialog()
    await click(buttonByText("Saved to account"))
    await click(byTitle("Load into this browser"))
    const state = useFlowStore.getState()
    expect(state.flows.map((f) => f.content)).toEqual(["One", "Fresh"])
    expect(state.selected).toBe(1)
    expect(onFlowOpened).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("loads a cloud flow that isn't local by appending it", async () => {
    seed([makeFlow(1, "One")], [])
    flowsClient.listSavedFlows.mockResolvedValue([{ clientId: 7, label: "New", updatedAt: ISO }])
    flowsClient.fetchSavedFlow.mockResolvedValue(makeFlow(7, "New"))
    await renderDialog()
    await click(buttonByText("Saved to account"))
    await click(byTitle("Load into this browser"))
    expect(useFlowStore.getState().flows.map((f) => f.id)).toEqual([1, 7])
    expect(useFlowStore.getState().selected).toBe(1)
  })

  it("keeps the dialog open when a cloud flow is missing or fails to load", async () => {
    flowsClient.listSavedFlows.mockResolvedValue([{ clientId: 7, label: "Gone", updatedAt: ISO }])
    flowsClient.fetchSavedFlow.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("x"))
    const { onOpenChange } = await renderDialog()
    await click(buttonByText("Saved to account"))
    await click(byTitle("Load into this browser"))
    await click(byTitle("Load into this browser"))
    expect(flowsClient.fetchSavedFlow).toHaveBeenCalledTimes(2)
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(useFlowStore.getState().flows).toEqual([])
  })

  it("removes a cloud flow from the list, and keeps it listed when removal fails", async () => {
    flowsClient.listSavedFlows.mockResolvedValue([
      { clientId: 7, label: "Remove me", updatedAt: ISO },
      { clientId: 8, label: "Sticky", updatedAt: ISO },
    ])
    flowsClient.deleteSavedFlow.mockImplementation(async (id: number) => {
      if (id === 8) throw new Error("x")
    })
    await renderDialog()
    await click(buttonByText("Saved to account"))
    const removeButtons = () => allByTitle("Remove from your account")
    await click(removeButtons()[0])
    expect(bodyText()).not.toContain("Remove me")
    await click(removeButtons()[0])
    expect(flowsClient.deleteSavedFlow).toHaveBeenCalledWith(8)
    expect(bodyText()).toContain("Sticky")
  })

  it("loads a cloud round, fetching its missing flows, and opens its first flow", async () => {
    seed([makeFlow(1, "Local")], [])
    roundsClient.listSavedRounds.mockResolvedValue([{ clientId: 20, label: "Cloud round", updatedAt: ISO }])
    roundsClient.fetchSavedRound.mockResolvedValue(makeRound(20, { flowIds: [1, 2, 3] }))
    flowsClient.fetchSavedFlow.mockImplementation(async (id: number) => (id === 2 ? makeFlow(2, "Fetched") : null))
    const { onOpenChange } = await renderDialog()
    await click(buttonByText("Saved to account"))
    await click(byTitle("Load into this browser"))
    const state = useFlowStore.getState()
    expect(state.flows.map((f) => [f.id, f.archived])).toEqual([
      [1, false],
      [2, false],
    ])
    expect(state.rounds.map((r) => r.id)).toEqual([20])
    expect(JSON.parse(localStorage.getItem("rounds")!)[0].id).toBe(20)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("loading a cloud round replaces the same-id local round", async () => {
    seed([makeFlow(1, "Local")], [makeRound(20, { tournamentName: "Old name", flowIds: [1] })])
    roundsClient.listSavedRounds.mockResolvedValue([{ clientId: 20, label: "Cloud round", updatedAt: ISO }])
    roundsClient.fetchSavedRound.mockResolvedValue(makeRound(20, { tournamentName: "New name", flowIds: [1] }))
    await renderDialog()
    await click(buttonByText("Saved to account"))
    await click(byTitle("Load into this browser"))
    expect(flowsClient.fetchSavedFlow).not.toHaveBeenCalled()
    expect(useFlowStore.getState().rounds.map((r) => r.tournamentName)).toEqual(["New name"])
  })

  it("leaves everything alone when a cloud round is missing or throws", async () => {
    roundsClient.listSavedRounds.mockResolvedValue([{ clientId: 20, label: "Cloud round", updatedAt: ISO }])
    roundsClient.fetchSavedRound.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("x"))
    const { onOpenChange } = await renderDialog()
    await click(buttonByText("Saved to account"))
    await click(byTitle("Load into this browser"))
    await click(byTitle("Load into this browser"))
    expect(roundsClient.fetchSavedRound).toHaveBeenCalledTimes(2)
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("removes a cloud round, and keeps it when removal fails", async () => {
    roundsClient.listSavedRounds.mockResolvedValue([
      { clientId: 20, label: "Bye round", updatedAt: ISO },
      { clientId: 21, label: "Stay round", updatedAt: ISO },
    ])
    roundsClient.deleteSavedRound.mockImplementation(async (id: number) => {
      if (id === 21) throw new Error("x")
    })
    await renderDialog()
    await click(buttonByText("Saved to account"))
    await click(allByTitle("Remove from your account")[0])
    expect(bodyText()).not.toContain("Bye round")
    await click(allByTitle("Remove from your account")[0])
    expect(roundsClient.deleteSavedRound).toHaveBeenCalledWith(21)
    expect(bodyText()).toContain("Stay round")
  })

  it("uses the known cloud updatedAt as the save baseline after visiting the cloud tab", async () => {
    seed([makeFlow(2, "Chip")], [makeRound(10, { flowIds: [2] })])
    flowsClient.listSavedFlows.mockResolvedValue([{ clientId: 2, label: "Chip", updatedAt: "2025-01-01T00:00:00.000Z" }])
    roundsClient.listSavedRounds.mockResolvedValue([{ clientId: 10, label: "R", updatedAt: "2025-02-02T00:00:00.000Z" }])
    flowsClient.saveFlowToAccount.mockResolvedValue({ conflict: false, summary: { clientId: 2, label: "Chip", updatedAt: ISO } })
    roundsClient.saveRoundToAccount.mockResolvedValue({ conflict: false, summary: { clientId: 10, label: "R", updatedAt: ISO } })
    await renderDialog()
    await click(buttonByText("Saved to account"))
    await click(buttonByText("Rounds"))
    await click(byTitle("Save this round (and its flows) to your account"))
    expect(flowsClient.saveFlowToAccount).toHaveBeenCalledWith(expect.anything(), {
      baseUpdatedAt: "2025-01-01T00:00:00.000Z",
      force: false,
    })
    expect(roundsClient.saveRoundToAccount).toHaveBeenCalledWith(expect.anything(), {
      baseUpdatedAt: "2025-02-02T00:00:00.000Z",
      force: false,
    })
  })
})

describe("FlowHistoryDialog — History tab", () => {
  function seedHistory(entries: { id: string; label: string; flow: Flow }[]) {
    localStorage.setItem(
      "flow-history",
      JSON.stringify(entries.map((e, i) => ({ ...e, timestamp: NOW - i * 1000 }))),
    )
  }

  it("shows the empty history state", async () => {
    await renderDialog()
    await click(buttonByText("History"))
    expect(bodyText()).toContain("No history yet")
  })

  it("restores a history entry as a new flow and closes", async () => {
    seedHistory([{ id: "h1", label: "My old flow", flow: makeFlow(3, "My old flow") }])
    const { onOpenChange, onFlowOpened } = await renderDialog()
    await click(buttonByText("History"))
    expect(bodyText()).toContain("My old flow")
    await click(document.querySelector('[role="button"][title^="Open My old flow"]'))
    expect(useFlowStore.getState().flows.length).toBe(1)
    expect(onFlowOpened).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("refreshes the list instead of closing when the entry has been trimmed", async () => {
    seedHistory([{ id: "h1", label: "Vanishing", flow: makeFlow(3, "Vanishing") }])
    const { onOpenChange } = await renderDialog()
    await click(buttonByText("History"))
    localStorage.removeItem("flow-history")
    await click(document.querySelector('[role="button"][title^="Open Vanishing"]'))
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(bodyText()).toContain("No history yet")
  })

  it("clears history only after confirmation", async () => {
    seedHistory([{ id: "h1", label: "Keep?", flow: makeFlow(3, "Keep?") }])
    const confirmSpy = vi.fn(() => false)
    vi.stubGlobal("confirm", confirmSpy)
    await renderDialog()
    await click(buttonByText("History"))
    await click(buttonByText("Clear history"))
    expect(bodyText()).toContain("Keep?")
    confirmSpy.mockReturnValue(true)
    await click(buttonByText("Clear history"))
    expect(localStorage.getItem("flow-history")).toBeNull()
    expect(bodyText()).toContain("No history yet")
  })
})
