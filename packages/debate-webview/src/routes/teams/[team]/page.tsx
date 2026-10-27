"use client"

import { useParams } from "next/navigation"
import { ProfileHandlePage } from "@debate-ai/videos"
import { ToolPage } from "../../../components/tools/ToolPageHeader"
import { SchoolProfileView } from "../../../components/schools/SchoolProfileView"

/**
 * An `@handle` profile (`/@harker-ll`, `/@michigan`), opened from a Team
 * Rankings row: a team's ranking stats, or a school's when the handle names
 * one, plus matching videos.
 */
export default function TeamProfile() {
  const { team } = useParams<{ team: string }>()
  const slug = team ?? ""
  return (
    <ToolPage>
      <ProfileHandlePage slug={slug} school={<SchoolProfileView slug={slug} />} />
    </ToolPage>
  )
}
