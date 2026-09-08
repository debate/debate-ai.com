import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ContactsHub } from "@/components/contacts/ContactsHub"

export const metadata: Metadata = {
  title: "Contacts",
  description:
    "Your contacts list — send and accept requests, block users, see who's online, and open the live cards contacts have shared with you",
}

export default function ContactsPage() {
  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <div className="mb-4 max-w-2xl mx-auto px-4 sm:px-6">
        <Link
          href="/reason-editor"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-background hover:bg-accent text-sm font-medium text-foreground transition-colors"
          aria-label="Back to the editor"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>
      <ContactsHub />
    </div>
  )
}
