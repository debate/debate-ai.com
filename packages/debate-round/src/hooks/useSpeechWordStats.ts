/**
 * @fileoverview Word counts for one speech — read / underlined / highlighted
 * from its speech doc, and orally spoken from its recording's transcript.
 *
 * The speech doc is the editor document linked to the speech
 * (`state/speechDocLinks.ts`) when there is one, else the flow's own
 * `speechDocs[speechName]` markdown. Linked documents are fetched from
 * `GET /api/doc/documents/:id`; a `.cmir` row is decoded to HTML with
 * CardMirror's reader, loaded lazily so a flow without links never pulls the
 * editor engine in.
 *
 * @module hooks/useSpeechWordStats
 */

"use client"

import { useEffect, useMemo, useState } from "react"
import {
  computeSpeechDocWordStats,
  type SpeechDocWordStats,
} from "@debate/timer/src/formats/speech-doc-word-stats"
import { loadSpokenWordCount, SPOKEN_WORDS_EVENT } from "@debate/timer/src/recorder/spoken-words-store"
import type { Flow } from "../types/flow"
import {
  getSpeechDocLink,
  speechDocLinkScope,
  SPEECH_DOC_LINKS_EVENT,
  SPEECH_DOC_LINKS_KEY,
  type SpeechDocLink,
} from "../state/speechDocLinks"
import { storedDocumentHtml, type StoredDocument } from "../round/stored-document-html"

/** How often the selected speech re-reads a linked document while it's being edited elsewhere. */
const LINKED_DOC_REFRESH_MS = 30_000

async function fetchLinkedStats(docId: number): Promise<{ stats: SpeechDocWordStats; title?: string }> {
  const res = await fetch(`/api/doc/documents/${docId}`)
  if (!res.ok) throw new Error(`Linked document ${docId} could not be loaded (${res.status}).`)
  const doc = (await res.json()) as StoredDocument
  return { html: await storedDocumentHtml(doc), title: doc.title }
}

async function fetchLinkedStats(docId: number): Promise<{ stats: SpeechDocWordStats; title?: string }> {
  const { html, title } = await fetchLinkedDocumentHtml(docId)
  return { stats: computeSpeechDocWordStats(html), title }
}

export interface SpeechWordStatsResult {
  stats: SpeechDocWordStats
  spoken: number
  link: SpeechDocLink | null
  /** Human label for where the doc counts came from. */
  sourceLabel: string
  error: string | null
}

/**
 * @param flow - The flow the speech belongs to.
 * @param speechName - Speech/column name, e.g. `"1AC"`.
 * @param options.live - Re-fetch a linked doc periodically (the speech in view).
 */
export function useSpeechWordStats(
  flow: Flow | null | undefined,
  speechName: string,
  { live = false }: { live?: boolean } = {},
): SpeechWordStatsResult {
  const scope = speechDocLinkScope(flow)
  const [link, setLink] = useState<SpeechDocLink | null>(() =>
    typeof window === "undefined" ? null : getSpeechDocLink(scope, speechName),
  )
  const [spoken, setSpoken] = useState(() => (typeof window === "undefined" ? 0 : loadSpokenWordCount(speechName)))
  const [linked, setLinked] = useState<{ docId: number; stats: SpeechDocWordStats; title?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const refresh = () => setLink(getSpeechDocLink(scope, speechName))
    refresh()
    // Account hydration writes the key and fires `storage`, not our own event.
    const onStorage = (event: StorageEvent) => {
      if (event.key === SPEECH_DOC_LINKS_KEY) refresh()
    }
    window.addEventListener(SPEECH_DOC_LINKS_EVENT, refresh)
    window.addEventListener("storage", onStorage)
    return () => {
      window.removeEventListener(SPEECH_DOC_LINKS_EVENT, refresh)
      window.removeEventListener("storage", onStorage)
    }
  }, [scope, speechName])

  useEffect(() => {
    const refresh = () => setSpoken(loadSpokenWordCount(speechName))
    refresh()
    window.addEventListener(SPOKEN_WORDS_EVENT, refresh)
    return () => window.removeEventListener(SPOKEN_WORDS_EVENT, refresh)
  }, [speechName])

  const docId = link?.docId
  useEffect(() => {
    if (docId == null) {
      setLinked(null)
      setError(null)
      return
    }
    let cancelled = false
    const load = () =>
      fetchLinkedStats(docId)
        .then((result) => {
          if (cancelled) return
          setLinked({ docId, ...result })
          setError(null)
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(e instanceof Error ? e.message : String(e))
        })
    void load()
    const timer = live ? setInterval(load, LINKED_DOC_REFRESH_MS) : undefined
    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [docId, live])

  const flowDoc = flow?.speechDocs?.[speechName] ?? ""
  const flowStats = useMemo(() => computeSpeechDocWordStats(flowDoc), [flowDoc])

  const useLinked = link != null && linked?.docId === link.docId
  return {
    stats: useLinked ? linked!.stats : link ? computeSpeechDocWordStats("") : flowStats,
    spoken,
    link,
    sourceLabel: link ? (linked?.title ?? link.title) : "Flow speech doc",
    error,
  }
}
