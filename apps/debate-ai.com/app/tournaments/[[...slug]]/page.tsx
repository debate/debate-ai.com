import type { Metadata } from "next"
import { TournamentsPage } from "./TournamentsPage"

export const metadata: Metadata = {
  title: "Tournaments: Invitations, Pairings & Results",
  description: "Upcoming speech and debate tournaments with their invitations, published pairings and results.",
}

interface PageProps {
  params: Promise<{ slug?: string[] }>
}

/** Every tournament page — the route table lives in `debate-tournaments`. */
export default async function Tournaments({ params }: PageProps) {
  const { slug = [] } = await params
  return <TournamentsPage segments={slug} />
}
