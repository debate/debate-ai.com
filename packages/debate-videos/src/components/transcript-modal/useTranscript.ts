/**
 * @fileoverview Fetches a YouTube video's transcript (via `extract-youtube`,
 * behind the `transcript` API route) for any synced-captions UI.
 */

"use client"

import { useEffect, useState } from "react"
import grab from "grab-url"
import type { TranscriptSnippet } from "./transcriptUtils"

interface UseTranscriptResult {
  snippets: TranscriptSnippet[] | null
  loading: boolean
  error: string | null
}

/** Fetches `videoId`'s transcript while `enabled` is true; resets when either changes. */
export function useTranscript(videoId: string, enabled: boolean): UseTranscriptResult {
  const [snippets, setSnippets] = useState<TranscriptSnippet[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setSnippets(null)

    grab<{ videoId: string; snippets: TranscriptSnippet[]; error?: string }, { videoId: string }>(
      "transcript",
      { videoId },
    )
      .then((data) => {
        if (cancelled) return
        // grab resolves with an `error` field rather than throwing on a
        // non-2xx response, so a failure has to be checked for here.
        if (!data || data.error) {
          setError(data?.error || "Failed to load transcript")
          return
        }
        setSnippets(data.snippets ?? [])
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load transcript")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [enabled, videoId])

  return { snippets, loading, error }
}
