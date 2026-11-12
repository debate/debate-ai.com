import { PracticeDebatesPage } from "../practice-debates/page"

/**
 * Old `/practice/drills` address: now the Practice Drills tab of Practice
 * Debates at `/practice/debates`. The Next app redirects it to
 * `?section=drills`; outside Next this mounts the merged page on that tab.
 */
export default function DrillsPage() {
  return <PracticeDebatesPage initialSection="drills" />
}
