import { researchSectionForTeamSection, type TeamResearchSectionId } from "../../../components/research/research-section-ids"
import PracticePartnersPage from "../../practice-partners/page"
import { ResearchWorkspacePage } from "../page"

/**
 * Old `/research/team` address. Team Research's tabs merged into the
 * Research Workspace (`/research`) and its Practice Partners tab became its own
 * page (`/practice/partners`), so outside Next this mounts whichever now holds the tab the
 * URL (or the old route that calls it) names. The Next app redirects instead.
 */
export function TeamResearchPage({ initialSection }: { initialSection?: TeamResearchSectionId | "partners" }) {
  const section =
    initialSection ??
    (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("section"))
  if (section === "partners") return <PracticePartnersPage />
  return <ResearchWorkspacePage initialSection={researchSectionForTeamSection(section) ?? undefined} />
}

export default function TeamResearchRoute() {
  return <TeamResearchPage />
}
