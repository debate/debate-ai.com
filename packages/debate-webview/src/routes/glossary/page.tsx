import { RulesAndGlossaryPage } from "../rules/page"

/**
 * Old `/practice/glossary` address: now the Glossary tab of Formats, Rules &
 * Glossary at `/practice/rules`. The Next app redirects it to
 * `/practice/rules?section=glossary`; outside Next this mounts the merged
 * page on that tab.
 */
export default function GlossaryPage() {
  return <RulesAndGlossaryPage initialSection="glossary" />
}
