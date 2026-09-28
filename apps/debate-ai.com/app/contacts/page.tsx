import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Contacts",
  description:
    "Your contacts list — send and accept requests, block users, see who's online, and open the live cards contacts have shared with you",
}

export { default } from "debate-webview/routes/contacts/page"
