"use client"
/**
 * @file reference-reading-mode.tsx
 * @description The "Reading mode" icon button in the row at the top of every card in the
 * References side panel (`references-panel.tsx`), and the reader it opens: the
 * same reading mode modal as the Synergy Slayer pages (`reading-mode-frame.tsx`
 * — highlighting, Voice, Questions, Ask AI, Export), showing the source
 * article itself instead of the quoted card.
 *
 * The article comes from the app's `GET /api/reference-article`
 * (`REFERENCE_ARTICLE_ENDPOINT`), which reads the entry's own link when it has
 * one and otherwise searches for the entry's title and author with quick
 * search, and only returns a page that agrees with the entry (see
 * `apps/debate-web/lib/reference-article/resolve.ts`). The reader never shows
 * an article silently: a banner above the text always says which address it
 * was read from and how it was found, and that a page found by search should
 * be checked. When nothing can be read, the reader says so and offers the
 * cited link, a Google search and a quick search to try by hand, and lists any
 * unconfirmed search hits as plain links.
 *
 * The article's markup is sanitized here (`sanitizeArticleHtml`) before it is
 * shown. Answers are remembered for the page's lifetime.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { AlertTriangle, BookOpen, ExternalLink, RotateCw, Search } from "lucide-react"
import { sanitizeArticleHtml } from "@debate-ai/reading-mode/article-html"
import {
  describeReferenceCitation,
  referenceSearchQueries,
  type ReferenceArticle,
  type ReferenceArticleResponse,
  type ReferenceDescription,
} from "@debate-ai/reading-mode/references"
import { ReadingModeFrame } from "./reading-mode-frame"
import { ReferenceIconButton } from "./reference-icon-button"
import type { ReferenceItem } from "./references-panel-items"

/** The app route that finds and reads a reference's article. */
export const REFERENCE_ARTICLE_ENDPOINT = "/api/reference-article"
/** Longer than the server's own time budget, so its answer is the one shown. */
const CLIENT_TIMEOUT_MS = 55_000
/** Questions see this much of an article (the extension sends 15,000). */
const ARTICLE_MAX_CHARS = 30_000

/** Marks the button, so tests and the panel can find it. */
export const REFERENCE_READING_MODE_ATTRIBUTE = "data-reference-reading-mode"

/** What the panel knows of one entry, as the fields a search needs. */
export function describeItem(item: Pick<ReferenceItem, "citation" | "authors" | "year" | "label">): ReferenceDescription {
  return describeReferenceCitation(item.citation, {
    authors: item.authors,
    year: item.year || item.label.match(/\d{4}/)?.[0] || "",
  })
}

/** The request for an entry's article: the fields the server uses, empty ones left out. */
export function referenceArticleRequest(ref: ReferenceDescription): string {
  const params = new URLSearchParams()
  for (const key of ["url", "title", "authors", "year", "publication", "citation"] as const) {
    const value = ref[key].trim()
    if (value) params.set(key, value)
  }
  return `${REFERENCE_ARTICLE_ENDPOINT}?${params}`
}

type Outcome = { status: "loading" } | { status: "done"; response: ReferenceArticleResponse } | { status: "error"; message: string }

const answers = new Map<string, ReferenceArticleResponse>()

/** Forgets every remembered answer (for tests). */
export function clearReferenceArticleAnswers(): void {
  answers.clear()
}

async function loadReferenceArticle(request: string, signal: AbortSignal): Promise<ReferenceArticleResponse> {
  const cached = answers.get(request)
  if (cached) return cached
  const timeout = new AbortController()
  const timer = window.setTimeout(() => timeout.abort(), CLIENT_TIMEOUT_MS)
  const onAbort = () => timeout.abort()
  signal.addEventListener("abort", onAbort)
  try {
    const response = await fetch(request, { signal: timeout.signal, headers: { Accept: "application/json" } })
    const body = (await response.json().catch(() => null)) as (ReferenceArticleResponse & { error?: string }) | null
    if (!response.ok || !body || (body.status !== "found" && body.status !== "not_found")) {
      throw new Error(body?.error || `The article service answered ${response.status}.`)
    }
    answers.set(request, body)
    return body
  } catch (error) {
    if (signal.aborted) throw error
    if ((error as Error)?.name === "AbortError") throw new Error("Finding the article took too long.")
    throw error
  } finally {
    window.clearTimeout(timer)
    signal.removeEventListener("abort", onAbort)
  }
}

