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

export const SPEECH_DOC_LINKS_KEY = "speechDocLinks"
/** The pre-sync storage key: a `{ "scope:SPEECH": link }` map, read once and then retired. */
export const LEGACY_SPEECH_DOC_LINKS_KEY = "speech-doc-links"
export const SPEECH_DOC_LINKS_EVENT = "speech-doc-links-changed"

export interface SpeechDocLink {
  /** `documents.id` of the linked editor document. */
  docId: number
  /** Title at the time it was linked, shown until the doc list loads. */
  title: string
  linkedAt: number
}

/**
 * One stored link. Kept as an array of id-carrying records (`id` is
 * `scope:SPEECH`) rather than a map so the store joins
 * `debate-data-sync`'s `speechDocLinks` tool-record collection and follows
 * the signed-in user to other devices.
 */
export interface SpeechDocLinkRecord extends SpeechDocLink {
  id: string
}

/** Scope a speech's link lives under: its round, else its flow. */
export function speechDocLinkScope(flow: Pick<Flow, "id" | "roundId"> | null | undefined): string | null {
  if (!flow) return null
  return flow.roundId != null ? `round-${flow.roundId}` : `flow-${flow.id}`
}

function linkKey(scope: string, speechName: string): string {
  return `${scope}:${speechName.toUpperCase()}`
}

function isRecord(value: unknown): value is SpeechDocLinkRecord {
  if (!value || typeof value !== "object") return false
  const v = value as Partial<SpeechDocLinkRecord>
  return typeof v.id === "string" && v.id.length > 0 && typeof v.docId === "number"
}

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/** Current links; entries only present in the legacy map are folded in until the next write retires it. */
function readLinks(): SpeechDocLinkRecord[] {
  const current = readJson(SPEECH_DOC_LINKS_KEY)
  const records = Array.isArray(current) ? current.filter(isRecord) : []
  const legacy = readJson(LEGACY_SPEECH_DOC_LINKS_KEY)
  if (legacy && typeof legacy === "object" && !Array.isArray(legacy)) {
    const seen = new Set(records.map((r) => r.id))
    for (const [id, link] of Object.entries(legacy as Record<string, SpeechDocLink>)) {
      if (seen.has(id) || !link || typeof link.docId !== "number") continue
      records.push({ id, docId: link.docId, title: link.title, linkedAt: link.linkedAt })
    }
  }
  return records
}

function writeLinks(links: SpeechDocLinkRecord[]) {
  try {
    localStorage.setItem(SPEECH_DOC_LINKS_KEY, JSON.stringify(links))
    localStorage.removeItem(LEGACY_SPEECH_DOC_LINKS_KEY)
  } catch (e) {
    console.warn("Could not save speech doc links:", e)
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SPEECH_DOC_LINKS_EVENT))
}

export function getSpeechDocLink(scope: string | null, speechName: string): SpeechDocLink | null {
  if (!scope) return null
  const id = linkKey(scope, speechName)
  const link = readLinks().find((r) => r.id === id)
  return link ? { docId: link.docId, title: link.title, linkedAt: link.linkedAt } : null
}

export function setSpeechDocLink(scope: string, speechName: string, doc: { id: number; title: string }): void {
  const id = linkKey(scope, speechName)
  writeLinks([
    ...readLinks().filter((r) => r.id !== id),
    { id, docId: doc.id, title: doc.title, linkedAt: Date.now() },
  ])
}

export function clearSpeechDocLink(scope: string, speechName: string): void {
  const id = linkKey(scope, speechName)
  writeLinks(readLinks().filter((r) => r.id !== id))
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
