import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { SpeechSendLogPanel } from "./SpeechSendLogPanel"

export const metadata: Metadata = {
  title: "Speech Documents",
  description: "A history of evidence sent into your designated speech document from the Reason Editor's send-to-speech commands",
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
      <SpeechSendLogPanel />
    </div>
  )
}
