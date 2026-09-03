import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { ArrowLeft } from "lucide-react"
import { AccountNotificationsPanel, PrepNoteNotificationsPanel } from "debate-round"

export const metadata: Metadata = {
  title: "Notifications",
  description: "Round invites and other account notifications, plus assignee notifications for prep notes handed off to you as a task",
}

export default function NotificationsPage() {
  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <div className="mb-4">
        <Link
          href="/debate"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-background hover:bg-accent text-sm font-medium text-foreground transition-colors"
          aria-label="Back to debate flow"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>
      <Suspense>
        <AccountNotificationsPanel />
      </Suspense>
      <div className="mt-6 border-t border-border pt-2">
        <Suspense>
          <PrepNoteNotificationsPanel />
        </Suspense>
      </div>
    </div>
  )
}
