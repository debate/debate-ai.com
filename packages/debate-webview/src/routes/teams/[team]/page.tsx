"use client"

import { useParams } from "next/navigation"
import { TeamProfilePage } from "debate-videos"
import { ToolPage } from "../../../components/tools/ToolPageHeader"

/** Team profile opened from a Team Rankings row: ranking stats plus matching videos. */
export default function TeamProfile() {
  const { team } = useParams<{ team: string }>()
  return (
    <ToolPage>
      <TeamProfilePage slug={team ?? ""} />
    </ToolPage>
  )
}
