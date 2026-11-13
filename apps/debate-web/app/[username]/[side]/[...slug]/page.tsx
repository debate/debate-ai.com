import type { Metadata } from "next"
import { titleFromDocSlug } from "@debate-ai/reason-docs/lib/reason-docs/doc-slug"
import { ReasonEditorScreen } from "@debate-ai/reason-docs/editor/ReasonEditorScreen"

interface PageProps {
  params: Promise<{ username: string; side: string; slug: string[] }>
}

/**
 * A personal file's shareable, sellable address —
 * `/<username>/<side>/<slug>` (e.g. `/alexgul/aff/aca-affirmative-msci-2026`).
 *
 * The same editor page as `/reason-editor`; the file the URL names is resolved
 * client-side against the reader's own documents (and the public library) by
 * `ReasonDocsRouteSync`. The username and side are the file's namespace — a
 * shared or sold link names a file, and whichever reader opens it resolves that
 * name against their own library.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const name = titleFromDocSlug(slug.join("/"))
  return {
    title: name ? `${name} — REASON Editor` : "REASON Editor",
    description: "Research Editor for Annotated Summaries in Outline Notation",
  }
}

export { default } from "@debate-ai/webview/routes/personal-docs/[username]/[side]/[...slug]/page"
