"use client"

import { useParams } from "next/navigation"
import {
  ProfileHandlePage,
  ProfileTeamMarketsProvider,
  ProfileVideosProvider,
} from "@debate-ai/rankings/leaderboard"
import { TeamRelatedMarkets } from "@debate-ai/predictions/ui"
import { ProfileVideos } from "@debate-ai/videos"
import { ToolPage } from "../../../components/tools/ToolPageHeader"
import { SchoolProfileView } from "../../../components/schools/SchoolProfileView"

/**
 * An `@handle` profile (`/@harker-lin-lee`, `/@michigan`), opened from a Team
 * Rankings row: a team's ranking stats, or a school's when the handle names
 * one, plus matching videos and related prediction markets.
 */
export default function TeamProfile() {
  const { team } = useParams<{ team: string }>()
  const slug = team ?? ""
  return (
    <ToolPage>
      <ProfileVideosProvider component={ProfileVideos}>
        <ProfileTeamMarketsProvider component={TeamRelatedMarkets}>
          <ProfileHandlePage slug={slug} school={<SchoolProfileView slug={slug} />} />
        </ProfileTeamMarketsProvider>
      </ProfileVideosProvider>
    </ToolPage>
  )
}
