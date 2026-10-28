"use client"

import { SchoolProfilePage } from "@debate-ai/videos"
import { SchoolOwnerPanel, useSchoolPageData } from "./SchoolOwnerPanel"

/**
 * School profile for one `@school` handle: every ranked entry plus matching
 * videos, with the owner-managed logo and roster under the name. A school a
 * coach created when claiming it has a page before any ranking lists it.
 */
export function SchoolProfileView({ slug }: { slug: string }) {
  const [data, setData] = useSchoolPageData(slug)
  return (
    <SchoolProfilePage
      slug={slug}
      knownName={data?.name}
      ownerPanel={<SchoolOwnerPanel slug={slug} data={data} onData={setData} />}
    />
  )
}
