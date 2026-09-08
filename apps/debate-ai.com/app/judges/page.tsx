import type { Metadata } from "next"
import { Suspense } from "react"
import { JudgeProfilesPanel } from "debate-speech-writer"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "Judge Profiles",
  description: "Side-vote bias, average speaker points, and tendencies for every saved judge profile",
}

export default function JudgesPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/judges" backHref="/debate" backLabel="round workspace" guide="training-tools" />
      <Suspense>
        <JudgeProfilesPanel />
      </Suspense>
    </ToolPage>
  )
}
