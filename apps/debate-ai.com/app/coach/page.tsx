import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Coach",
  description:
    "Round coaching workspace: argument tree, flow summary, coaching prompts, drills, scouting, briefings and practice rounds",
}

export { default } from "debate-webview/routes/coach/page"
