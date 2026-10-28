"use client"

import { useParams } from "next/navigation"

import { ListingView } from "@debate-ai/file-market/ui"
import { ToolPage, ToolPageHeader } from "../../../components/tools/ToolPageHeader"
import { editorHrefForSelection } from "../../../lib/reason-docs/route-selection"

/** One file for sale: its free table of contents and the Buy button. */
export default function FileListingPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <ToolPage>
      <ToolPageHeader
        href="/research/market"
        backHref="/research/market"
        backLabel="the file market"
        title="File Market"
        description="Read the table of contents for free; buy the file to unlock every card."
      />
      <ListingView id={id ?? ""} editorHref={(documentId) => editorHrefForSelection({ kind: "document", id: documentId })} />
    </ToolPage>
  )
}
