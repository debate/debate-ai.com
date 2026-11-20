"use client"

import { useParams } from "next/navigation"

import { PublisherView } from "@debate-ai/file-market/ui"
import { ToolPage, ToolPageHeader } from "../../../../components/tools/ToolPageHeader"
import { editorHrefForSelection } from "@debate-ai/reason-docs/lib/reason-docs/route-selection"

/** A research publisher's page: who they are, what they've published, and Subscribe. */
export default function ResearchPublisherPage() {
  const { slug } = useParams<{ slug: string }>()

  return (
    <ToolPage>
      <ToolPageHeader
        href="/research/market"
        backHref="/research/market"
        backLabel="the file market"
        title="Research Publisher"
        description="The research group behind these files. Subscribe to save every file they publish."
      />
      <PublisherView slug={slug ?? ""} editorHref={(documentId) => editorHrefForSelection({ kind: "document", id: documentId })} />
    </ToolPage>
  )
}
