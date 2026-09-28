/**
 * @fileoverview Which editor document is a speech's "speech doc".
 *
 * By default a speech's doc is the flow's own `speechDocs[speechName]`
 * markdown. The speech header's link dropdown can point a speech at one of
 * the user's recently modified REASON editor documents (`documents` table,
 * `GET /api/doc/documents`) instead — e.g. the `.docx` they're actually
 * reading from — so the word counts (read / underlined / highlighted) come
 * from that file.
 *
 * Links are scoped to the round when the flow belongs to one (both of a
 * round's flows share the same speeches), else to the flow, and persisted to
 * localStorage. Pure helpers; each write fires {@link SPEECH_DOC_LINKS_EVENT}.
 *
 * @module state/speechDocLinks
 */

import type { Flow } from "../types/flow"

export const SPEECH_DOC_LINKS_KEY = "speech-doc-links"
export const SPEECH_DOC_LINKS_EVENT = "speech-doc-links-changed"

export interface SpeechDocLink {
  /** `documents.id` of the linked editor document. */
  docId: number
  /** Title at the time it was linked, shown until the doc list loads. */
  title: string
  linkedAt: number
}

type LinkMap = Record<string, SpeechDocLink>

/** Scope a speech's link lives under: its round, else its flow. */
export function speechDocLinkScope(flow: Pick<Flow, "id" | "roundId"> | null | undefined): string | null {
  if (!flow) return null
  return flow.roundId != null ? `round-${flow.roundId}` : `flow-${flow.id}`
}

function linkKey(scope: string, speechName: string): string {
  return `${scope}:${speechName.toUpperCase()}`
}

function readLinks(): LinkMap {
  try {
    const raw = localStorage.getItem(SPEECH_DOC_LINKS_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as LinkMap) : {}
  } catch {
    return {}
  }
}

function writeLinks(links: LinkMap) {
  try {
    localStorage.setItem(SPEECH_DOC_LINKS_KEY, JSON.stringify(links))
  } catch (e) {
    console.warn("Could not save speech doc links:", e)
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SPEECH_DOC_LINKS_EVENT))
}

export function getSpeechDocLink(scope: string | null, speechName: string): SpeechDocLink | null {
  if (!scope) return null
  const link = readLinks()[linkKey(scope, speechName)]
  return link && typeof link.docId === "number" ? link : null
}

export function setSpeechDocLink(scope: string, speechName: string, doc: { id: number; title: string }): void {
  writeLinks({
    ...readLinks(),
    [linkKey(scope, speechName)]: { docId: doc.id, title: doc.title, linkedAt: Date.now() },
  })
}

export function clearSpeechDocLink(scope: string, speechName: string): void {
  const links = readLinks()
  delete links[linkKey(scope, speechName)]
  writeLinks(links)
}

/** A row of `GET /api/doc/documents`, narrowed to what the picker needs. */
export interface EditorDocumentSummary {
  id: number
  title: string
  updatedAt: string | number
  isFolder?: boolean
}

function timestampMs(value: string | number): number {
  if (typeof value === "number") return value < 1e12 ? value * 1000 : value
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : 0
}

/** Files (not folders), most recently modified first, capped at `limit`. */
export function recentEditorDocuments(rows: unknown, limit = 15): EditorDocumentSummary[] {
  if (!Array.isArray(rows)) return []
  return rows
    .filter(
      (row): row is EditorDocumentSummary =>
        !!row && typeof row === "object" && typeof (row as EditorDocumentSummary).id === "number" && !(row as EditorDocumentSummary).isFolder,
    )
    .map((row) => ({ id: row.id, title: row.title || "Untitled", updatedAt: row.updatedAt }))
    .sort((a, b) => timestampMs(b.updatedAt) - timestampMs(a.updatedAt))
    .slice(0, limit)
}
