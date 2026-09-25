import { Suspense } from "react"
import { CommunityHubPageContent } from "./CommunityHubPageContent"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

export default function CommunityHubPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/community-hub" backHref="/cards" backLabel="shared cards" guide="research-collaboration" />
      <Suspense>
        <CommunityHubPageContent />
      </Suspense>
    </ToolPage>
  )
}
