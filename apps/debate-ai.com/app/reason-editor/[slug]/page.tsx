import type { Metadata } from "next"
import { titleFromDocSlug } from "@/lib/reason-docs/doc-slug"
import { ReasonEditorScreen } from "@/components/reason-editor/ReasonEditorScreen"

interface PageProps {
  params: Promise<{ slug: string }>
}

/**
 * A document addressed by its own name — `/reason-editor/cp-answer-to-states`
 * rather than `/reason-editor?topic=2`.
 *
 * The segment is resolved on the client, against the document list the
 * sidebar has already loaded (`lib/reason-docs/route-selection`): the files
 * are per-reader and the topic-starter catalogue is fetched by the same
 * provider, so there is nothing here for the server to look up. Every
 * segment renders the editor; one that names no file lands on the editor's
 * normal fallback rather than a 404, which is also what an outdated link to a
 * renamed file should do.
 */
export default function ReasonEditorDocumentPage() {
  return <ReasonEditorScreen />
}

/** Names the tab after the file the URL names, best-effort: the slug is all
 *  the server has, so it is un-slugified back into words rather than looked
 *  up. */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const name = titleFromDocSlug(slug)
  return {
    title: name ? `${name} — REASON Editor` : "REASON Editor",
    description: "Research Editor for Annotated Summaries in Outline Notation",
  }
}
