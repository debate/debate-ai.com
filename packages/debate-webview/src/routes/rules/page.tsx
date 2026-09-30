import { ExternalLink, Scale } from "lucide-react"

import { FormatsRulesGuide } from "../../components/rules/FormatsRulesGuide"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

/** The NSDA's official rulebook — the authoritative source behind this guide's NSDA-style summary. */
const NSDA_RULES_URL = "https://docs.google.com/document/d/1hq7-DE6ls2ryVtOttxR4BNpRdP7xUbBr0M3SMYefek8/edit?tab=t.0"

/**
 * Formats & Rules: a reference page for the common high-school formats and
 * the research, evidence, device/AI and per-format rules behind them.
 *
 * Like `/practice/forums`, this is a destination in the sidebar tree rather than an
 * entry in the `/tools` catalog — it is reading material, not a tool — so the
 * header's title, description and icon are passed explicitly.
 */
export default function RulesPage() {
  return (
    <ToolPage className="max-w-5xl">
      <ToolPageHeader
        href="/practice/rules"
        backHref="/tools"
        backLabel="tools"
        title="Debate Formats, Research & Rules"
        description="A one-page reference for the most common high-school debate formats, their key round sections, and the research, evidence, conduct, and format-specific rules students need to know."
        icon={Scale}
        guide="practice-tools"
        actions={
          <a
            href={NSDA_RULES_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="Open the NSDA rulebook (opens in a new tab)"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <ExternalLink className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            NSDA Rules
          </a>
        }
      />
      <FormatsRulesGuide />
    </ToolPage>
  )
}
