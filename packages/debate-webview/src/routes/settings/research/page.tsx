import { redirect } from "next/navigation"
import { legacyResearchSettingsRedirect } from "@debate-ai/qwksearch/lib/settings-paths"

/**
 * `/settings/research` — the research agent's settings used to be a page of
 * their own here. They are tabs of `/settings` now, so this route only
 * redirects to the first of them, keeping old links and bookmarks working.
 */
export default function ResearchSettingsIndexPage(): never {
  redirect(legacyResearchSettingsRedirect())
}
