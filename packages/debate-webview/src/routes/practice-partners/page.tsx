import { PracticeDebatesPage } from "../practice-debates/page"

/**
 * Old `/practice/partners` address: now the Practice Partners tab (with the
 * Judge Pool below it) of Practice Debates at `/practice/debates`. The Next
 * app redirects it to `?section=partners`; outside Next this mounts the merged
 * page on that tab.
 */
export default function PracticePartnersPage() {
  return <PracticeDebatesPage initialSection="partners" />
}
