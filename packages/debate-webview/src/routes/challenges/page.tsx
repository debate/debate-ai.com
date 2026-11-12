import { PracticeDebatesPage } from "../practice-debates/page"

/**
 * Old `/practice/challenges` address: now the Online Challenges tab of
 * Practice Debates at `/practice/debates`. The Next app redirects it; outside
 * Next this mounts the merged page on that tab.
 */
export default function ChallengesPage() {
  return <PracticeDebatesPage initialSection="challenges" />
}
