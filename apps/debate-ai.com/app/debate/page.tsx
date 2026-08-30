import type { Metadata } from "next"
import { Suspense } from "react"
import { DebateFlowPage } from "debate-round"
import { RoundSyncStatus } from "@/components/layout/RoundSyncStatus"

export const metadata: Metadata = {
  title: "Debate FIAT",
  description: "Flow Inteconnected Argument Tree",
}

export const dynamic = "force-dynamic"

export default function Home() {
  return (
    <Suspense>
      <DebateFlowPage />
      <RoundSyncStatus />
    </Suspense>
  )
}
