import type { Metadata } from "next"
import { titleFromDocSlug } from "@/lib/reason-docs/doc-slug"
import { WorkspaceScreen } from "../WorkspaceScreen"

interface PageProps {
  params: Promise<{ slug: string }>
}

/**
 * A document in the research workspace, addressed by its own name —
 * `/doc/cp-answer-to-states`.
 *
 * The same workspace as `/doc`: which document the name refers to is resolved
 * in the browser (`lib/qwksearch/doc-paths`), because the documents live in
 * the reader's own `localStorage` and the server has nothing to look up. A
 * name that matches no file opens the workspace's usual document rather than
 * 404ing — a renamed or deleted file is a stale link, not an error page.
 */
export default function EditorDocumentPage() {
  return <WorkspaceScreen />
}

/** Names the tab after the document the URL names. The slug is all the server
 *  has — the titles are client-side — so it is un-slugified back into words
 *  rather than looked up. */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const name = titleFromDocSlug(slug)
  return {
    title: name ? `${name} — REASON Docs` : "REASON Docs",
    description: "Research Editor for Annotated Summaries in Outline Notation",
  }
}
