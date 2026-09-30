import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Tournaments: Invitations, Pairings & Results",
  description: "Upcoming speech and debate tournaments with their invitations, published pairings and results.",
}

export { default } from "debate-webview/routes/tournaments/[[...slug]]/page"
