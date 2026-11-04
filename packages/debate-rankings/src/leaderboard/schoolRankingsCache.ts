/**
 * @fileoverview The browser side of the precomputed Schools table: a copy of
 * each season's {@link SchoolRankingsSnapshot} in IndexedDB, revalidated
 * against `/api/school-rankings` once a day.
 *
 * The Schools tab paints from the stored copy at once. When that copy is
 * more than a day old (a week for a finished season) it asks the server,
 * sending the copy's hash; the server answers `{ unchanged: true }` when the
 * D1 snapshot has the same hash, so an unchanged day costs a few bytes. If
 * the endpoint can't answer, the snapshot is computed in the browser as before.
 * @module leaderboard/schoolRankingsCache
 */

import { currentRankingSeasonYear } from "../index"
import {
  computeSchoolRankingsSnapshot,
  isSchoolRankingsSnapshot,
  type SchoolRankingsSnapshot,
} from "./schoolRankingsSnapshot"

/** Where the Worker serves the D1 snapshot. */
export const SCHOOL_RANKINGS_ENDPOINT = "/api/school-rankings"

const DB_NAME = "debate-ai-school-rankings"
const STORE = "snapshots"

/** How long a stored copy is used without asking the server. */
export const CURRENT_SEASON_MAX_AGE_MS = 24 * 60 * 60 * 1000
/** Finished seasons only change when the formula does. */
export const PAST_SEASON_MAX_AGE_MS = 7 * CURRENT_SEASON_MAX_AGE_MS

/** One stored season. */
export interface StoredSchoolRankings {
  snapshot: SchoolRankingsSnapshot
  /** When the copy was last confirmed against the server, epoch ms. */
  checkedAt: number
}

// ---------------------------------------------------------------------------
// IndexedDB (every call tolerates a missing or broken store)
// ---------------------------------------------------------------------------

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null)
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE)
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
      request.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

/** The stored copy of `seasonYear`, or `null`. */
export async function readStoredSchoolRankings(seasonYear: number): Promise<StoredSchoolRankings | null> {
  const db = await openDb()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(seasonYear)
      request.onsuccess = () => {
        const value = request.result as StoredSchoolRankings | undefined
        resolve(value && isSchoolRankingsSnapshot(value.snapshot) && typeof value.checkedAt === "number" ? value : null)
      }
      request.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

/** Saves `stored` for its season; failures are ignored (the copy is only a speed-up). */
export async function writeStoredSchoolRankings(stored: StoredSchoolRankings): Promise<void> {
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite")
      tx.objectStore(STORE).put(stored, stored.snapshot.seasonYear)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
}

/** Forgets the open connection (for tests). */
export function resetSchoolRankingsCacheForTests(): void {
  dbPromise = null
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

/** What `/api/school-rankings` answers. */
export type SchoolRankingsResponse = SchoolRankingsSnapshot | { unchanged: true; hash: string }

/**
 * Asks the server for `seasonYear`'s snapshot. Returns `"unchanged"` when the
 * server's hash equals `knownHash`, or `null` when the endpoint can't answer.
 */
export async function fetchSchoolRankingsSnapshot(
  seasonYear: number,
  knownHash?: string,
): Promise<SchoolRankingsSnapshot | "unchanged" | null> {
  if (typeof fetch !== "function") return null
  const params = new URLSearchParams({ season: String(seasonYear) })
  if (knownHash) params.set("hash", knownHash)
  try {
    const res = await fetch(`${SCHOOL_RANKINGS_ENDPOINT}?${params}`, { headers: { Accept: "application/json" } })
    if (!res.ok) return null
    const body = (await res.json()) as unknown
    if (body && typeof body === "object" && (body as { unchanged?: unknown }).unchanged === true) return "unchanged"
    return isSchoolRankingsSnapshot(body) && body.seasonYear === seasonYear ? body : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

/** Whether a copy checked at `checkedAt` should be revalidated now. */
export function isStale(seasonYear: number, checkedAt: number, now = Date.now()): boolean {
  const maxAge = seasonYear === currentRankingSeasonYear() ? CURRENT_SEASON_MAX_AGE_MS : PAST_SEASON_MAX_AGE_MS
  return now - checkedAt >= maxAge
}

/**
 * Fresh snapshot for `seasonYear` without the stored copy: the server's,
 * else one computed here. Saves it. Throws when both fail.
 */
export async function refreshSchoolRankings(
  seasonYear: number,
  known?: SchoolRankingsSnapshot | null,
): Promise<SchoolRankingsSnapshot> {
  const fetched = await fetchSchoolRankingsSnapshot(seasonYear, known?.hash)
  if (fetched === "unchanged" && known) {
    await writeStoredSchoolRankings({ snapshot: known, checkedAt: Date.now() })
    return known
  }
  // Server down but a copy is on hand: keep it rather than recompute (and freeze) here.
  if (!fetched && known) return known
  const snapshot =
    fetched && fetched !== "unchanged" ? fetched : await computeSchoolRankingsSnapshot(seasonYear)
  await writeStoredSchoolRankings({ snapshot, checkedAt: Date.now() })
  return snapshot
}
