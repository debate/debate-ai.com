// @vitest-environment jsdom
/**
 * @fileoverview Render test for `UserSettingsPanel` — the debate
 * style/font size/font family/colour theme/light-dark form that
 * `packages/debate-help-docs/content/docs/features/user-settings.mdx`'s
 * "What it no longer shows" flagged as having lost its only surface when
 * `/settings` became the CardMirror editor's settings page. The panel
 * itself was never touched by that migration — it just stopped being
 * mounted anywhere — so this pins that it still renders every field and
 * still applies a signed-in account's saved `debateStyle`/`fontSize` back
 * into the local store on mount, now that `app/settings/preferences/page.tsx`
 * and the dock's "Debate Preferences" row (`components/layout/CategoryDock.tsx`)
 * give it somewhere to run.
 *
 * Loads `fetchUserSettings()` inside a `useEffect` on mount, so — like
 * `FlowEditLogPanel.test.tsx` — this needs a real `jsdom` + `react-dom/client`
 * render flushed with `act`, not `renderToStaticMarkup`. Radix `Select`'s
 * displayed value only reflects an item that has actually mounted inside an
 * opened dropdown, so assertions here stick to always-rendered text (labels,
 * hint copy, the signed-in/out status line) rather than a Select's current
 * selection.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"

import { UserSettingsPanel } from "../src/panels/UserSettingsPanel"
import { readLocalUserSettings } from "../src/state/userSettings"
import { settings } from "../src/state/settings"

let container: HTMLDivElement
let root: Root

async function renderPanel(): Promise<string> {
  await act(async () => {
    root.render(createElement(UserSettingsPanel))
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
  // Reset the module-level `settings` singleton (shared across every test
  // file that imports `debate-round`) back to its defaults so a prior
  // test's applied values can't leak into this one.
  settings.setValue("debateStyle", 0)
  settings.setValue("fontSize", 14)
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  localStorage.clear()
  settings.setValue("debateStyle", 0)
  settings.setValue("fontSize", 14)
  vi.unstubAllGlobals()
})

describe("UserSettingsPanel", () => {
  it("renders the debate style, font size, font family, colour theme and light/dark mode rows", async () => {
    stubFetchSignedOut()
    const html = await renderPanel()

    expect(html).toContain("Debate style")
    expect(html).toContain("Font size")
    expect(html).toContain("Font family")
    expect(html).toContain("Color theme")
    expect(html).toContain("Light / dark mode")
    // The one field that never reaches the account, per `fontSettings.ts`.
    expect(html).toContain("this one isn't saved to your account")
  })

  it("shows the local-only status line when signed out", async () => {
    stubFetchSignedOut()
    const html = await renderPanel()

    expect(html).toContain("Signed out — changes apply to this browser only.")
    expect(html).not.toContain("Signed in — changes sync to your account.")
  })

  it("applies a signed-in account's saved debateStyle/fontSize back into the local store on mount", async () => {
    stubFetchSignedIn({ debateStyle: 3, fontSize: 18, colorTheme: "cyberpunk", themeMode: "dark" })

    const html = await renderPanel()

    expect(html).toContain("Signed in — changes sync to your account.")
    // This is exactly the data flow the missing UI surface had orphaned:
    // an account's already-stored preference reaching the local editor
    // state that `DebateRoundPanel`/`SpeechHeaderBar`/`useFlowEffects` read.
    expect(readLocalUserSettings()).toEqual({ debateStyle: 3, fontSize: 18 })
  })

  it("keeps an account load failure from blocking the form", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network error")
      }) as unknown as typeof fetch,
    )

    const html = await renderPanel()

    expect(html).toContain("Debate style")
    expect(html).toContain("Signed out — changes apply to this browser only.")
  })
})
