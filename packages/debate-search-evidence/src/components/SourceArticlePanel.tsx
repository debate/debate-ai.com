/**
 * @fileoverview The full source article of a card, shown beside the card.
 *
 * The article is fetched through qwksearch's extract-webpage endpoint
 * ({@link fetchSourceArticle}) and rendered with qwksearch's own article-panel
 * body, research-agent-ui's `ArticleContent` — the same citation line, word
 * count and sanitized reading view as the article reader on qwksearch.com.
 * Around it this panel adds what a debater needs next to a card: a highlighter
 * for marking the passages worth cutting, and a copy button that puts the
 * citation and those passages on the clipboard.
 */

"use client"

import { Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import DOMPurify from "dompurify"
import { Check, Copy, Eraser, ExternalLink, Highlighter, Loader2, RotateCw, X } from "lucide-react"

import { Button } from "../ui/primitives/button"
import { cn } from "../ui/lib/utils"
import { ArticleNotReadableError, fetchSourceArticle, type SourceArticle } from "../lib/source-article"
import { clearHighlights, highlightSelection } from "../lib/article-highlight"
import { plainText } from "../lib/card-content"

/**
 * research-agent-ui's `ArticleContent`, loaded on first use — the package is
 * the whole qwksearch UI, far too much to put in the search screen's initial
 * bundle for a panel most visits never open.
 *
 * Two globals must exist before that import evaluates, for the same reasons
 * @debate/webview's /doc embed sets them (`routes/doc/ResearchAgentEmbed.tsx`,
 * `components/qwksearch/base-url.ts`):
 * - `Prism` — `extract-webpage`, bundled inside, registers grammars from
 *   `prismjs/components/*`, which read `Prism` off the global object.
 * - `NEXT_PUBLIC_BASE_URL` — the `qwksearch-api-client` bundled inside
 *   captures its base URL on first evaluation. Left unset, whichever of this
 *   panel and /doc loaded the package first would fix it to debate-ai.com's
 *   own origin, and /doc's chat would then call routes that do not exist.
 */
const ArticleContent = lazy(async () => {
  const host = globalThis as typeof globalThis & { Prism?: unknown; NEXT_PUBLIC_BASE_URL?: string }
  host.NEXT_PUBLIC_BASE_URL ??= "https://qwksearch.com"
  const { default: Prism } = await import("prismjs")
  host.Prism ??= Prism
  const { ArticleContent } = await import("research-agent-ui")
  return { default: ArticleContent }
})

/**
 * Reading-view styles for the article body. The app loads no typography
 * plugin, so `ArticleContent`'s own `prose` classes do nothing here; these are
 * declared from this package's source, which Tailwind scans.
 */
const ARTICLE_BODY_CLASSES = [
  "text-[0.95rem] break-words",
  "[&_#article-content_p]:my-3 [&_#article-content_p]:leading-7",
  "[&_#article-content_li]:my-1 [&_#article-content_li]:leading-7",
  "[&_#article-content_ul]:list-disc [&_#article-content_ul]:pl-6",
  "[&_#article-content_ol]:list-decimal [&_#article-content_ol]:pl-6",
  "[&_#article-content_h1]:mt-6 [&_#article-content_h1]:text-xl [&_#article-content_h1]:font-semibold",
  "[&_#article-content_h2]:mt-6 [&_#article-content_h2]:text-lg [&_#article-content_h2]:font-semibold",
  "[&_#article-content_h3]:mt-5 [&_#article-content_h3]:font-semibold",
  "[&_#article-content_blockquote]:border-l-2 [&_#article-content_blockquote]:pl-4 [&_#article-content_blockquote]:italic",
  "[&_#article-content_img]:my-4 [&_#article-content_img]:max-w-full [&_#article-content_img]:rounded-md",
  "[&_a]:underline [&_a]:underline-offset-2",
  "[&_mark]:rounded-sm [&_mark]:bg-yellow-200 [&_mark]:text-inherit dark:[&_mark]:bg-yellow-500/40",
].join(" ")

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; article: SourceArticle }

/** Props for {@link SourceArticlePanel}. */
interface SourceArticlePanelProps {
  /** The card's source URL. */
  url: string
  /** Closes the panel. */
  onClose: () => void
}

/**
 * Fetches and shows a card's source article with a highlighter.
 *
 * @param props - See {@link SourceArticlePanelProps}.
 */
