import { Suspense } from "react"
import { DebateFlowPage } from "debate-round"

export default function Home() {
  return (
    <Suspense>
      <DebateFlowPage />
    </Suspense>
  )
}
