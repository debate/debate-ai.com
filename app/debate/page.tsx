import type { Metadata } from "next"
import { Suspense } from "react"
import { DebateFlowPage } from "@/components/debate/DebateRound/DebateRoundPanel"

export const metadata: Metadata = {
  title: "Debate FIAT",
  description: "Flow Inteconnected Argument Tree",
}

export default function Home() {
  return (
    <Suspense>
      <DebateFlowPage />
    </Suspense>
  )
}
