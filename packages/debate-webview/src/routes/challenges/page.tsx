import { ChallengesPanel } from "@debate-ai/practice-rounds"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

/**
 * `/practice/challenges` — Online Challenges: written debates against other
 * players or the AI on any listed resolution, with XP, win-streak boosts and
 * trophies. First row of the sidebar's Practice section.
 */
export default function ChallengesPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/practice/challenges" backHref="/practice/versus-ai" backLabel="practice vs AI" guide="practice-tools" />
      <ChallengesPanel />
    </ToolPage>
  )
}
