import type { Metadata } from "next"
import Link from "next/link"
import { Badge } from "@debate-ai/webview/ui/primitives/badge"
import { Button } from "@debate-ai/webview/ui/primitives/button"
import { Input } from "@debate-ai/webview/ui/primitives/input"
import { listAuthors } from "@/lib/authors/author-repository"
import { DEFAULT_AUTHOR_PAGE_SIZE } from "@/lib/authors/author-queries"

/** The index reads the live table, so it is rendered per request like the other library pages. */
export const dynamic = "force-dynamic"

interface PageProps {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? ""

function parseParams(raw: { q?: string | string[]; page?: string | string[] }) {
  const q = first(raw.q).trim().slice(0, 100)
  const page = Number.parseInt(first(raw.page), 10)
  return { q, page: Number.isFinite(page) && page > 0 ? page : 1 }
}

function indexHref(q: string, page: number) {
  const params = new URLSearchParams()
  if (q) params.set("q", q)
  if (page > 1) params.set("page", String(page))
  const query = params.toString()
  return query ? `/authors?${query}` : "/authors"
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { q, page } = parseParams(await searchParams)
  const title = "Authors cited in the References | Debate AI"
  const description =
    "Every author whose evidence is cited in Debate AI's Synergy Slayer papers, ranked by how many cards they have, with the cards and quoted text."
  return {
    title,
    description,
    alternates: { canonical: "/authors" },
    openGraph: { title, description, url: "/authors", type: "website" },
    // Search results and later pages are views of the one index, not pages of their own.
    ...(q || page > 1 ? { robots: { index: false, follow: true } } : {}),
  }
}

export default async function AuthorsPage({ searchParams }: PageProps) {
  const { q, page: requestedPage } = parseParams(await searchParams)
  const result = await listAuthors({ q, page: requestedPage, pageSize: DEFAULT_AUTHOR_PAGE_SIZE })
  const firstRank = (result.page - 1) * result.pageSize

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-4xl font-semibold">Authors</h1>
      <p className="mt-3 text-muted-foreground">
        {result.overview.authors.toLocaleString("en-US")} authors are cited across{" "}
        {result.overview.citations.toLocaleString("en-US")} evidence cards in the References pages of the Synergy Slayer papers;{" "}
        {result.overview.citationsWithQuotes.toLocaleString("en-US")} of the cards carry the quoted text. Ranked by cards, then by cards with quoted text.
      </p>

      <form action="/authors" method="get" role="search" className="mt-6 flex gap-2">
        <Input type="search" name="q" defaultValue={q} placeholder="Search by author name" aria-label="Search authors by name" maxLength={100} />
        <Button type="submit">Search</Button>
        {q ? (
          <Button asChild variant="outline">
            <Link href="/authors">Clear</Link>
          </Button>
        ) : null}
      </form>

      <h2 className="mt-8 text-lg font-medium">
        {q ? `${result.total.toLocaleString("en-US")} ${result.total === 1 ? "author matches" : "authors match"} “${q}”` : "Top authors"}
      </h2>

      {result.authors.length === 0 ? (
        <p className="mt-4 text-muted-foreground">No author matches that name. Try just a last name.</p>
      ) : (
        <ol className="mt-4 divide-y rounded-lg border" start={firstRank + 1}>
          {result.authors.map((author, index) => (
            <li key={author.id} className="flex items-start gap-4 p-4">
              <span className="w-8 shrink-0 pt-0.5 text-right text-sm tabular-nums text-muted-foreground">{firstRank + index + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/authors/${author.slug}`} className="font-medium hover:underline">
                    {author.name}
                  </Link>
                  {author.kind === "institution" ? <Badge variant="outline">Organization</Badge> : null}
                </div>
                {author.qualifications ? (
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{author.qualifications}</p>
                ) : null}
              </div>
              <div className="shrink-0 text-right text-sm tabular-nums">
                <div>
                  {author.cardCount} {author.cardCount === 1 ? "card" : "cards"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {author.quoteCount} with quotes
                  {author.firstYear ? ` · ${author.firstYear === author.lastYear ? author.firstYear : `${author.firstYear}–${author.lastYear}`}` : ""}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {result.totalPages > 1 ? (
        <nav className="mt-6 flex items-center justify-between text-sm" aria-label="Pagination">
          {result.page > 1 ? (
            <Link href={indexHref(q, result.page - 1)} rel="prev" className="underline">
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">
            Page {result.page} of {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={indexHref(q, result.page + 1)} rel="next" className="underline">
              Next
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </main>
  )
}
