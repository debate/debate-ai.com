/**
 * @fileoverview Both video library routes (`/videos` and `/videos/[category]`)
 * hand the library the account-sync badge, scoped to the `/videos` collections.
 */

import { describe, it, expect, vi } from "vitest"
import { isValidElement, type ReactElement, type ReactNode } from "react"

const lecturesPage = vi.fn((_props: Record<string, unknown>) => null)
vi.mock("@debate/videos", () => ({ LecturesPage: (props: Record<string, unknown>) => lecturesPage(props) }))
vi.mock("../../src/components/tools/ToolSyncBadge", () => ({ ToolSyncBadge: () => null }))
vi.mock("../../src/components/layout/CategoryDock", () => ({ CategoryDock: () => null }))

const { default: VideosHome } = await import("../../src/routes/videos/page")
const { default: VideosCategory } = await import("../../src/routes/videos/[category]/page")

/** Finds the `LecturesPage` element in a route's returned tree and returns its props. */
function lecturesProps(node: ReactNode): Record<string, unknown> | null {
  if (!isValidElement(node)) return null
  const el = node as ReactElement<{ children?: ReactNode } & Record<string, unknown>>
  if ((el.type as { name?: string }).name === "LecturesPage" || "headerActionsSlot" in el.props) return el.props
  const kids = Array.isArray(el.props.children) ? el.props.children : [el.props.children]
  for (const kid of kids) {
    const found = lecturesProps(kid)
    if (found) return found
  }
  return null
}

describe.each([
  ["/videos", VideosHome],
  ["/videos/[category]", VideosCategory],
])("%s", (_name, Page) => {
  it("passes a sync badge for /videos as the header actions", () => {
    const props = lecturesProps((Page as () => ReactElement)())
    const slot = props?.headerActionsSlot
    expect(isValidElement(slot)).toBe(true)
    expect((slot as ReactElement<{ href: string }>).props.href).toBe("/videos")
  })
})
