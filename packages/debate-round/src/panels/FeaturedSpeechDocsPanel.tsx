"use client"

/**
 * @fileoverview A featured round's speech docs, read-only, one speech at a
 * time — mounted as a tab beside the round's video on its watch page.
 *
 * The docs are the same public Topic Starter files the `/debate` Featured
 * card builds the round from (`round/featured-rounds`), fetched and decoded
 * the same way, so the video page and the debate view never disagree about
 * what was read in the round. A strip of speech buttons (and previous/next)
 * flips between them; speeches with no published doc stay listed but
 * disabled, so the order of the round still reads at a glance. "Open in
 * debate view" sends the reader to `/debate/<slug>`, which builds the full
 * round with timers.
 *
 * @module panels/FeaturedSpeechDocsPanel
 */

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, ExternalLink, Loader2 } from "lucide-react"
import { debateStyles } from "@debate/timer/src/formats/debate-format-times"
import {
  FEATURED_ROUNDS,
  loadFeaturedSpeechDocs,
  type FeaturedRound,
  type FeaturedSpeechDocsResult,
} from "../round/featured-rounds"

interface FeaturedSpeechDocsPanelProps {
  /** `FeaturedRound.key` of the round to show. Unknown keys render nothing. */
  featuredKey: string
}

/** Decoded docs per featured round, kept for the page's lifetime. */
const docsCache = new Map<string, Promise<FeaturedSpeechDocsResult>>()

function loadDocs(featured: FeaturedRound): Promise<FeaturedSpeechDocsResult> {
  let pending = docsCache.get(featured.key)
  if (!pending) {
    pending = loadFeaturedSpeechDocs(featured)
    // A failed load should be retried by the next mount, not cached.
    pending.catch(() => docsCache.delete(featured.key))
    docsCache.set(featured.key, pending)
  }
  return pending
}

/**
 * Card styling for CardMirror's exported HTML (`pmd-*` classes), scoped to
 * this panel. The editor's own stylesheet only applies inside a booted
 * editor, and booting one for a read-only doc isn't worth the engine.
 */
const DOC_CLASSES = [
  "text-[13px] leading-relaxed",
  "[&_.pmd-pocket]:mt-4 [&_.pmd-pocket]:text-lg [&_.pmd-pocket]:font-bold",
  "[&_.pmd-hat]:mt-4 [&_.pmd-hat]:text-base [&_.pmd-hat]:font-bold",
  "[&_.pmd-block]:mt-3 [&_.pmd-block]:text-sm [&_.pmd-block]:font-semibold",
  "[&_.pmd-card]:mt-3",
  "[&_.pmd-tag]:text-[13px] [&_.pmd-tag]:font-bold",
  "[&_.pmd-cite]:font-bold",
  "[&_.pmd-cite-para]:text-xs [&_.pmd-cite-para]:text-muted-foreground",
  "[&_.pmd-underline]:underline [&_u]:underline",
  "[&_.pmd-emphasis]:font-bold [&_.pmd-emphasis]:underline",
  "[&_.pmd-highlight]:bg-yellow-200 dark:[&_.pmd-highlight]:bg-yellow-500/40",
  "[&_p]:my-1",
].join(" ")

export function FeaturedSpeechDocsPanel({ featuredKey }: FeaturedSpeechDocsPanelProps) {
  const featured = FEATURED_ROUNDS.find((round) => round.key === featuredKey)
  const speeches = useMemo(
    () => (featured ? debateStyles[featured.debateStyle].primary.columns : []),
    [featured],
  )
  const [result, setResult] = useState<FeaturedSpeechDocsResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [speech, setSpeech] = useState<string>(() => featured?.speechDocs[0]?.speech ?? "")

  useEffect(() => {
    if (!featured) return
    let cancelled = false
    loadDocs(featured)
      .then((loaded) => {
        if (!cancelled) setResult(loaded)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [featured])

  if (!featured) return null

  const available = speeches.filter((name) => result?.docs[name])
  const position = available.indexOf(speech)
  const step = (delta: number) => {
    const next = available[position + delta]
    if (next) setSpeech(next)
  }
  const html = result?.docs[speech]

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-2 border-b border-border p-2">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-muted-foreground">
            {featured.title} speech docs
          </span>
          <a
            href={`/debate/${featured.slug}`}
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Open in debate view
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous speech"
            disabled={position <= 0}
            onClick={() => step(-1)}
            className="rounded p-1 text-muted-foreground hover:bg-accent/50 disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <div role="tablist" aria-label="Speeches" className="flex flex-1 flex-wrap gap-1">
            {speeches.map((name) => {
              const hasDoc = !!result?.docs[name]
              const isActive = name === speech
              return (
                <button
                  key={name}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  disabled={!hasDoc}
                  title={hasDoc || !result ? name : `No ${name} doc was shared`}
                  onClick={() => setSpeech(name)}
                  className={`rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums transition-colors disabled:opacity-40 ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {name}
                </button>
              )
            })}
          </div>
          <button
            type="button"
            aria-label="Next speech"
            disabled={position === -1 || position >= available.length - 1}
            onClick={() => step(1)}
            className="rounded p-1 text-muted-foreground hover:bg-accent/50 disabled:opacity-40"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : !result ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-busy="true">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading speech docs…
          </div>
        ) : html ? (
          // Library HTML produced by CardMirror's own serializer from a
          // parsed document, so text is already escaped.
          <div className={DOC_CLASSES} dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <p className="text-xs text-muted-foreground">No {speech} doc was shared for this round.</p>
        )}
      </div>
    </div>
  )
}
