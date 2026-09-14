import type { Metadata } from "next"
import { Suspense } from "react"
import { FeaturesPanel } from "../../lib/ui/features/FeaturesPanel"

export const metadata: Metadata = {
  title: "Features",
  description:
    "Every Debate AI tool for PF, LD and Policy — evidence research and card cutting, flowing, speech and prep timers, judge and opponent scouting, drills and full rounds against an AI — grouped by category and searchable by name, route or keyword",
}

export default function FeaturesPage() {
  return (
    // No page padding: the panel's hero is full-bleed, so its aurora backdrop
    // and grid have to reach the edges of the column it is given.
    //
    // The page carries no chrome of its own. `/features` is one of the
    // sidebar's routes (`EXTRA_SIDEBAR_HREFS`), so `AppSidebarShell` wraps it
    // in the same dock and nav tree as every surface it catalogues — which is
    // also what replaced the "Back to lectures" pill this page used to float
    // over its hero. It is a page in the app, not a page away from it.
    <div className="relative min-h-screen bg-background">
      <Suspense>
        <FeaturesPanel />
      </Suspense>
    </div>
  )
}
