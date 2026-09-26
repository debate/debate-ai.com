"use client"

import { useParams } from "next/navigation"
import { SchoolProfilePage } from "debate-videos"
import { ToolPage } from "../../../components/tools/ToolPageHeader"

/** School profile opened from a Team Rankings row: every ranked entry plus matching videos. */
export default function SchoolProfile() {
  const { school } = useParams<{ school: string }>()
  return (
    <ToolPage>
      <SchoolProfilePage slug={school ?? ""} />
    </ToolPage>
  )
}
