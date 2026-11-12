/** @vitest-environment jsdom */
/**
 * @fileoverview Settings → Team coaching: the coach-only roster and
 * assignment routes are asked only for a Research Team account, so free and
 * Pro accounts don't log two 403s every time Preferences opens.
 */
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  document.body.innerHTML = ""
  vi.unstubAllGlobals()
})

function stubFetch(tier: string) {
  const urls: string[] = []
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    urls.push(url)
    const body =
      url === "/api/stripe/subscription"
        ? { tier }
        : url === "/api/team/students"
          ? { students: [], max: 10 }
          : url === "/api/team/assignments"
            ? { assignments: [], limits: { lessonPlans: 100, practiceDrills: 200 } }
            : { assignments: [] }
    return new Response(JSON.stringify(body), { status: 200 })
  })
  vi.stubGlobal("fetch", fetch)
  return urls
}

async function mount() {
  const { TeamCoachingSection } = await import("../../../src/components/settings/sections/TeamCoachingSection")
  const host = document.createElement("div")
  document.body.appendChild(host)
  await act(async () => {
    createRoot(host).render(<TeamCoachingSection />)
  })
  // let the load's chained awaits settle
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe("TeamCoachingSection", () => {
  it("skips the coach-only routes for a free account", async () => {
    const urls = stubFetch("free")
    await mount()
    expect(urls).toContain("/api/team/my-assignments")
    expect(urls).not.toContain("/api/team/students")
    expect(urls).not.toContain("/api/team/assignments")
  })

  it("loads the roster and assignments for a Research Team account", async () => {
    const urls = stubFetch("research-team")
    await mount()
    expect(urls).toContain("/api/team/students")
    expect(urls).toContain("/api/team/assignments")
  })
})
