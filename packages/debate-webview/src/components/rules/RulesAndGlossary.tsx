"use client"

/**
 * @fileoverview Formats, Rules & Glossary — the formats-and-rules reference
 * and the glossary of debate terms on one tabbed page at `/practice/rules`,
 * behind one sidebar row.
 *
 * They used to be two Insights rows: "Formats & Rules" at `/practice/rules`
 * and "Glossary of Terms" at `/practice/glossary` (a view of the video
 * library page). Both are reading material on how debate works, so they now
 * sit side by side as one tab each. `/practice/glossary` redirects here with
 * `?section=glossary`.
 *
 * Navigation only, on the same tab strip and `?section=` URL sync as News &
 * Forums (`components/news/NewsAndForums.tsx`).
 *
 * @module components/rules/RulesAndGlossary
 */

import { BookOpen, Scale } from "lucide-react"
import { DictionaryPanel } from "@debate/videos/panels/dictionary/DictionaryPanel"
import { FormatsRulesGuide } from "./FormatsRulesGuide"
import { panel, type HubSection } from "../hubs/hub-sections"
import { HubSectionIntro, HubSectionNav, HubSectionPanel, useHubSection } from "../hubs/HubSectionNav"

/** localStorage key remembering the last open tab. */
const SECTION_KEY = "rulesAndGlossarySection"

/** One tab per reference. Also the `?section=` values. */
export type RulesAndGlossarySectionId = "rules" | "glossary"

/** The page's tabs: the formats and rules first, then the terminology. */
export const RULES_AND_GLOSSARY_SECTIONS: readonly HubSection<RulesAndGlossarySectionId>[] = [
  {
    id: "rules",
    label: "Formats & Rules",
    icon: Scale,
    description: "The most common high-school debate formats, their key round sections, and the research, evidence, conduct, and format-specific rules students need to know.",
    guide: "practice-tools",
    panels: [panel("Formats & Rules")],
  },
  {
    id: "glossary",
    label: "Glossary",
    icon: BookOpen,
    description: "Definitions of 200+ debate terms. Search matches both the term and its definition.",
    guide: "practice-tools",
    panels: [panel("Glossary of Terms")],
  },
]

/**
 * The Formats, Rules & Glossary URL for one tab.
 *
 * @param section - The tab to open.
 */
export function rulesAndGlossaryHref(section: RulesAndGlossarySectionId): string {
  return section === "rules" ? "/practice/rules" : `/practice/rules?section=${section}`
}

/** Props for {@link RulesAndGlossary}. */
export interface RulesAndGlossaryProps {
  /** Tab to open when the URL names none (the old route's tab, outside Next). */
  initialSection?: RulesAndGlossarySectionId
}

/**
 * Tabbed page over the formats-and-rules guide and the glossary.
 *
 * @param props - See {@link RulesAndGlossaryProps}.
 */
export function RulesAndGlossary({ initialSection }: RulesAndGlossaryProps) {
  const [section, setSection] = useHubSection(RULES_AND_GLOSSARY_SECTIONS, SECTION_KEY, initialSection)
  const active = RULES_AND_GLOSSARY_SECTIONS.find((entry) => entry.id === section) ?? RULES_AND_GLOSSARY_SECTIONS[0]

  return (
    <div className="flex flex-col gap-4">
      <HubSectionNav
        sections={RULES_AND_GLOSSARY_SECTIONS}
        active={section}
        onChange={setSection}
        label="Formats, rules and glossary"
        showPanelCounts={false}
      />
      <HubSectionIntro section={active} />
      <HubSectionPanel id={section}>
        {section === "rules" ? <FormatsRulesGuide /> : null}
        {section === "glossary" ? <DictionaryPanel /> : null}
      </HubSectionPanel>
    </div>
  )
}

export default RulesAndGlossary
