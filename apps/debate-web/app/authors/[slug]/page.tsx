import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Badge } from "@debate-ai/webview/ui/primitives/badge"
import { getAuthorProfile, listAuthors } from "@/lib/authors/author-repository"
import { absoluteUrl } from "@/lib/seo/site-url"
import { AuthorCardView } from "../_components/author-card"

/** Reads the live tables, so it is rendered per request like the other library pages. */
export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ slug: string }>
}

function decodeSlug(slug: string): string {
  try {
    return decodeURIComponent(slug).toLowerCase()
  } catch {
    return slug.toLowerCase()
  }
}

function yearSpan(first: number | null, last: number | null): string {
  if (!first) return ""
  return first === last ? String(first) : `${first}–${last}`
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const slug = decodeSlug((await params).slug)
  const profile = await getAuthorProfile(slug)
  if (!profile) return { title: "Author not found", robots: { index: false, follow: false } }

  const { author } = profile
  const quoted = author.quoteCount
  const title = `${author.name}: ${author.cardCount} ${author.cardCount === 1 ? "card" : "cards"} cited | Debate AI`
  const description =
    `${author.name}${author.qualifications ? ` (${author.qualifications.replace(/\.$/, "")})` : ""} is cited on ` +
    `${author.cardCount} evidence ${author.cardCount === 1 ? "card" : "cards"} in the Synergy Slayer References` +
    `${quoted ? `, ${quoted} with the quoted text` : ""}.`
  const path = `/authors/${author.slug}`
  return {
    title,
    description: description.slice(0, 300),
    alternates: { canonical: path },
    openGraph: { title, description: description.slice(0, 300), url: path, type: "profile" },
  }
}

/** `<` in JSON-LD would end the script element early. */
function jsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c")
}

export default async function AuthorPage({ params }: PageProps) {
  const slug = decodeSlug((await params).slug)
  const profile = await getAuthorProfile(slug)

  if (!profile) {
    // A name that is not exactly a slug (`/authors/steven-pinker-2`, `/authors/pinker`) still finds people.
    const guess = slug.replace(/-+/g, " ").trim()
    if (guess) {
      const hits = await listAuthors({ q: guess, pageSize: 1 })
      if (hits.total > 0) redirect(`/authors?q=${encodeURIComponent(guess)}`)
    }
    notFound()
  }

  const { author, cards } = profile
  const structuredData = {
    "@context": "https://schema.org",
    "@type": author.kind === "institution" ? "Organization" : "Person",
    name: author.name,
    url: absoluteUrl(`/authors/${author.slug}`),
    ...(author.aliases.length > 0 ? { alternateName: author.aliases } : {}),
    ...(author.qualifications ? { description: author.qualifications } : {}),
    subjectOf: cards.slice(0, 50).map((card) => ({
      "@type": "CreativeWork",
      name: card.title || card.chicagoText,
      ...(card.yearNumber ? { datePublished: String(card.yearNumber) } : {}),
      ...(card.url ? { url: card.url } : {}),
    })),
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />

      <nav className="text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/authors" className="underline">
          Authors
        </Link>
      </nav>

      <header className="mt-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-4xl font-semibold">{author.name}</h1>
          {author.kind === "institution" ? <Badge variant="outline">Organization</Badge> : null}
        </div>
        {author.qualifications ? <p className="mt-2 text-muted-foreground">{author.qualifications}</p> : null}
        {author.aliases.length > 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">Also credited as {author.aliases.join(", ")}.</p>
        ) : null}
        <p className="mt-3 text-sm">
          {author.cardCount} {author.cardCount === 1 ? "card" : "cards"}
          {" · "}
          {author.quoteCount} with quoted text
          {author.firstYear ? ` · cited sources from ${yearSpan(author.firstYear, author.lastYear)}` : ""}
        </p>
      </header>

      <section className="mt-8 space-y-4" aria-label={`Cards by ${author.name}`}>
        {cards.map((card) => (
          <AuthorCardView key={card.id} card={card} />
        ))}
      </section>
    </main>
  )
}