function useReferenceArticle(request: string): { outcome: Outcome; retry: () => void } {
  const [outcome, setOutcome] = useState<Outcome>({ status: "loading" })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setOutcome({ status: "loading" })
    loadReferenceArticle(request, controller.signal).then(
      (response) => !controller.signal.aborted && setOutcome({ status: "done", response }),
      (error: unknown) =>
        !controller.signal.aborted && setOutcome({ status: "error", message: error instanceof Error ? error.message : "Could not load the article." }),
    )
    return () => controller.abort()
  }, [request, attempt])
  return { outcome, retry: () => setAttempt((n) => n + 1) }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

const link = "font-medium text-fd-primary underline underline-offset-2 hover:opacity-80"

function ExternalLinkText({ href, children }: { href: string; children?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className={`${link} break-all`}>
      {children ?? href}
    </a>
  )
}

/** The cited link, a Google search and a quick search, for trying by hand. */
function ManualSearch({ reference }: { reference: ReferenceDescription }) {
  const query = referenceSearchQueries(reference, 1)[0] ?? reference.citation.slice(0, 200)
  const encoded = encodeURIComponent(query)
  const button =
    "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-fd-accent [&_svg]:size-3.5"
  return (
    <div className="mt-3 flex flex-wrap gap-2" data-reference-manual-search="">
      {reference.url && (
        <a className={button} href={reference.url} target="_blank" rel="noopener noreferrer nofollow">
          <ExternalLink aria-hidden /> Open the cited link
        </a>
      )}
      {query && (
        <>
          <a className={button} href={`https://www.google.com/search?q=${encoded}`} target="_blank" rel="noopener noreferrer">
            <Search aria-hidden /> Search Google
          </a>
          <a className={button} href={`https://qwksearch.com/?q=${encoded}`} target="_blank" rel="noopener noreferrer">
            <Search aria-hidden /> Quick search
          </a>
        </>
      )}
    </div>
  )
}

function Looking({ reference }: { reference: ReferenceDescription }) {
  return (
    <p className="mt-2 text-xs text-fd-muted-foreground">
      <span className="font-medium text-fd-foreground">Looking for:</span> {reference.citation}
    </p>
  )
}

function Notice({ tone, title, children }: { tone: "error" | "empty"; title: string; children?: ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className="mx-auto max-w-2xl px-5 py-12" data-reference-reader-state={tone}>
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <AlertTriangle className="size-4 shrink-0 text-amber-600" aria-hidden /> {title}
      </h3>
      {children}
    </div>
  )
}

/** Where the text came from, above it and outside what Voice and the AI read. */
function SourceBanner({
  response,
  reference,
  wordCount,
}: {
  response: Extract<ReferenceArticleResponse, { status: "found" }>
  reference: ReferenceDescription
  wordCount: number
}) {
  const bySearch = response.via === "search"
  return (
    <div
      data-reference-reader-source={response.via}
      className={`border-b px-5 py-2.5 text-xs leading-relaxed ${bySearch ? "bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100" : "bg-fd-muted/50 text-fd-muted-foreground"}`}
    >
      <div className="mx-auto max-w-3xl space-y-1">
        {response.urlFailed && (
          <p>
            The cited link <ExternalLinkText href={response.urlFailed.url} /> could not be read ({response.urlFailed.reason.replace(/\.$/, "")}), so the article was searched for instead.
          </p>
        )}
        <p>
          {bySearch ? (
            <>
              <strong>Found by search, not from a cited link.</strong>
              {response.query ? <> Searched for <q>{response.query}</q>.</> : null} Its title and text match this reference
              {typeof response.confidence === "number" ? ` (${Math.round(response.confidence * 100)}% match)` : ""}, but check it is the right one.{" "}
            </>
          ) : (
            <>Read from the cited link. </>
          )}
          Source: <ExternalLinkText href={response.url}>{`${hostOf(response.url)}${response.url.length > 60 ? "…" : ""}`}</ExternalLinkText>
          {" · "}
          {wordCount.toLocaleString("en-US")} words
        </p>
        {bySearch && (
          <p>
            Looking for: {reference.citation}
          </p>
        )}
      </div>
    </div>
  )
}

