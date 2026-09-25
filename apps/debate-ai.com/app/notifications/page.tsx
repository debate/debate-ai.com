import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Notifications",
  description: "Round invites and other account notifications, plus assignee notifications for prep notes handed off to you as a task",
}

export { default } from "debate-ai-webui/routes/notifications/page"
