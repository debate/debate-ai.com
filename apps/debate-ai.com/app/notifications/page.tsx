import type { Metadata } from "next"
import { Suspense } from "react"
import { AccountNotificationsPanel, PrepNoteNotificationsPanel } from "debate-team-collaboration"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "Notifications",
  description: "Round invites and other account notifications, plus assignee notifications for prep notes handed off to you as a task",
}

export default function NotificationsPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/notifications" backHref="/debate" backLabel="debate flow" guide="training-tools" />
      <Suspense>
        <AccountNotificationsPanel />
      </Suspense>
      <div className="mt-6 border-t border-border pt-2">
        <Suspense>
          <PrepNoteNotificationsPanel />
        </Suspense>
      </div>
    </ToolPage>
  )
}
