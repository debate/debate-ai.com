import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { titleFromDocSlug } from "@debate-ai/reason-docs/lib/reason-docs/doc-slug"
import { isUsername } from "@debate-ai/reason-docs/lib/reason-docs/personal-doc-paths"
import PersonalDocsPage from "@debate-ai/webview/routes/personal-docs/[username]/[...path]/page"

interface PageProps {
  params: Promise<{ username: string; path: string[] }>
}

/**
 * A personal file's address — `/<username>/<folder path>/<doc slug>`
 * (e.g. `/alexgul/aff/k-aff-answers`), see
 * `@debate-ai/reason-docs/lib/reason-docs/personal-doc-paths`.
 *
 * The same editor page as `/reason-editor`; the file the URL names is resolved
 * client-side against the reader's own documents (and the public library) by
 * `ReasonDocsRouteSync`. A first segment that isn't a username — a page's own
 * name, like `/practice/<unknown>`, which Next would otherwise hand to this
 * route — is a 404.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { path } = await params
  const name = titleFromDocSlug(path.at(-1) ?? "")
  return {
    title: name ? `${name} — REASON Editor` : "REASON Editor",
    description: "Research Editor for Annotated Summaries in Outline Notation",
  }
}

export default async function Page({ params }: PageProps) {
  const { username } = await params
  if (!isUsername(username)) notFound()
  return <PersonalDocsPage />
}
