import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { ArrowLeft } from "lucide-react"
import { SpeechDocumentsPanel } from "reason-editor"

export const metadata: Metadata = {
  title: "Speech Documents",
  description: "Evidence sent from the Reason editor (Ctrl/Cmd+Shift+S or the →Speech toolbar button) toward the speech you're building",
}

export default function SpeechDocumentsPage() {
  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <div className="mb-4">
        <Link
          href="/reason-editor"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-background hover:bg-accent text-sm font-medium text-foreground transition-colors"
          aria-label="Back to Reason editor"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>
      <Suspense>
        <SpeechDocumentsPanel />
      </Suspense>
    </div>
  )
}
