/** @vitest-environment jsdom */
/**
 * @fileoverview AI Coach Mode, one of the round workspace's "Tools for this
 * round" (`FLOW_TOOL_LINKS`), shows the same **Other round tools** row as the
 * other targets, and only on its own tab.
 */
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FLOW_TOOL_LINKS } from "@debate-ai/round/src/round/flow-tool-links"

let search = ""
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search) }))
vi.mock("@debate-ai/practice-rounds", () => ({
  CoachingSessionsPanel: () => <section data-testid="ai-coach-panel" />,
  RoundToolsCrossLinks: ({ currentHref }: { currentHref: string }) => (
    <nav data-testid="cross-links" data-current={currentHref} />
  ),
}))
vi.mock("@debate-ai/team-collaboration", () => ({
  CoachingProgramsPanel: () => <div data-testid="programs" />,
  TeamCalendarPanel: () => <div data-testid="calendar" />,
}))
vi.mock("@debate-ai/speech-writer", () => ({ CoachMaterialsPanel: () => <div data-testid="materials" /> }))
vi.mock("@debate-ai/tournaments/ui", () => ({ TournamentsApp: () => null }))
vi.mock("../../../src/routes/coaching-programs/CoachingProgramRosterAnalyticsWithDrills", () => ({
  CoachingProgramRosterAnalyticsWithDrills: () => null,
}))
vi.mock("../../../src/routes/coaching/laptopless/page", () => ({ default: () => <div data-testid="laptopless" /> }))
vi.mock("../../../src/components/coach/CoachHub", () => ({
  CoachHub: () => <div data-testid="coach-hub" />,
  isCoachStageId: () => false,
}))

import { CoachingWorkspace, coachingHref } from "../../../src/components/coach/CoachingWorkspace"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root | null = null
let host: HTMLDivElement | null = null

function mount(query: string) {
  search = query
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root!.render(<CoachingWorkspace />))
  return host
}

afterEach(() => {
  act(() => root?.unmount())
  host?.remove()
  root = null
  host = null
  search = ""
  localStorage.clear()
})

describe("CoachingWorkspace — Other round tools", () => {
  it("keys the AI Coach Mode row by the same href the Tools for this round menu links to", () => {
    expect(FLOW_TOOL_LINKS.map((link) => link.href)).toContain(coachingHref("ai-coach"))
  })

  it("shows the row above the AI Coach Mode panel, leaving AI Coach Mode itself out", () => {
    const el = mount("section=ai-coach")
    const row = el.querySelector('[data-testid="cross-links"]')
    expect(row?.getAttribute("data-current")).toBe("/coaching?section=ai-coach")
    const panel = el.querySelector('[data-testid="ai-coach-panel"]')
    expect(panel).not.toBeNull()
    // The row comes first in the tab panel.
    expect(row!.compareDocumentPosition(panel!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it.each(["materials", "calendar", "programs", "laptopless"])("does not show the row on the %s tab", (section) => {
    const el = mount(`section=${section}`)
    expect(el.querySelector('[data-testid="cross-links"]')).toBeNull()
  })

  it("does not show the row on the Coach Workspace tab", () => {
    const el = mount("")
    expect(el.querySelector('[data-testid="coach-hub"]')).not.toBeNull()
    expect(el.querySelector('[data-testid="cross-links"]')).toBeNull()
  })
})
