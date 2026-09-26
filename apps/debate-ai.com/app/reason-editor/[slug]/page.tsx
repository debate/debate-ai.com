import type { Metadata } from "next"
import { titleFromDocSlug } from "debate-webview/lib/reason-docs/doc-slug"

interface PageProps {
  params: Promise<{ slug: string }>
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

export { default } from "debate-webview/routes/reason-editor/[slug]/page"
