import { Suspense } from "react"
import { ViewerDebateFlowPage } from "../../components/round/ViewerDebateFlowPage"

export default function Home() {
  return (
    <Suspense>
      <ViewerDebateFlowPage />
    </Suspense>
  )
}
