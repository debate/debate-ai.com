import { Suspense } from "react"
import { FeaturesPanel } from "../../lib/ui/features/FeaturesPanel"
import { SiteFooter } from "../../components/layout/SiteFooter"

export default function FeaturesPage() {
  return (
    // No page padding: the panel's hero is full-bleed, so its aurora backdrop
    // and grid have to reach the edges of the column it is given.
    //
    // The page carries no chrome of its own beyond the footer below. `/` (this
    // page is the app's homepage as well as `/practice/features`) and
    // `/practice/features` are both sidebar routes (`EXTRA_SIDEBAR_HREFS`), so
    // `AppSidebarShell` wraps them in the same dock and nav tree as every
    // surface they catalogue — which is also what replaced the "Back to
    // lectures" pill this page used to float over its hero. It is a page in the
    // app, not a page away from it.
    //
    // The footer is the one piece the sidebar does not provide: the sidebar's
    // own link row lives under the nav tree, in a 300px column, while this is
    // the bottom of a full-width page and previously ended at the catalog with
    // nothing after it.
    <div className="relative flex min-h-screen flex-col bg-background">
      <div className="flex-1">
        <Suspense>
          <FeaturesPanel />
        </Suspense>
      </div>
      <SiteFooter />
    </div>
  )
}