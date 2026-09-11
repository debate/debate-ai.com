/**
 * @fileoverview Covers the boundary that keeps one broken chrome component
 * from 500-ing a route.
 *
 * The regression this encodes is real: `ReferenceError: useMemo is not
 * defined` in `ReasonDocsSidebarPanels` took every `/cards/*` route and
 * `/reason-editor` down to a 500 with no shell, no sidebar and no page,
 * because the sidebar renders from the root layout and the app had no error
 * boundary anywhere. The assertions that matter are therefore about the
 * *server* render — that is where a component mistake became a Worker 500.
 *
 * These render through `renderToReadableStream`, the streaming renderer the
 * Worker actually serves with, and not the legacy `renderToString`/
 * `renderToStaticMarkup` pair: those are synchronous and rethrow past a
 * boundary rather than rendering its fallback, so a passing test written
 * against them would say nothing about production.
 *
 * `renders nothing but its fallback when the whole region throws` is the one
 * that would have caught the original bug, and `fails the server render with
 * no boundary at all` is its control: same tree, no wrapper, stream rejected.
 */

import { renderToReadableStream } from "react-dom/server.browser"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ChromeErrorBoundary } from "../ui/layout/chrome-error-boundary"

/** Stands in for a sidebar panel that references a name it never imported. */
function Exploding(): React.ReactElement {
  throw new ReferenceError("useMemo is not defined")
}

/** The shape that matters: a failing region with working chrome beside it. */
function Sidebar({ children }: { children: React.ReactNode }) {
  return (
    <aside>
      {children}
      <nav>tool tree</nav>
    </aside>
  )
}

/** Renders as the Worker does, and resolves the complete HTML. */
async function renderServerHtml(element: React.ReactElement): Promise<string> {
  const stream = await renderToReadableStream(element)
  await stream.allReady
  return new Response(stream).text()
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("ChromeErrorBoundary", () => {
  it("renders its children when nothing throws", async () => {
    // Suspense markers (`<!--$-->`) sit around the content; the content
    // itself has to come through untouched.
    await expect(
      renderServerHtml(
        <ChromeErrorBoundary label="Panels">
          <p>docs panels</p>
        </ChromeErrorBoundary>,
      ),
    ).resolves.toContain("<p>docs panels</p>")
  })

  it("keeps the surrounding chrome rendering when a region throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})

    const html = await renderServerHtml(
      <Sidebar>
        <ChromeErrorBoundary label="ReasonDocsSidebarPanels" fallback={<p>panels unavailable</p>}>
          <Exploding />
        </ChromeErrorBoundary>
      </Sidebar>,
    )

    // The sidebar and the panel beside the broken one both survive — this is
    // the whole point, and it is what a 500 took away.
    expect(html).toContain("<aside>")
    expect(html).toContain("tool tree")
    expect(html).toContain("panels unavailable")
  })

  /**
   * The control for the test above: without the wrapper, the same tree fails
   * the render outright — and a server render that fails is the 500.
   */
  it("fails the server render with no boundary at all", async () => {
    await expect(
      renderServerHtml(
        <Sidebar>
          <Exploding />
        </Sidebar>,
      ),
    ).rejects.toThrow("useMemo is not defined")
  })

  it("renders nothing but its fallback when the whole region throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})

    await expect(
      renderServerHtml(
        <ChromeErrorBoundary label="ToolNavTree" fallback={<nav>Navigation unavailable</nav>}>
          <Exploding />
        </ChromeErrorBoundary>,
      ),
    ).resolves.toContain("<nav>Navigation unavailable</nav>")
  })

  it("omits a region with no fallback rather than failing around it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})

    const html = await renderServerHtml(
      <Sidebar>
        <ChromeErrorBoundary label="PersistentVideoPlayer">
          <Exploding />
        </ChromeErrorBoundary>
      </Sidebar>,
    )

    expect(html).toContain("tool tree")
  })
})
