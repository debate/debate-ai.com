import { TournamentsPage } from "./TournamentsPage"

interface PageProps {
  params: Promise<{ slug?: string[] }>
}

/** Every tournament page — the route table lives in `debate-tournaments`. */
export default async function Tournaments({ params }: PageProps) {
  const { slug = [] } = await params
  return <TournamentsPage segments={slug} />
}
