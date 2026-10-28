"use client"

import { ProfileVideosProvider, SchoolProfilePage } from "@debate-ai/rankings/leaderboard"
import { ProfileVideos } from "@debate-ai/videos"
import { SchoolOwnerPanel, useSchoolPageData } from "@debate-ai/rankings/src/schools/ui/SchoolOwnerPanel"

/**
 * School profile for one `@school` handle: every ranked entry plus matching
 * videos, with the owner-managed logo and roster under the name. A school a
 * coach created when claiming it has a page before any ranking lists it.
 */
export function SchoolProfileView({ slug }: { slug: string }) {
  const [data, setData] = useSchoolPageData(slug)
  return (
    <ProfileVideosProvider component={ProfileVideos}>
      <SchoolProfilePage
        slug={slug}
        knownName={data?.name}
        ownerPanel={<SchoolOwnerPanel slug={slug} data={data} onData={setData} />}
      />
    </ProfileVideosProvider>
  )
}
