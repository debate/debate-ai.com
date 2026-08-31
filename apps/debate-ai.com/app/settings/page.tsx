import type { Metadata } from "next"
import { Suspense } from "react"
import { SettingsPanel } from "debate-round"

export const metadata: Metadata = {
  title: "Settings",
  description: "App preferences, synced to your account when signed in",
}

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <Suspense>
        <SettingsPanel />
      </Suspense>
    </div>
  )
}
