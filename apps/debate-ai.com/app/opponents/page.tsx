import type { Metadata } from "next"
import { Suspense } from "react"
import { OpponentTeamProfilesPanel } from "debate-round"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "Opponent Team Profiles",
  description: "Records, side-record tendencies, and common arguments/cases for every saved opponent scouting profile",
}

export default function OpponentsPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/opponents" backHref="/debate" backLabel="round workspace" guide="training-tools" />
      <Suspense>
        <OpponentTeamProfilesPanel />
      </Suspense>
    </ToolPage>
  )
}
