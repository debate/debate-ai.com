/**
 * @fileoverview Fetches a YouTube video's transcript (behind the `transcript`
 * API route) for any synced-captions UI.
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

interface TranscriptResponse {
  videoId?: string
  snippets?: TranscriptSnippet[]
  error?: string
}

/**
 * In-flight and completed requests, keyed by video id. The transcript modal
 * and the player's subtitles panel can ask for the same video at the same
 * time, and each remount used to fire its own request; sharing the promise
 * keeps that to one round trip.
 */
const cache = new Map<string, Promise<TranscriptSnippet[]>>()

/** How long a failed lookup is remembered before another request is allowed. */
const FAILURE_TTL_MS = 60_000

function loadTranscript(videoId: string): Promise<TranscriptSnippet[]> {
  const cached = cache.get(videoId)
  if (cached) return cached

  const request = grab<TranscriptResponse, { videoId: string }>("transcript", { videoId })
    .then((data) => {
      // grab resolves with an `error` field rather than throwing on a
      // non-2xx response, so a failure has to be checked for here.
      if (!data || data.error) throw new Error(data?.error || "Failed to load transcript")
      return data.snippets ?? []
    })
    .catch((error: unknown) => {
      // Let a failure expire so the user can retry, but not on every remount.
      setTimeout(() => {
        if (cache.get(videoId) === request) cache.delete(videoId)
      }, FAILURE_TTL_MS)
      throw error
    })

  cache.set(videoId, request)
  return request
}

/** Fetches `videoId`'s transcript while `enabled` is true; resets when either changes. */
export function useTranscript(videoId: string, enabled: boolean): UseTranscriptResult {
  const [snippets, setSnippets] = useState<TranscriptSnippet[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !videoId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setSnippets(null)

    loadTranscript(videoId)
      .then((result) => {
        if (!cancelled) setSnippets(result)
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