export function SourceArticlePanel({ url, onClose }: SourceArticlePanelProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" })
  const [attempt, setAttempt] = useState(0)
  const [isHighlightMode, setIsHighlightMode] = useState(true)
  const [highlights, setHighlights] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    setState({ status: "loading" })
    setHighlights([])
    fetchSourceArticle(url, controller.signal).then(
      (article) => {
        if (controller.signal.aborted) return
        // ArticleContent sanitizes the body but renders the citation as-is,
        // and extract-webpage builds it from the page's own metadata.
        const cite = article.cite ? DOMPurify.sanitize(article.cite, { ALLOWED_TAGS: ["a", "b", "i", "em", "strong", "span"] }) : undefined
        setState({ status: "ready", article: { ...article, cite } })
      },
      (error: unknown) => {
        if (controller.signal.aborted) return
        setState({
          status: "error",
          message:
            error instanceof ArticleNotReadableError
              ? "qwksearch couldn't find readable article text on this page — it may be paywalled, a PDF, or blocked to crawlers."
              : "Couldn't reach qwksearch to extract this article.",
        })
      },
    )
    return () => controller.abort()
  }, [url, attempt])

  const onMouseUp = useCallback(() => {
    if (!isHighlightMode || !bodyRef.current) return
    const text = highlightSelection(bodyRef.current)
    if (text) setHighlights((current) => [...current, text])
  }, [isHighlightMode])

  const onClearHighlights = () => {
    if (bodyRef.current) clearHighlights(bodyRef.current)
    setHighlights([])
  }

  const onCopy = async () => {
    if (state.status !== "ready") return
    const cite = plainText(state.article.cite ?? "") || url
    const passages = highlights.length > 0 ? highlights : [plainText(state.article.html ?? "")]
    try {
      await navigator.clipboard.writeText(`${cite}\n\n${passages.join("\n\n")}`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked (insecure context or denied permission) — nothing to report beyond the unchanged icon.
    }
  }

  const title = state.status === "ready" && state.article.title ? state.article.title : hostnameOf(url)

  return (
    <section aria-label="Source article" className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex items-center gap-1 border-b px-3 py-2">
        <h4 className="mr-auto min-w-0 truncate text-sm font-semibold" title={title}>
          {title}
        </h4>
        {state.status === "ready" && (
          <>
            <Button
              variant={isHighlightMode ? "secondary" : "ghost"}
              size="icon-sm"
              aria-pressed={isHighlightMode}
              title={isHighlightMode ? "Highlighter on — select text to mark it" : "Turn on the highlighter"}
              onClick={() => setIsHighlightMode((on) => !on)}
            >
              <Highlighter />
            </Button>
            {highlights.length > 0 && (
              <Button variant="ghost" size="icon-sm" title="Clear highlights" onClick={onClearHighlights}>
                <Eraser />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              title={highlights.length > 0 ? `Copy citation and ${highlights.length} highlighted passage(s)` : "Copy citation and full text"}
              onClick={onCopy}
            >
              {copied ? <Check /> : <Copy />}
            </Button>
          </>
        )}
        <Button variant="ghost" size="icon-sm" asChild title="Open the original page">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink />
          </a>
        </Button>
        <Button variant="ghost" size="icon-sm" title="Close article" onClick={onClose}>
          <X />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        {state.status === "loading" && <PanelMessage icon={<Loader2 className="size-4 animate-spin" />}>Extracting the full article with qwksearch…</PanelMessage>}

        {state.status === "error" && (
          <div className="space-y-3 py-6 text-sm">
            <p className="text-muted-foreground">{state.message}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)}>
                <RotateCw /> Retry
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink /> Open page
                </a>
              </Button>
            </div>
          </div>
        )}

        {state.status === "ready" && (
          <div
            ref={bodyRef}
            onMouseUp={onMouseUp}
            onTouchEnd={onMouseUp}
            className={cn(ARTICLE_BODY_CLASSES, isHighlightMode && "cursor-text")}
          >
            <Suspense fallback={<PanelMessage icon={<Loader2 className="size-4 animate-spin" />}>Loading article view…</PanelMessage>}>
              <ArticleContent article={{ ...state.article, word_count: Number(state.article.word_count) || undefined }} isHighlightMode={isHighlightMode} />
            </Suspense>
          </div>
        )}
      </div>
    </section>
  )
}

/** A one-line status message in the panel body. */
function PanelMessage({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
      {icon}
      {children}
    </p>
  )
}

/** The URL's host without `www.`, as a fallback title. */
function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}
