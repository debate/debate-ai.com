import { researchSectionForTeamSection, type TeamResearchSectionId } from "../../../components/research/research-section-ids"
import { PrepWorkspacePage } from "../../prep/page"
import { ResearchWorkspacePage } from "../page"

/**
 * Old `/research/team` address. Team Research's tabs merged into the
 * Research Workspace (`/research`) and its Practice Partners tab moved to the
 * Prep Workspace, so outside Next this mounts whichever now holds the tab the
 * URL (or the old route that calls it) names. The Next app redirects instead.
 */
export function TeamResearchPage({ initialSection }: { initialSection?: TeamResearchSectionId | "partners" }) {
  const section =
    initialSection ??
    (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("section"))
  if (section === "partners") return <PrepWorkspacePage initialSection="partners" />
  return <ResearchWorkspacePage initialSection={researchSectionForTeamSection(section) ?? undefined} />
}

export default function TeamResearchRoute() {
  return <TeamResearchPage />
}
