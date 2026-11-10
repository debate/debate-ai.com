import type { Metadata } from "next"
import ChallengesPage from "@debate-ai/webview/routes/challenges/page"

export const metadata: Metadata = {
  title: "Online Challenges",
  description:
    "Challenge another player or the AI to a written debate on any resolution, in any format, and earn XP, win-streak boosts and trophies",
}

/** Online Challenges, the first row of the sidebar's Practice section. */
export default function OnlineChallengesPage() {
  return <ChallengesPage />
}
