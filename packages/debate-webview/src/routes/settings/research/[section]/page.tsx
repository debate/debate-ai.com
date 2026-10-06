import { redirect } from "next/navigation"
import { legacyResearchSettingsRedirect } from "../../../../lib/qwksearch/settings-paths"

/**
 * `/settings/research/<section>` — one section of the research agent's
 * settings used to be its own page here. Each is a tab of `/settings` now
 * (`/settings?category=research-<section>`), so this route only redirects
 * there; `editor-<tab>` sections go to the card editor's tab, and an unknown
 * section opens the first research tab rather than 404ing.
 */
export default async function ResearchSettingsSectionPage({
  params,
}: {
  params: Promise<{ section: string }>
}): Promise<never> {
  const { section } = await params
  redirect(legacyResearchSettingsRedirect(section))
}
