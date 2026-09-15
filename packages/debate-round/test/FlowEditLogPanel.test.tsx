// @vitest-environment jsdom
/**
 * @fileoverview Render test for `FlowEditLogPanel`'s "Logged edits" sync
 * status badge — the same per-record "Synced" / "Not yet synced" indicator
 * `FlowHistoryList.test.tsx` covers for the History tab.
 *
 * Unlike `FlowHistoryList` (handed its data as a prop, so a `node`-environment
 * `renderToStaticMarkup` snapshot is enough — see that test file), this panel
 * loads `listFlowEdits()` itself inside a `useEffect` on mount, which
 * `renderToStaticMarkup` never runs. So this needs a real `jsdom` +
 * `react-dom/client` render (the same pattern `debate-videos`'
 * `glowing-effect-listeners.test.tsx` uses), flushed with `act`, to see the
 * loaded list at all.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createElement } from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"

import { FlowEditLogPanel } from "../src/panels/FlowEditLogPanel"
import type { FlowEdit } from "../src/flow/shared-flow-sync"
import { markToolRecordsSynced, resetToolRecordAutoSync } from "debate-data-sync/src/state/tool-record-auto-sync"

const STORAGE_KEY = "flowEdits"

function makeEdit(overrides: Partial<FlowEdit> = {}): FlowEdit {
  return {
    id: "edit-1",
    flowId: 7,
    boxPath: [0, 1],
    authorId: "alice",
    content: "New 1AC block",
    timestampMs: new Date(2024, 0, 5, 9, 0, 0).getTime(),
    ...overrides,
  }
}

function seedEdits(edits: FlowEdit[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(edits))
}

let container: HTMLDivElement
let root: Root

function renderPanel(): string {
  act(() => {
    root.render(createElement(FlowEditLogPanel))
  })
  return container.innerHTML
}

beforeEach(() => {
  localStorage.clear()
  resetToolRecordAutoSync()
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  localStorage.clear()
  resetToolRecordAutoSync()
})

describe("FlowEditLogPanel sync status badge", () => {
  it("shows no sync badge when the collection has never been baselined", () => {
    // The common case for a signed-out browser, or before the first sync
    // tick has run: neither "synced" nor "not yet synced" would be honest.
    seedEdits([makeEdit()])
    const html = renderPanel()
    expect(html).toContain("New 1AC block")
    expect(html).not.toContain("Synced")
    expect(html).not.toContain("Not yet synced")
  })

  it("badges an edit 'Synced' once its exact value has reached the account", () => {
    const edit = makeEdit()
    seedEdits([edit])
    markToolRecordsSynced("flowEdits")

    const html = renderPanel()

    expect(html).toContain("Synced")
    expect(html).not.toContain("Not yet synced")
  })

  it("badges an edit 'Not yet synced' when it hasn't reached the account", () => {
    // Baselined with nothing in it yet — e.g. right after sign-in, before
    // this edit's first flush.
    seedEdits([])
    markToolRecordsSynced("flowEdits")
    seedEdits([makeEdit()])

    const html = renderPanel()

    expect(html).toContain("Not yet synced")
  })

  it("badges a changed edit 'Not yet synced' even though an earlier value of it landed", () => {
    const original = makeEdit({ content: "New 1AC block" })
    seedEdits([original])
    markToolRecordsSynced("flowEdits")

    seedEdits([{ ...original, content: "New 1AC block, revised" }])

    const html = renderPanel()

    expect(html).toContain("Not yet synced")
  })

  it("renders no badge when there are no logged edits", () => {
    markToolRecordsSynced("flowEdits")
    const html = renderPanel()
    expect(html).toContain("No flow edits yet")
    expect(html).not.toContain("Synced")
    expect(html).not.toContain("Not yet synced")
  })
})
