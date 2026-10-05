import { ResearchSettingsPage } from "../../../../components/qwksearch/Settings/ResearchSettingsPage"

/**
 * One section of the research agent's settings (`/settings/research/models`),
 * served as its own page so it can be linked to. An unknown section opens the
 * first tab rather than 404ing.
 */
export default async function ResearchSettingsSectionPage({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  const { section } = await params
  return <ResearchSettingsPage section={section} />
}
