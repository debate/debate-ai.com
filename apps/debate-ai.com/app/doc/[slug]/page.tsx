import type { Metadata } from "next"
import { titleFromDocSlug } from "debate-ai-webui/lib/reason-docs/doc-slug"

interface PageProps {
  params: Promise<{ slug: string }>
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

export { default } from "debate-ai-webui/routes/doc/[slug]/page"
