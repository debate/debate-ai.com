import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("@debate-ai/practice-rounds", () => ({
  VulnerabilityChartsPanel: () => <section data-testid="vulnerability-charts-panel" />,
  RoundToolsCrossLinks: ({ currentHref }: { currentHref: string }) => (
    <nav data-testid="cross-links" data-current={currentHref} />
  ),
}))

import OutcomesPage from "../../../src/routes/outcomes/page"
import { APP_ROUTES } from "../../../src/routes/index"
import { ALL_TOOLS } from "../../../src/routes/tools/tool-groups"

describe("/coaching/outcomes", () => {
  it("is registered in the app's route table", () => {
    const route = APP_ROUTES.find((entry) => entry.pattern === "/coaching/outcomes")
    expect(route).toBeDefined()
  })

  it("loads this page module from the route table", async () => {
    const route = APP_ROUTES.find((entry) => entry.pattern === "/coaching/outcomes")!
    const mod = (await route.load()) as { default: unknown }
    expect(mod.default).toBe(OutcomesPage)
  })

  it("mounts the Response-Outcome Charts panel under a titled header", () => {
    const html = renderToStaticMarkup(<OutcomesPage />)
    expect(html).toContain('data-testid="vulnerability-charts-panel"')
    expect(html).toContain("AI Response-Outcome Charts")
    expect(html).toContain("most exposed")
    expect(html).toContain('href="/debate"')
    expect(html).toContain('data-current="/coaching/outcomes"')
  })

  it("stays out of the /tools catalog, so the header carries its own copy", () => {
    expect(ALL_TOOLS.some((tool) => tool.href === "/coaching/outcomes")).toBe(false)
  })
})
