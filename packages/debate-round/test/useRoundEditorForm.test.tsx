// @vitest-environment jsdom
/**
 * @fileoverview Tests for the round editor's form hook (`useRoundEditorForm`)
 * and a smoke-plus-behaviour render of `RoundEditorDialog` with its real
 * sections.
 *
 * Round setup is persisted (CLAUDE.md: "Round setup and export shapes are
 * persisted"), so these pin what a submit writes into the real flow store:
 * the created round (title/slug/judges/spectators), its generated flow,
 * archiving of the previous flows, the edit-mode update, and the invite
 * dispatch for newly-added people.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"

const nav = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => createElement("img", { alt: props.alt as string }),
}))

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock("sonner", () => ({ toast }))

const invites = vi.hoisted(() => ({ sendRoundInvites: vi.fn() }))
vi.mock("../src/round/round-invite-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/round/round-invite-client")>()
  return { ...actual, sendRoundInvites: invites.sendRoundInvites }
})

import { useRoundEditorForm } from "../src/dialogs/CreateRoundDialog/useRoundEditorForm"
import { RoundEditorDialog } from "../src/dialogs/CreateRoundDialog"
import { useFlowStore } from "../src/state/store"
import { settings } from "../src/state/settings"
import type { Flow, Round } from "../src/types/flow"
import { cleanup, renderHook, run, flush, mount, bodyText, buttonByText, click } from "./dom-helpers"

const NOW = 1_760_000_000_000

function makeFlow(id: number, extra: Partial<Flow> = {}): Flow {
  return {
    content: `Flow ${id}`,
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
    debaters: { aff: ["a1@x.com", "a2@x.com"], neg: ["n1@x.com", ""] },
    schools: { aff: ["Lynbrook", "Lynbrook"], neg: ["Harker", "Harker"] },
    judges: ["j1@x.com"],
    spectators: ["s1@x.com"],
    flowIds: [1],
    timestamp: NOW,
    status: "active",
    slug: "glenbrooks/lynbrook-harker",
    isPrivate: true,
    winner: "neg",
    ...extra,
  }
}

let alertSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  localStorage.clear()
  useFlowStore.setState({ flows: [], rounds: [], selected: 0 })
  settings.setValue("debateStyle", 0)
  nav.push.mockReset()
  toast.success.mockReset()
  invites.sendRoundInvites.mockReset()
  invites.sendRoundInvites.mockResolvedValue(null)
  alertSpy = vi.fn()
  vi.stubGlobal("alert", alertSpy)
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

type Props = { open: boolean; roundId?: number }

async function renderForm(props: Props, onOpenChange = vi.fn()) {
  const hook = await renderHook((p: Props) => useRoundEditorForm(p.open, onOpenChange, p.roundId), props)
  return { hook, onOpenChange, f: () => hook.result.current }
}

async function fillValid(f: () => ReturnType<typeof useRoundEditorForm>) {
  await run(() => {
    f().setTournamentName("TOC")
    f().setAffDebater1("aff1@x.com")
    f().setAffDebater2("aff2@x.com")
    f().setNegDebater1("neg1@x.com")
    f().setAffSchool("Lynbrook")
    f().setNegSchool("Harker")
    f().setJudgeEmails(["judge@x.com", ""])
    f().setSpectatorEmails(["spec@x.com", ""])
  })
}

describe("useRoundEditorForm — validation", () => {
  it("rejects a submit missing the tournament, round level, debaters, judge or with a bad email", async () => {
    const { f, onOpenChange } = await renderForm({ open: true })
    await run(() => f().handleSubmit())
    expect(alertSpy).toHaveBeenLastCalledWith("Please enter a tournament name")

    await run(() => f().setTournamentName("TOC"))
    await run(() => f().setRoundLevel(""))
    await run(() => f().handleSubmit())
    expect(alertSpy).toHaveBeenLastCalledWith("Please select a round level")

    await run(() => f().setRoundLevel("Prelim 2"))
    await run(() => f().handleSubmit())
    expect(alertSpy).toHaveBeenLastCalledWith("Please enter emails for at least one debater per side")

    await run(() => {
      f().setAffDebater1("a@x.com")
      f().setNegDebater1("n@x.com")
    })
    await run(() => f().handleSubmit())
    expect(alertSpy).toHaveBeenLastCalledWith("Please enter at least one judge email")

    await run(() => f().setJudgeEmails(["not-an-email"]))
    await run(() => f().handleSubmit())
    expect(alertSpy).toHaveBeenLastCalledWith("Invalid email format: not-an-email")

    expect(onOpenChange).not.toHaveBeenCalled()
    expect(useFlowStore.getState().rounds).toEqual([])
  })
})

describe("useRoundEditorForm — create", () => {
  it("creates an active round with a generated title/slug and one flow, archiving existing flows", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW)
    useFlowStore.setState({ flows: [makeFlow(1)] })
    invites.sendRoundInvites.mockResolvedValue({ notified: ["a"], emailed: ["b", "c"] })
    const { f, onOpenChange } = await renderForm({ open: true })
    await fillValid(f)
    await run(() => f().setIsPrivate(true))
    await run(() => f().handleSubmit())
    await flush()

    const { rounds, flows } = useFlowStore.getState()
    expect(rounds).toHaveLength(1)
    const round = rounds[0]
    expect(round).toMatchObject({
      tournamentName: "TOC",
      roundLevel: "Prelim 1",
      judges: ["judge@x.com"],
      spectators: ["spec@x.com"],
      status: "active",
      isPrivate: true,
      schools: { aff: ["Lynbrook", "Lynbrook"], neg: ["Harker", "Harker"] },
    })
    expect(round.title).toContain("TOC - Prelim 1 - Lynbrook vs Harker")
    expect(round.slug).toBeTruthy()
    expect(flows.map((fl) => [fl.id, fl.archived])).toEqual([
      [1, true],
      [NOW, false],
    ])
    const created = flows[1]
    expect(created.roundId).toBe(round.id)
    expect(created.content).toMatch(/^TOC - Prelim 1 - /)
    expect(created.children.length).toBeGreaterThan(0)
    expect(JSON.parse(localStorage.getItem("flows")!)).toHaveLength(2)

    expect(invites.sendRoundInvites).toHaveBeenCalledWith({
      emails: ["aff1@x.com", "aff2@x.com", "neg1@x.com", "", "judge@x.com", "spec@x.com"],
      tournamentName: "TOC",
      roundLevel: "Prelim 1",
      slug: round.slug,
    })
    expect(toast.success).toHaveBeenCalledWith("Notified 1 registered user, emailed 2 invites")
    expect(nav.push).toHaveBeenCalledWith(`/debate/${round.slug}`)
    expect(onOpenChange).toHaveBeenCalledWith(false)
    // The form resets after creating.
    expect(f().tournamentName).toBe("")
    expect(f().judgeEmails).toEqual([""])
  })

  it("toasts singular/plural invite summaries and stays quiet when nobody was reached", async () => {
    invites.sendRoundInvites.mockResolvedValueOnce({ notified: [], emailed: ["x"] })
    const a = await renderForm({ open: true })
    await fillValid(a.f)
    await run(() => a.f().handleSubmit())
    await flush()
    expect(toast.success).toHaveBeenLastCalledWith("emailed 1 invite")

    invites.sendRoundInvites.mockResolvedValueOnce({ notified: ["p", "q"], emailed: [] })
    await fillValid(a.f)
    await run(() => a.f().handleSubmit())
    await flush()
    expect(toast.success).toHaveBeenLastCalledWith("Notified 2 registered users")

    invites.sendRoundInvites.mockResolvedValueOnce({ notified: [], emailed: [] })
    await fillValid(a.f)
    await run(() => a.f().handleSubmit())
    await flush()
    expect(toast.success).toHaveBeenCalledTimes(2)
  })

  it("saves the chosen debate style as the default and uses that style's columns", async () => {
    const { f } = await renderForm({ open: true })
    await fillValid(f)
    const options = (settings.data.debateStyle as unknown as { detail: { options: string[] } }).detail.options
    const last = options.length - 1
    await run(() => f().setDebateStyleIndex(last))
    await run(() => f().handleSubmit())
    expect(settings.data.debateStyle.value).toBe(last)
    expect(useFlowStore.getState().flows[0].columns.length).toBeGreaterThan(0)
  })

  it("adds judge slots for elimination rounds and trims them back for prelims", async () => {
    const { f } = await renderForm({ open: true })
    await run(() => f().setRoundLevel("Quarterfinals"))
    expect(f().judgeEmails).toEqual(["", "", ""])
    await run(() => f().setRoundLevel("Semifinals"))
    expect(f().judgeEmails).toEqual(["", "", ""])
    await run(() => f().setRoundLevel("Prelim 3"))
    expect(f().judgeEmails).toEqual([""])

    // Filled panel slots are kept when going back to a prelim.
    await run(() => f().setRoundLevel("Finals"))
    await run(() => f().setJudgeEmails(["a@x.com", "b@x.com", ""]))
    await run(() => f().setRoundLevel("Prelim 1"))
    expect(f().judgeEmails).toEqual(["a@x.com", "b@x.com", ""])
  })

  it("resets the form when the dialog closes", async () => {
    const { hook, f } = await renderForm({ open: true })
    await fillValid(f)
    await hook.rerender({ open: false })
    expect(f().tournamentName).toBe("")
    expect(f().affDebater1).toBe("")
    expect(f().spectatorEmails).toEqual([])
  })
})

describe("useRoundEditorForm — edit", () => {
  it("loads the round being edited, lists its flows and selects one", async () => {
    useFlowStore.setState({ flows: [makeFlow(9), makeFlow(1)], rounds: [makeRound(5)] })
    const { f, onOpenChange } = await renderForm({ open: true, roundId: 5 })
    expect(f()).toMatchObject({
      tournamentName: "Glenbrooks",
      roundLevel: "Octafinals",
      affDebater1: "a1@x.com",
      negSchool: "Harker",
      judgeEmails: ["j1@x.com"],
      spectatorEmails: ["s1@x.com"],
      isPrivate: true,
      winner: "neg",
    })
    expect(f().roundFlows.map((fl) => fl.id)).toEqual([1])
    await run(() => f().selectRoundFlow(makeFlow(1)))
    expect(useFlowStore.getState().selected).toBe(1)
    expect(onOpenChange).toHaveBeenCalledWith(false)
    onOpenChange.mockClear()
    await run(() => f().selectRoundFlow(makeFlow(404)))
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("fills defaults for a round with no schools/judges/spectators and keeps judge slots in edit mode", async () => {
    useFlowStore.setState({
      rounds: [makeRound(5, { schools: undefined, judges: [], spectators: undefined, isPrivate: undefined, winner: undefined })],
    })
    const { f } = await renderForm({ open: true, roundId: 5 })
    expect(f()).toMatchObject({ affSchool: "", judgeEmails: [""], spectatorEmails: [], isPrivate: false, winner: "none" })
    await run(() => f().setRoundLevel("Finals"))
    expect(f().judgeEmails).toEqual([""])
  })

  it("updates the round and invites only the people added since", async () => {
    useFlowStore.setState({ flows: [makeFlow(1)], rounds: [makeRound(5)] })
    const { f, onOpenChange } = await renderForm({ open: true, roundId: 5 })
    await run(() => {
      f().setJudgeEmails(["j1@x.com", "j2@x.com"])
      f().setSpectatorEmails(["s1@x.com", "s2@x.com", " "])
      f().setWinner("none")
    })
    await run(() => f().handleSubmit())
    const round = useFlowStore.getState().rounds[0]
    expect(round.judges).toEqual(["j1@x.com", "j2@x.com"])
    expect(round.spectators).toEqual(["s1@x.com", "s2@x.com"])
    expect(round.winner).toBeUndefined()
    expect(invites.sendRoundInvites).toHaveBeenCalledWith({
      emails: ["j2@x.com", "s2@x.com"],
      tournamentName: "Glenbrooks",
      roundLevel: "Octafinals",
      slug: "glenbrooks/lynbrook-harker",
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(nav.push).not.toHaveBeenCalled()
  })

  it("sends no invites when nobody new was added, and handles a missing slug", async () => {
    useFlowStore.setState({ rounds: [makeRound(5, { slug: undefined })] })
    const { f } = await renderForm({ open: true, roundId: 5 })
    await run(() => f().setWinner("aff"))
    await run(() => f().handleSubmit())
    expect(invites.sendRoundInvites).not.toHaveBeenCalled()
    expect(useFlowStore.getState().rounds[0].winner).toBe("aff")

    await run(() => f().setJudgeEmails(["j1@x.com", "new@x.com"]))
    await run(() => f().handleSubmit())
    expect(invites.sendRoundInvites).toHaveBeenCalledWith(expect.objectContaining({ emails: ["new@x.com"], slug: "" }))
  })
})

describe("RoundEditorDialog", () => {
  it("renders the create form with its sections and validates on submit", async () => {
    await mount(createElement(RoundEditorDialog, { open: true, onOpenChange: vi.fn() }))
    await flush()
    const text = bodyText()
    expect(text).toContain("Create New Round")
    expect(text).toContain("Create Round & Invite")
    expect(text).toContain("Public")
    await click(buttonByText("Create Round & Invite"))
    expect(alertSpy).toHaveBeenCalledWith("Please enter a tournament name")
  })

  it("renders the edit form with the round's flows and winner section", async () => {
    useFlowStore.setState({ flows: [makeFlow(1, { content: "Round flow A" })], rounds: [makeRound(5)] })
    const onOpenChange = vi.fn()
    await mount(createElement(RoundEditorDialog, { open: true, onOpenChange, roundId: 5 }))
    await flush()
    const text = bodyText()
    expect(text).toContain("Edit Round")
    expect(text).toContain("Update Round")
    expect(text).toContain("Private")
    expect(text).toContain("Round flow A")
    await click(buttonByText("Round flow A"))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
