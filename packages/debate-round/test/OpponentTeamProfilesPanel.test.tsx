// @vitest-environment jsdom
/**
 * @fileoverview Interaction tests for `OpponentTeamProfilesPanel` — the
 * scouting roster, the "Log a scouted round" form, edit/undo/redo/delete of
 * logged rounds, CSV bulk import, the team filter's "Did you mean", the
 * report/comparison downloads and cross-tab live update.
 *
 * Runs against this package's real localStorage stores, so each
 * assertion reads what the panel shows after the store re-derived a profile.
 * Radix Select is swapped for a native `<select>` (`select-mock.tsx`).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"

vi.mock("../src/ui/primitives/select", () => import("./select-mock"))

import { OpponentTeamProfilesPanel } from "../src/panels/OpponentTeamProfilesPanel"
import { recordOpponentRound } from "../src/state/opponentRoundRecords"
import {
  cleanup,
  mount,
  click,
  typeInto,
  choose,
  flush,
  run,
  buttonByText,
  bodyText,
  captureDownloads,
} from "./dom-helpers"

const $ = <T extends Element = HTMLInputElement>(sel: string) => document.querySelector<T>(sel)

function logRound(extra: Partial<Parameters<typeof recordOpponentRound>[0]> = {}) {
  recordOpponentRound({
    id: `r-${Math.random()}`,
    teamId: "Westlake AB",
    tournamentName: "Berkeley",
    date: "2026-01-10",
    division: "PF",
    side: "aff",
    won: true,
    argumentTags: ["critique"],
    caseName: "Housing",
    ...extra,
  })
}

async function renderPanel() {
  await mount(createElement(OpponentTeamProfilesPanel))
  await flush()
}

async function fillForm(values: Record<string, string>) {
  for (const [id, value] of Object.entries(values)) await typeInto($(`#opponent-round-${id}`), value)
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
})

describe("OpponentTeamProfilesPanel", () => {
  it("shows the empty roster state and no logged-rounds section with nothing stored", async () => {
    await renderPanel()
    expect(bodyText()).toContain("Opponent Team Profiles")
    expect(bodyText()).toContain("No opponent team profiles yet.")
    expect(bodyText()).not.toContain("Logged rounds")
    expect(bodyText()).not.toContain("Compare vs. opponent")
  })

  it("requires team, tournament, date and division before logging", async () => {
    await renderPanel()
    await click(buttonByText("Log round"))
    expect(bodyText()).toContain("Team ID, tournament, date, and division are all required.")
  })

  it("logs a scouted round, deriving the roster row and keeping team+division for the next entry", async () => {
    await renderPanel()
    await fillForm({ "team-id": "Lincoln CD", tournament: "Stanford", date: "2026-02-01", division: "PF", case: "Space", tags: "theory, , kritik", vs: "Westlake AB" })
    await choose($("select"), "neg")
    await click(document.querySelector("#opponent-round-won"))
    await click(buttonByText("Log round"))

    const text = bodyText()
    expect(text).not.toContain("are all required")
    expect(text).toContain("Lincoln CD")
    expect(text).toContain("1-0 (100%)")
    expect(text).toContain("Aff 0-0 · Neg 1-0")
    expect(text).toContain("kritik (1), theory (1)")
    expect(text).toContain("Space (1)")
    expect(text).toContain("Logged rounds")
    expect(text).toContain("Win")
    expect($("#opponent-round-team-id")!.value).toBe("Lincoln CD")
    expect($("#opponent-round-division")!.value).toBe("PF")
    expect($("#opponent-round-tournament")!.value).toBe("")
  })

  it("edits a logged round, then undoes and redoes the edit", async () => {
    logRound({ id: "r1", caseName: "Housing" })
    await renderPanel()
    await click(document.querySelector('[aria-label^="Edit Westlake AB"]'))
    expect(bodyText()).toContain("Edit logged round")
    expect($("#opponent-round-case")!.value).toBe("Housing")
    expect($("#opponent-round-tags")!.value).toBe("critique")
    await typeInto($("#opponent-round-case"), "")
    await typeInto($("#opponent-round-tags"), "")
    await click(buttonByText("Save changes"))
    expect(bodyText()).toContain("Log a scouted round")
    // The case column now shows a dash for the cleared case.
    expect(bodyText()).not.toContain("Housing")

    await click(buttonByText("Undo last edit"))
    expect(bodyText()).toContain("Housing")
    expect(buttonByText("Redo")).toBeDefined()
    await click(buttonByText("Redo"))
    expect(bodyText()).not.toContain("Housing")
  })

  it("cancels an edit, and clears the form when the edited round is deleted/undone/redone", async () => {
    logRound({ id: "r1" })
    await renderPanel()
    const edit = () => click(document.querySelector('[aria-label^="Edit Westlake AB"]'))
    await edit()
    await click(buttonByText("Cancel"))
    expect($("#opponent-round-team-id")!.value).toBe("")

    // Make an edit so undo exists, then undo while editing.
    await edit()
    await typeInto($("#opponent-round-case"), "New case")
    await click(buttonByText("Save changes"))
    await edit()
    await click(buttonByText("Undo last edit"))
    expect(bodyText()).toContain("Log a scouted round")
    expect($("#opponent-round-team-id")!.value).toBe("")

    await edit()
    await click(buttonByText("Redo"))
    expect($("#opponent-round-team-id")!.value).toBe("")

    await edit()
    await click(document.querySelector('[aria-label^="Delete Westlake AB"]'))
    expect($("#opponent-round-team-id")!.value).toBe("")
    expect(bodyText()).toContain("No opponent team profiles yet.")
  })

  it("filters logged rounds by team id and suggests the nearest team when nothing matches", async () => {
    logRound({ id: "r1", teamId: "Westlake AB" })
    logRound({ id: "r2", teamId: "Lincoln CD" })
    await renderPanel()
    await typeInto($("#opponent-round-filter"), "linc")
    expect(document.querySelectorAll('[aria-label^="Delete"]').length).toBe(1)
    await typeInto($("#opponent-round-filter"), "Westlak AB")
    expect(bodyText()).toContain("No logged rounds match that team ID.")
    expect(bodyText()).toContain("Did you mean")
    await click(buttonByText("Westlake AB"))
    expect($("#opponent-round-filter")!.value).toBe("Westlake AB")
    expect(document.querySelectorAll('[aria-label^="Delete"]').length).toBe(1)
    expect(document.querySelectorAll("#opponent-round-filter-options option").length).toBe(2)
  })

  it("bulk-imports CSV rows, reporting imported and skipped counts", async () => {
    await renderPanel()
    await click(buttonByText("Import rounds"))
    expect(bodyText()).toContain("Paste a CSV of scouted rounds first.")

    const textarea = document.querySelector("textarea")!
    await typeInto(
      textarea,
      [
        "teamId,tournamentName,date,division,side,won",
        "Alpha AA,Berkeley,2026-01-10,PF,aff,true",
        "Beta BB,Berkeley,2026-01-10,PF,neg,false",
        "Bad,Berkeley,2026-01-10,PF,sideways,true",
      ].join("\n"),
    )
    await click(buttonByText("Import rounds"))
    expect(bodyText()).toMatch(/Imported 2 rounds\. Skipped 1 row: /)
    expect(textarea.value).toBe("")
    expect(bodyText()).toContain("Alpha AA")

    await typeInto(textarea, "teamId,tournamentName,date,division,side,won\nGamma,X,2026-01-01,PF,aff,true")
    await click(buttonByText("Import rounds"))
    expect(bodyText()).toContain("Imported 1 round.")

    await typeInto(textarea, "nonsense")
    await click(buttonByText("Import rounds"))
    expect(bodyText()).toMatch(/No rounds imported\./)
    expect(textarea.value).toBe("nonsense")
  })

  it("downloads the scouting report and builds/downloads a comparison against an opponent", async () => {
    const downloads = captureDownloads()
    logRound({ id: "r1", argumentTags: ["critique", "theory"] })
    logRound({ id: "r2", side: "neg", won: false })
    await renderPanel()
    await click(buttonByText("Download report"))
    expect(downloads.names).toHaveLength(1)
    expect(await downloads.blobs[0].text()).toContain("Westlake AB")

    await click(buttonByText("Compare"))
    expect(bodyText()).toContain("Choose an opponent to compare against.")

    const compareSelect = Array.from(document.querySelectorAll("select")).at(-1)!
    await choose(compareSelect, "Westlake AB")
    await click(buttonByText("Compare"))
    const text = bodyText()
    expect(text).toContain("Us (self)")
    expect(text).toContain("Rounds recorded")
    expect(text).toContain("Westlake AB-only arguments:")
    expect(text).toContain("1-1 (50%)")

    await click(buttonByText("Download comparison"))
    expect(downloads.names).toHaveLength(2)
    expect(await downloads.blobs[1].text()).toContain("Westlake AB")
  })

  it("refreshes the roster on another tab's storage write, ignoring unrelated keys", async () => {
    await renderPanel()
    logRound({ id: "r9", teamId: "Remote Team" })
    await run(() => window.dispatchEvent(new StorageEvent("storage", { key: "something-else" })))
    expect(bodyText()).not.toContain("Remote Team")
    await run(() => window.dispatchEvent(new StorageEvent("storage", { key: null })))
    expect(bodyText()).toContain("Remote Team")
  })
})
