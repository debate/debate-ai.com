"use client"

import { ProfileVideosProvider, SchoolProfilePage } from "@debate-ai/rankings/leaderboard"
import { ProfileVideos } from "@debate-ai/videos"
import { SchoolOwnerPanel, useSchoolPageData } from "@debate-ai/rankings/src/schools/ui/SchoolOwnerPanel"
import { canonicalSchoolHandle } from "@debate-ai/rankings/src/leaderboard/profile/rankingProfileHelpers"

/**
 * School profile for one `@school` handle: every ranked entry plus matching
 * videos, with the owner-managed logo and roster under the name. A school a
 * coach created when claiming it has a page before any ranking lists it. An
 * older full-name handle (`emory-university`) loads the school's current one
 * (`emory`).
 */
export function SchoolProfileView({ slug: requested }: { slug: string }) {
  const slug = canonicalSchoolHandle(requested)
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
