// @vitest-environment jsdom
/**
 * @fileoverview Render test for `TeamSection`'s account-linked "My Team"
 * profile sync — TODO.md idea #17's "create user settings and link user db"
 * follow-up. `state/myTeamProfile.ts` used to be localStorage-only; this
 * pins that a signed-in visitor's saved profile is pulled from `/api/settings`
 * on mount and applied over whatever was in this browser's localStorage,
 * and that saving the profile pushes it back to the account, mirroring
 * `UserSettingsPanel.test.tsx`'s fetch-mocking shape.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"

import { TeamSection } from "../src/dialogs/CreateRoundDialog/TeamSection"
import { getMyTeamProfile } from "../src/state/myTeamProfile"

vi.mock("../src/round/school-teams", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/round/school-teams")>()
  return {
    ...actual,
    lookupSchoolTeams: vi.fn(async (_style: string, school: string) =>
      school === "Harker"
        ? [{ rank: 2, school: "Harker", name: "Ahuja & Miduthuri", hash: "h1" }]
        : [],
    ),
  }
})

let container: HTMLDivElement
let root: Root

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    affDebater1: "",
    setAffDebater1: () => {},
    affDebater2: "",
    setAffDebater2: () => {},
    negDebater1: "",
    setNegDebater1: () => {},
    negDebater2: "",
    setNegDebater2: () => {},
    affSchool: "",
    setAffSchool: () => {},
    negSchool: "",
    setNegSchool: () => {},
    debateStyleIndex: 0,
    ...overrides,
  }
}

async function renderSection(): Promise<string> {
  await act(async () => {
    root.render(createElement(TeamSection, baseProps()))
  })
  return container.innerHTML
}

function stubFetchSignedOut() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })) as unknown as typeof fetch,
  )
}

function stubFetchSignedIn(remote: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => remote })) as unknown as typeof fetch,
  )
}

beforeEach(() => {
  localStorage.clear()
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe("TeamSection My Team profile sync", () => {
  it("renders normally when signed out, keeping the local profile", async () => {
    stubFetchSignedOut()
    const html = await renderSection()

    expect(html).toContain("My Team")
    expect(getMyTeamProfile()).toEqual({ school: "", email1: "", email2: "" })
  })

  it("applies a signed-in account's saved myTeamProfile over the local one on mount", async () => {
    localStorage.setItem("myTeamProfile", JSON.stringify({ school: "Old HS", email1: "old@x.com", email2: "" }))
    stubFetchSignedIn({ myTeamProfile: { school: "New HS", email1: "new@x.com", email2: "partner@x.com" } })

    await renderSection()

    expect(getMyTeamProfile()).toEqual({ school: "New HS", email1: "new@x.com", email2: "partner@x.com" })
  })

  it("keeps the local profile when the account has none saved yet", async () => {
    localStorage.setItem("myTeamProfile", JSON.stringify({ school: "Local HS", email1: "a@x.com", email2: "" }))
    stubFetchSignedIn({ myTeamProfile: null })

    await renderSection()

    expect(getMyTeamProfile()).toEqual({ school: "Local HS", email1: "a@x.com", email2: "" })
  })

  it("keeps an account load failure from blocking the section", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network error")
      }) as unknown as typeof fetch,
    )

    const html = await renderSection()

    expect(html).toContain("My Team")
  })
})

describe("TeamSection school team picker", () => {
  it("pops out a school's teams beside its field, fills the debaters on click, then closes", async () => {
    vi.useFakeTimers()
    stubFetchSignedOut()
    const setNegDebater1 = vi.fn()
    const setNegDebater2 = vi.fn()
    await act(async () => {
      root.render(createElement(TeamSection, baseProps({ negSchool: "Harker", setNegDebater1, setNegDebater2 })))
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })
    vi.useRealTimers()

    const pickers = container.querySelectorAll("[data-testid=school-teams-picker]")
    expect(pickers).toHaveLength(1)
    expect(pickers[0].textContent).toContain("Teams at Harker")

    const team = [...pickers[0].querySelectorAll("button")].find((b) => b.textContent?.includes("Ahuja"))
    await act(async () => team!.click())

    expect(setNegDebater1).toHaveBeenCalledWith("Ahuja")
    expect(setNegDebater2).toHaveBeenCalledWith("Miduthuri")
    expect(container.querySelector("[data-testid=school-teams-picker]")).toBeNull()
  })
})
