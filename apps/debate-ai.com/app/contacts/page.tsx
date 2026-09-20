import type { Metadata } from "next"
import { ContactsHub } from "@/components/contacts/ContactsHub"
import { ToolPage, ToolPageHeader } from "@/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "Contacts",
  description:
    "Your contacts list — send and accept requests, block users, see who's online, and open the live cards contacts have shared with you",
}

export default function ContactsPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/contacts" backHref="/reason-editor" backLabel="the editor" guide="training-tools" />
      <ContactsHub />
    </ToolPage>
  )
}
