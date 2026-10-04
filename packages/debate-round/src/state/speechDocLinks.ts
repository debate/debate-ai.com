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
 * localStorage, and synced to the signed-in account through `debate-data-sync`'s
 * `speechDocLinks` collection. Pure helpers; each write fires
 * {@link SPEECH_DOC_LINKS_EVENT}, and a sync hydration fires a `storage` event
 * for {@link SPEECH_DOC_LINKS_KEY} instead.
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
 * One stored link. Kept as an array of id-keyed records (not a map) because
 * that is the shape `debate-data-sync`'s `speechDocLinks` collection syncs to
 * the account: `id` is `${scope}:${SPEECH}`, the same key the old map used.
 */
interface StoredSpeechDocLink extends SpeechDocLink {
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

function isLink(value: unknown): value is SpeechDocLink {
  return !!value && typeof value === "object" && typeof (value as SpeechDocLink).docId === "number"
}

/** Parses one storage value as records, or as the pre-sync `{ [id]: link }` map. */
function parseStored(raw: string | null): StoredSpeechDocLink[] {
  if (!raw) return []
  const parsed: unknown = JSON.parse(raw)
  if (Array.isArray(parsed)) {
    return parsed.filter(
      (row): row is StoredSpeechDocLink => isLink(row) && typeof (row as StoredSpeechDocLink).id === "string",
    )
  }
  if (parsed && typeof parsed === "object") {
    return Object.entries(parsed as Record<string, unknown>)
      .filter((entry): entry is [string, SpeechDocLink] => isLink(entry[1]))
      .map(([id, link]) => ({ ...link, id }))
  }
  return []
}

function readKey(key: string): StoredSpeechDocLink[] {
  try {
    return parseStored(localStorage.getItem(key))
  } catch {
    return []
  }
}

/**
 * Reads the stored links: the synced records, plus any still sitting in the
 * pre-sync map under {@link LEGACY_SPEECH_DOC_LINKS_KEY}. A record wins over a
 * legacy entry with the same id; the legacy key is retired by the next write.
 */
function readLinks(): StoredSpeechDocLink[] {
  const records = readKey(SPEECH_DOC_LINKS_KEY)
  const ids = new Set(records.map((link) => link.id))
  return [...records, ...readKey(LEGACY_SPEECH_DOC_LINKS_KEY).filter((link) => !ids.has(link.id))]
}

function writeLinks(links: StoredSpeechDocLink[]) {
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
  const found = readLinks().find((link) => link.id === id)
  return found ? { docId: found.docId, title: found.title, linkedAt: found.linkedAt } : null
}

export function setSpeechDocLink(scope: string, speechName: string, doc: { id: number; title: string }): void {
  const id = linkKey(scope, speechName)
  writeLinks([
    ...readLinks().filter((link) => link.id !== id),
    { id, docId: doc.id, title: doc.title, linkedAt: Date.now() },
  ])
}

export function clearSpeechDocLink(scope: string, speechName: string): void {
  const id = linkKey(scope, speechName)
  writeLinks(readLinks().filter((link) => link.id !== id))
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
