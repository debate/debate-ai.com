import type { Metadata } from "next"
import { DebateFlowPage } from "@/components/debate/flow/DebateFlowPage"

export const metadata: Metadata = {
  title: "Debate FIAT",
  description: "Flow Inteconnected Argument Tree",
}

export default function Home() {
  return <DebateFlowPage />
}
