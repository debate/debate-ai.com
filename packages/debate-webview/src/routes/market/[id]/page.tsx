"use client"

import { useParams } from "next/navigation"

import { ListingView } from "../../../components/market/ListingView"
import { ToolPage, ToolPageHeader } from "../../../components/tools/ToolPageHeader"

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
      <ListingView id={id ?? ""} />
    </ToolPage>
  )
}
