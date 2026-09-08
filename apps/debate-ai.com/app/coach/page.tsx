import type { Metadata } from "next"
import { Suspense } from "react"
import { CoachHub } from "@/components/coach/CoachHub"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "Coach",
  description:
    "Round coaching workspace: argument tree, flow summary, coaching prompts, drills, scouting, briefings and practice rounds",
}

export default function CoachPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/coach" backHref="/debate" backLabel="round workspace" guide="training-tools" />
      <Suspense>
        <CoachHub />
      </Suspense>
    </ToolPage>
  )
}
