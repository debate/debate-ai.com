"use client"

import { useParams } from "next/navigation"
import { SchoolProfilePage } from "@debate/videos"
import { ToolPage } from "../../../components/tools/ToolPageHeader"
import { SchoolOwnerPanel, useSchoolPageData } from "../../../components/schools/SchoolOwnerPanel"

/**
 * School profile opened from a Team Rankings row: every ranked entry plus
 * matching videos, with the owner-managed logo and roster under the name. A
 * school a coach created when claiming it has a page before any ranking lists it.
 */
export default function SchoolProfile() {
  const { school } = useParams<{ school: string }>()
  const slug = school ?? ""
  const [data, setData] = useSchoolPageData(slug)
  return (
    <ToolPage>
      <SchoolProfilePage
        slug={slug}
        knownName={data?.name}
        ownerPanel={<SchoolOwnerPanel slug={slug} data={data} onData={setData} />}
      />
    </ToolPage>
  )
}
