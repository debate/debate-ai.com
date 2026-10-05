import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("../../../src/components/tools/ToolSyncBadge", () => ({
  ToolSyncBadge: ({ href }: { href: string }) => <span data-testid="sync-badge" data-href={href} />,
}))

import { ReasonEditorStatusLine } from "../../../src/components/reason-editor/ReasonEditorStatusLine"

describe("ReasonEditorStatusLine", () => {
  it("mounts the sync badge for the /reason-editor collections", () => {
    const html = renderToStaticMarkup(<ReasonEditorStatusLine topicDocument={false} saving={false} />)
    expect(html).toContain('data-href="/reason-editor"')
  })

  it("shows Saving… only while a normal document is being saved", () => {
    expect(renderToStaticMarkup(<ReasonEditorStatusLine topicDocument={false} saving />)).toContain("Saving…")
    expect(renderToStaticMarkup(<ReasonEditorStatusLine topicDocument={false} saving={false} />)).not.toContain(
      "Saving…",
    )
  })

  it("labels a topic starter and never claims it is saving", () => {
    const html = renderToStaticMarkup(<ReasonEditorStatusLine topicDocument saving />)
    expect(html).toContain("Public topic starter")
    expect(html).not.toContain("Saving…")
  })
})
