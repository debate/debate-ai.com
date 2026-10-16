import { JudgePoolPanel } from "../../components/judge-pool/JudgePoolPanel"
import { PracticePartnersPanel } from "../../components/practice-partners/PracticePartnersPanel"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

/**
 * Practice Partners: challenge other debaters to a virtual practice round,
 * volunteer to be challenged, and volunteer to judge — with the formats,
 * styles, speed and level you're comfortable with. The same panel is mounted in
 * the Coach workspace's Practice tab; this is its own page, and where every
 * practice-challenge notification links.
 *
 * Below it, the Judge Pool (`#judge-pool`): judges list themselves for hire on
 * circuit-calendar weekends and tournament organizers hire them.
 */
export default function PracticePartnersPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/practice/partners" backHref="/coaching?stage=practice" backLabel="practice" guide="practice-tools" />
      <PracticePartnersPanel />
      <JudgePoolPanel className="mt-4" />
    </ToolPage>
  )
}
