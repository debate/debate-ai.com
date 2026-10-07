import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Team Calendar",
  description: "Schedule research tasks, assignments, deadlines and group-only virtual tournaments for each group you coach",
}

export { default } from "@debate/webview/routes/team-calendar/page"
