import Link from "next/link"
import { REFERENCE_QUOTE_STATUS_INFO } from "@debate-ai/help-docs/lib/reference-quote-status"
import { SOURCE_KIND_LABELS } from "@debate-ai/help-docs/lib/reference-display"
import { Badge } from "@debate-ai/webview/ui/primitives/badge"
import type { AuthorCard } from "@/lib/authors/author-queries"

/**
 * The quoted card text keeps its underlining and highlighting, set the way the
 * docs' References cards set it: text that is neither is small and muted, the
 * read parts are full size.
 */
const QUOTE_CLASSES =
  "space-y-2 border-l-[3px] border-border pl-4 text-[0.7rem] leading-relaxed text-muted-foreground " +
  "[&_u]:text-[0.9rem] [&_u]:text-foreground [&_mark]:bg-primary/25 [&_mark]:px-px [&_mark]:text-[0.9rem] [&_mark]:text-foreground"

const ROLE_LABELS: Record<string, string> = { editor: "Editor", director: "Director" }

/** One evidence card on an author's page: the citation, the card's tag, and the collapsible quoted text. */
export function AuthorCardView({ card }: { card: AuthorCard }) {
  const quoteStatus = REFERENCE_QUOTE_STATUS_INFO[card.quoteStatus]
  return (
    <article id={card.anchor} className="scroll-mt-20 rounded-lg border bg-card p-4 text-card-foreground">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary">{SOURCE_KIND_LABELS[card.sourceKind]}</Badge>
        {card.year ? <span>{card.year}</span> : null}
        {ROLE_LABELS[card.role] ? <Badge variant="outline">{ROLE_LABELS[card.role]}</Badge> : null}
        <span>{card.collectionTitle}</span>
      </div>

      <p
        className="mt-2 text-sm leading-relaxed [&_a]:break-all [&_a]:underline"
        // The citation is sanitized when the dataset is built: italics, bold and http(s) links only.
        dangerouslySetInnerHTML={{ __html: card.chicago }}
      />

      {card.summary ? <p className="mt-2 text-sm">{card.summary}</p> : null}

      {card.authorQualification ? (
        <p className="mt-1 text-xs italic text-muted-foreground">{card.authorQualification}</p>
      ) : null}

      {card.coAuthors.length > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          With{" "}
          {card.coAuthors.map((coAuthor, index) => (
            <span key={coAuthor.slug}>
              {index > 0 ? ", " : ""}
              <Link href={`/authors/${coAuthor.slug}`} className="underline">
                {coAuthor.name}
              </Link>
            </span>
          ))}
        </p>
      ) : null}
      {card.etAl ? <p className="mt-1 text-xs text-muted-foreground">The citation lists further authors as “et al.”</p> : null}

      {card.quoteHtml ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium">
            Quoted text{" "}
            <span className="font-normal text-muted-foreground">
              ({card.quoteWordCount.toLocaleString("en-US")} words · {quoteStatus.label})
            </span>
          </summary>
          <div
            className={`${QUOTE_CLASSES} mt-3`}
            // Sanitized when the dataset is built: paragraphs, underline, highlight and emphasis only.
            dangerouslySetInnerHTML={{ __html: card.quoteHtml }}
          />
        </details>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">No card text on the References page yet.</p>
      )}

      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <Link href={`${card.pagePath}#${card.anchor}`} className="underline">
          Card on the References page
        </Link>
        {card.url ? (
          <a href={card.url} className="underline" rel="noopener noreferrer" target="_blank">
            Original source
          </a>
        ) : null}
      </p>

      {card.citedIn.length > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Cited in{" "}
          {card.citedIn.map((page, index) => (
            <span key={page.path}>
              {index > 0 ? ", " : ""}
              <Link href={page.path} className="underline">
                {page.title}
              </Link>
            </span>
          ))}
        </p>
      ) : null}
    </article>
  )
}