function ArticleBody({ article, html }: { article: ReferenceArticle; html: string }) {
  const byline = [article.author, article.date, article.source].filter(Boolean).join(" · ")
  return (
    <>
      {article.title && <h1>{article.title}</h1>}
      {byline && <p className="text-sm text-fd-muted-foreground">{byline}</p>}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </>
  )
}

/** The reader for one entry's article (see the module doc). */
export function ReferenceReadingMode({ item, onClose }: { item: ReferenceItem; onClose: () => void }) {
  const reference = useMemo(() => describeItem(item), [item])
  const request = useMemo(() => referenceArticleRequest(reference), [reference])
  const { outcome, retry } = useReferenceArticle(request)

  const title = reference.title || [reference.authors, reference.year].filter(Boolean).join(" ") || "Reference"
  const response = outcome.status === "done" ? outcome.response : null
  const found = response?.status === "found" ? response : null
  const cleaned = useMemo(() => (found ? sanitizeArticleHtml(found.article.html, found.url) : null), [found])
  const readable = cleaned !== null

  let notice: ReactNode
  if (outcome.status === "error") {
    notice = (
      <Notice tone="error" title="Could not load the article">
        <p className="mt-2 text-sm text-fd-muted-foreground">{outcome.message}</p>
        <Looking reference={reference} />
        <div className="mt-3">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-fd-accent [&_svg]:size-3.5"
            onClick={retry}
          >
            <RotateCw aria-hidden /> Try again
          </button>
        </div>
        <ManualSearch reference={reference} />
      </Notice>
    )
  } else if (response?.status === "not_found" || (found && !readable)) {
    const missed = response?.status === "not_found" ? response : null
    notice = (
      <Notice tone="empty" title="Could not find the article">
        <p className="mt-2 text-sm text-fd-muted-foreground">
          {reference.url
            ? "The cited link could not be read here, and a search did not turn up a page that matches this reference."
            : "This reference has no link, and a search did not turn up a page that matches it."}{" "}
          Nothing is shown rather than the wrong article.
        </p>
        <Looking reference={reference} />
        {missed?.urlFailed && (
          <p className="mt-2 text-xs text-fd-muted-foreground">
            Cited link <ExternalLinkText href={missed.urlFailed.url} />: {missed.urlFailed.reason}
          </p>
        )}
        <ManualSearch reference={reference} />
        {missed && missed.candidates.length > 0 && (
          <div className="mt-5" data-reference-candidates="">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-fd-muted-foreground">Search results, not confirmed as this article</h4>
            <ul className="mt-2 space-y-1.5 text-sm">
              {missed.candidates.map((candidate) => (
                <li key={candidate.url}>
                  <ExternalLinkText href={candidate.url}>{candidate.title}</ExternalLinkText>
                  <span className="ml-2 text-xs text-fd-muted-foreground">{hostOf(candidate.url)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Notice>
    )
  }

  const loadingLabel = reference.url ? `Reading ${hostOf(reference.url)}…` : "Searching for the article…"

  return (
    <ReadingModeFrame
      title={title}
      onClose={onClose}
      nested
      ready={readable}
      loadingLabel={loadingLabel}
      notice={notice}
      banner={found && cleaned ? <SourceBanner response={found} reference={reference} wordCount={cleaned.wordCount} /> : undefined}
      questions={{ heading: "Ask about this article", maxChars: ARTICLE_MAX_CHARS }}
      content={() => (found && cleaned ? <ArticleBody article={found.article} html={cleaned.html} /> : null)}
    />
  )
}

/** The icon button on a References panel card; it opens the reader. */
export function ReferenceReadingModeButton({ item }: { item: ReferenceItem }) {
  const [open, setOpen] = useState(false)
  const who = [item.authors, item.year].filter(Boolean).join(" ")
  return (
    <>
      <ReferenceIconButton
        {...{ [REFERENCE_READING_MODE_ATTRIBUTE]: "" }}
        aria-haspopup="dialog"
        label={who ? `Reading mode: open the source article for ${who}` : "Reading mode: open the source article"}
        tooltip="Reading mode: read the source article (from its link, or found by search)"
        onClick={() => setOpen(true)}
      >
        <BookOpen aria-hidden />
      </ReferenceIconButton>
      {open && <ReferenceReadingMode item={item} onClose={() => setOpen(false)} />}
    </>
  )
}
