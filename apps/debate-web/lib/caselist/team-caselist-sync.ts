/**
 * @fileoverview The admin panel's "Sync team from openCaselist": finds one
 * team's openCaselist pages — this season's and every earlier season's in the
 * same format — and stores them, so the team profile's Caselist section reads
 * them from our own database instead of asking openCaselist live.
 *
 * A sync is two steps, both driven by the admin panel
 * (`/api/admin/caselist-team-sync`):
 *
 * 1. **Pages** ({@link syncTeamPages}). Search every season's caselist for the
 *    team (school by name, team by debater surnames, as the live lookup in
 *    `team-caselist.ts` does), then save each page found with its rounds
 *    (round reports and open-source paths) and wiki cites to
 *    `caselist_team_pages`, `caselist_team_rounds` and `caselist_team_cites`.
 *    Answers with the open-source paths not stored yet.
 * 2. **Files** ({@link syncTeamFile}), one request per path. openCaselist
 *    serves at most ten downloads a minute per account, which no single
 *    request could wait out, so the panel paces the calls. Each `.docx` is
 *    converted to HTML by `debate-card-parser`; the HTML (the full text) and
 *    the original bytes go to the CARD_TEXT R2 bucket, and the document's
 *    metadata becomes a `caselist_documents` row with an empty `html` column —
 *    the same split the "Move card text to R2" button leaves the bulk-archive
 *    documents in, so `hydrateCaselistDocHtml` reads both alike.
 *
 * Only the team asked for is scraped: nothing here walks a whole caselist.
 *
 * @module lib/caselist/team-caselist-sync
 */

import { and, desc, eq, inArray, isNull, isNotNull, or, sql } from "drizzle-orm"
import { docxBytesToHtml, describeDocxImportError } from "@debate-ai/card-parser"
import {
  type CaselistClient,
  type CaselistInfo,
  type CaselistSchool,
  type CaselistTeam,
  matchCaselistSchool,
  matchCaselistTeam,
  openSourceFileName,
  rankedTeamLastNames,
  schoolMatchScore,
  teamDebaters,
} from "@debate-ai/research-evidence/src/caselist/caselist-api"
import { buildPathHash } from "@debate-ai/research-evidence/src/caselist/caselist-document-sql"
import type { getDBFromContext } from "@/lib/database/context"
import { chunkBoundParams } from "@/lib/database/bound-params"
import {
  caselistDocuments,
  caselistTeamCites,
  caselistTeamPages,
  caselistTeamRounds,
  type CaselistTeamCiteRow,
  type CaselistTeamPageRow,
  type CaselistTeamRoundRow,
} from "@/lib/database/schema"
import { caselistDocKey } from "@/lib/search/card-text-store"
import {
  DATASET_CASELIST_FORMAT,
  isOpenSourcePath,
  shapeCite,
  shapeRound,
  type TeamCaselistPayload,
  type TeamCaselistSeason,
} from "./team-caselist"

type Database = Awaited<ReturnType<typeof getDBFromContext>>

/** Seasons searched per sync at most (openCaselist's archive starts in 2011). */
export const MAX_SYNC_SEASONS = 16

/** R2 prefix for the original open-source files, keyed by their caselist path. */
const CASELIST_FILE_PREFIX = "caselist-files"

/** The slice of the R2 binding this module uses. */
export interface CaselistFileBucket {
  put(
    key: string,
    value: string | ArrayBuffer | Uint8Array,
    options?: { httpMetadata?: { contentType?: string; contentDisposition?: string } },
  ): Promise<unknown>
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer>; text(): Promise<string> } | null>
}

export const CASELIST_FILE_CONTENT_TYPES: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  pdf: "application/pdf",
  rtf: "application/rtf",
  txt: "text/plain; charset=utf-8",
}

export function caselistFileContentType(fileName: string): string {
  return CASELIST_FILE_CONTENT_TYPES[fileName.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream"
}

/** R2 key of an open-source file's original bytes. */
export function caselistFileKey(path: string): string {
  return `${CASELIST_FILE_PREFIX}/${path}`
}

// ── Tables ───────────────────────────────────────────────────────────────────

/** DDL matching the three tables in schema.ts (plus `caselist_documents`, for a fresh database). */
export const CASELIST_TEAM_DDL: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS "caselist_team_pages" (
  "id" text PRIMARY KEY NOT NULL,
  "caselist_slug" text NOT NULL,
  "caselist_label" text NOT NULL,
  "event" text,
  "level" text,
  "year" integer NOT NULL,
  "school_name" text NOT NULL,
  "school_display_name" text NOT NULL,
  "team_name" text NOT NULL,
  "team_display_name" text NOT NULL,
  "debaters" text DEFAULT '[]' NOT NULL,
  "debaters_key" text DEFAULT '' NOT NULL,
  "lookup_key" text DEFAULT '' NOT NULL,
  "page_url" text NOT NULL,
  "round_count" integer DEFAULT 0 NOT NULL,
  "cite_count" integer DEFAULT 0 NOT NULL,
  "file_count" integer DEFAULT 0 NOT NULL,
  "synced_at" integer DEFAULT (unixepoch()) NOT NULL,
  "synced_by" text DEFAULT '' NOT NULL
)`,
  `CREATE INDEX IF NOT EXISTS "idx_caselist_team_pages_debaters" ON "caselist_team_pages" ("debaters_key")`,
  `CREATE INDEX IF NOT EXISTS "idx_caselist_team_pages_lookup" ON "caselist_team_pages" ("lookup_key")`,
  `CREATE INDEX IF NOT EXISTS "idx_caselist_team_pages_synced" ON "caselist_team_pages" ("synced_at")`,
  `CREATE TABLE IF NOT EXISTS "caselist_team_rounds" (
  "round_id" integer PRIMARY KEY NOT NULL,
  "page_id" text NOT NULL,
  "side" text DEFAULT '' NOT NULL,
  "tournament" text DEFAULT '' NOT NULL,
  "round" text DEFAULT '' NOT NULL,
  "opponent" text,
  "judge" text,
  "report" text,
  "opensource" text,
  "video" text,
  "created_at" text,
  "document_id" integer
)`,
  `CREATE INDEX IF NOT EXISTS "idx_caselist_team_rounds_page" ON "caselist_team_rounds" ("page_id")`,
  `CREATE INDEX IF NOT EXISTS "idx_caselist_team_rounds_opensource" ON "caselist_team_rounds" ("opensource")`,
  `CREATE TABLE IF NOT EXISTS "caselist_team_cites" (
  "cite_id" integer PRIMARY KEY NOT NULL,
  "page_id" text NOT NULL,
  "round_id" integer,
  "title" text DEFAULT '' NOT NULL,
  "cites" text DEFAULT '' NOT NULL,
  "side" text,
  "tournament" text,
  "round" text,
  "opponent" text,
  "judge" text,
  "created_at" text
)`,
  `CREATE INDEX IF NOT EXISTS "idx_caselist_team_cites_page" ON "caselist_team_cites" ("page_id")`,
  `CREATE TABLE IF NOT EXISTS "caselist_documents" (
  "id" integer PRIMARY KEY NOT NULL,
  "path_hash" text NOT NULL UNIQUE,
  "caselist_slug" text NOT NULL,
  "caselist_label" text NOT NULL,
  "school" text NOT NULL,
  "team" text,
  "side" text,
  "file_name" text NOT NULL,
  "archive_path" text NOT NULL,
  "html" text NOT NULL,
  "card_count" integer DEFAULT 0 NOT NULL,
  "ingested_at" integer DEFAULT (unixepoch()) NOT NULL,
  "archive_date" text
)`,
]

let tablesReady: Promise<void> | null = null

/** Creates the tables once per isolate; a failure is forgotten and retried. */
export function ensureCaselistTeamTables(db: Database): Promise<void> {
  tablesReady ??= (async () => {
    for (const statement of CASELIST_TEAM_DDL) await db.run(sql.raw(statement))
  })().catch((error) => {
    tablesReady = null
    throw error
  })
  return tablesReady
}

/** Test-only: forget that the tables were created. */
export function resetCaselistTeamTables(): void {
  tablesReady = null
}

// ── Keys ─────────────────────────────────────────────────────────────────────

const fold = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")

/** Folded, sorted surnames: the same key for `Lin & Lee` and `Lee & Lin`. */
export function debatersKey(lastNames: readonly string[]): string {
  return lastNames.map(fold).filter(Boolean).sort().join("|")
}

/** The key a team profile looks its synced pages up by. */
export function teamLookupKey(dataset: string, school: string, team: string): string {
  return [dataset.trim().toLowerCase(), fold(school), fold(team)].join("|")
}

/** Whether a caselist is in the same format (event + level) as another. */
function sameFormat(a: { event: string | null; level: string | null }, b: { event: string | null; level: string | null }) {
  const event = (value: string | null) => {
    const lower = (value ?? "").toLowerCase()
    return lower === "policy" ? "cx" : lower
  }
  return event(a.event) === event(b.event) && (a.level ?? "").toLowerCase() === (b.level ?? "").toLowerCase()
}

/** Whether a caselist's event/level is the rankings dataset's format. */
function caselistMatchesDataset(caselist: { event: string | null; level: string | null }, dataset: string): boolean {
  const format = DATASET_CASELIST_FORMAT[dataset]
  if (!format) return false
  return sameFormat(caselist, { event: format.event === "policy" ? "cx" : format.event, level: format.level })
}

// ── Step 1: finding and saving the team's pages ──────────────────────────────

/** What the admin asked for: a ranked team, or an openCaselist page URL. */
export type TeamSyncQuery = { dataset: string; school: string; team: string } | { url: string }

/** One team page found on openCaselist. */
export interface FoundTeamPage {
  caselist: CaselistInfo
  school: CaselistSchool
  team: CaselistTeam
}

/** `https://opencaselist.com/ndtceda26/Emory/GaYo` → its three path parts. */
export function parseCaselistPageUrl(url: string): { caselist: string; school: string; team: string } | null {
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    return null
  }
  if (!/(^|\.)opencaselist\.com$/i.test(parsed.hostname)) return null
  const parts = parsed.pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part))
  if (parts.length < 3 || !/^[a-z]+\d{2}$/i.test(parts[0])) return null
  return { caselist: parts[0], school: parts[1], team: parts[2] }
}

export function caselistPageUrl(caselist: string, school: string, team: string): string {
  return `https://opencaselist.com/${[caselist, school, team].map(encodeURIComponent).join("/")}`
}

/**
 * Finds a team's page in every season of its format, newest first.
 *
 * A ranked team is matched by school name and debater surnames in each
 * season. A page URL is taken as given, and its debaters' surnames are then
 * looked for under the same school in the format's other seasons, so a pasted
 * `ndtceda26/Emory/GaYo` also brings `ndtceda25/Emory/GaYo`.
 */
export async function findTeamPages(
  client: CaselistClient,
  query: TeamSyncQuery,
  options: { maxSeasons?: number } = {},
): Promise<FoundTeamPage[]> {
  const all = await client.caselists({ archived: true })
  const maxSeasons = options.maxSeasons ?? MAX_SYNC_SEASONS
  const found: FoundTeamPage[] = []
  let schoolName: string
  let lastNames: string[]
  let seasons: CaselistInfo[]

  if ("url" in query) {
    const page = parseCaselistPageUrl(query.url)
    if (!page) throw new Error("Not an openCaselist team page URL (https://opencaselist.com/<caselist>/<school>/<team>)")
    const caselist = all.find((entry) => entry.name.toLowerCase() === page.caselist.toLowerCase())
    if (!caselist) throw new Error(`openCaselist has no caselist "${page.caselist}"`)
    const schools = await client.schools(caselist.name)
    const school =
      schools.find((entry) => entry.name.toLowerCase() === page.school.toLowerCase()) ??
      matchCaselistSchool(schools, page.school)
    if (!school) throw new Error(`No school "${page.school}" in ${caselist.display_name}`)
    const team = await client.team(caselist.name, school.name, page.team)
    found.push({ caselist, school, team })
    schoolName = school.display_name ?? school.name
    lastNames = teamDebaters(team)
    seasons = all.filter((entry) => entry.name !== caselist.name && sameFormat(entry, caselist))
  } else {
    if (!DATASET_CASELIST_FORMAT[query.dataset]) throw new Error(`Unknown rankings dataset "${query.dataset}"`)
    schoolName = query.school
    lastNames = rankedTeamLastNames(query.team)
    seasons = all.filter((entry) => caselistMatchesDataset(entry, query.dataset))
  }

  if (lastNames.length === 0) return found
  seasons = [...seasons].sort((a, b) => b.year - a.year).slice(0, Math.max(0, maxSeasons - found.length))
  for (const caselist of seasons) {
    const school = matchCaselistSchool(await client.schools(caselist.name).catch(() => []), schoolName)
    if (!school) continue
    const teams = await client.teams(caselist.name, school.name).catch(() => [] as CaselistTeam[])
    const team = matchCaselistTeam(teams, lastNames)
    if (team) found.push({ caselist, school, team })
  }
  return found.sort((a, b) => b.caselist.year - a.caselist.year)
}

/** One saved page, as the admin panel lists it. */
export interface SyncedTeamPage {
  id: string
  caselist: string
  caselistLabel: string
  year: number
  school: string
  team: string
  teamDisplayName: string
  debaters: string[]
  pageUrl: string
  rounds: number
  cites: number
  files: number
  storedFiles: number
  syncedAt: number
}

/** What step 1 answers. */
export interface TeamPagesSyncResult {
  pages: SyncedTeamPage[]
  /** Open-source paths whose file is not stored yet, newest season first. */
  pendingFiles: string[]
}

/** Insert rows in groups small enough for D1's 100 bound parameters. */
async function insertChunked<T extends Record<string, unknown>>(
  rows: T[],
  columns: number,
  insert: (chunk: T[]) => Promise<unknown>,
): Promise<void> {
  const perChunk = Math.max(1, Math.floor(100 / columns))
  for (let index = 0; index < rows.length; index += perChunk) await insert(rows.slice(index, index + perChunk))
}

/** Ids of the `caselist_documents` rows that exist, out of `ids`. */
async function existingDocumentIds(db: Database, ids: number[]): Promise<Set<number>> {
  const found = new Set<number>()
  for (const chunk of chunkBoundParams([...new Set(ids)])) {
    const rows = await db.select({ id: caselistDocuments.id }).from(caselistDocuments).where(inArray(caselistDocuments.id, chunk))
    for (const row of rows as { id: number }[]) found.add(row.id)
  }
  return found
}

/**
 * The `caselist_documents` id a team file is stored under: FNV-1a over its
 * path hash, kept to 53 bits so it survives a round trip through JavaScript
 * numbers (`caselistDocumentId` can exceed `Number.MAX_SAFE_INTEGER`).
 */
export function teamFileDocumentId(path: string): number {
  const pathHash = buildPathHash(path.split("/")[0], path)
  let high = 0x811c9dc5
  let low = 0x01000193
  for (let index = 0; index < pathHash.length; index++) {
    const code = pathHash.charCodeAt(index)
    high = Math.imul(high ^ code, 0x01000193) >>> 0
    low = Math.imul(low ^ (code + index), 0x5bd1e995) >>> 0
  }
  return (high & 0x1fffff) * 2 ** 32 + low
}

/** Saves one found page with its rounds and cites, replacing an earlier sync of it. */
async function savePage(
  db: Database,
  client: CaselistClient,
  page: FoundTeamPage,
  meta: { lookupKey: string; actor: string; now: number },
): Promise<void> {
  const { caselist, school, team } = page
  const [rounds, cites] = await Promise.all([
    client.rounds(caselist.name, school.name, team.name),
    client.cites(caselist.name, school.name, team.name),
  ])
  const id = `${caselist.name}/${school.name}/${team.name}`
  const debaters = teamDebaters(team)
  const paths = rounds.map((round) => round.opensource).filter((path): path is string => Boolean(path && isOpenSourcePath(path)))
  const stored = await existingDocumentIds(db, paths.map(teamFileDocumentId))

  const row = {
    id,
    caselistSlug: caselist.name,
    caselistLabel: caselist.display_name,
    event: caselist.event,
    level: caselist.level,
    year: caselist.year,
    schoolName: school.name,
    schoolDisplayName: school.display_name ?? school.name,
    teamName: team.name,
    teamDisplayName: team.display_name,
    debaters: JSON.stringify(debaters),
    debatersKey: debatersKey(debaters),
    lookupKey: meta.lookupKey,
    pageUrl: caselistPageUrl(caselist.name, school.name, team.name),
    roundCount: rounds.length,
    citeCount: cites.length,
    fileCount: new Set(paths).size,
    syncedAt: meta.now,
    syncedBy: meta.actor,
  }
  const { id: _id, lookupKey, ...update } = row
  await db
    .insert(caselistTeamPages)
    .values(row)
    .onConflictDoUpdate({
      target: caselistTeamPages.id,
      // A later URL sync must not erase the ranked-team key an earlier search stored.
      set: lookupKey ? { ...update, lookupKey } : update,
    })

  await db.delete(caselistTeamRounds).where(eq(caselistTeamRounds.pageId, id))
  await db.delete(caselistTeamCites).where(eq(caselistTeamCites.pageId, id))

  const roundRows = rounds.map((round) => {
    const path = round.opensource && isOpenSourcePath(round.opensource) ? round.opensource : null
    const documentId = path ? teamFileDocumentId(path) : null
    return {
      roundId: round.round_id,
      pageId: id,
      side: round.side ?? "",
      tournament: round.tournament ?? "",
      round: String(round.round ?? ""),
      opponent: round.opponent,
      judge: round.judge,
      report: round.report,
      opensource: round.opensource,
      video: round.video,
      createdAt: round.created_at ?? null,
      documentId: documentId !== null && stored.has(documentId) ? documentId : null,
    }
  })
  await insertChunked(roundRows, 12, (chunk) =>
    db.insert(caselistTeamRounds).values(chunk).onConflictDoNothing(),
  )

  const citeRows = cites.map((cite) => ({
    citeId: cite.cite_id,
    pageId: id,
    roundId: cite.round_id ?? null,
    title: cite.title ?? "",
    cites: cite.cites ?? "",
    side: cite.side ?? null,
    tournament: cite.tournament ?? null,
    round: cite.round ?? null,
    opponent: cite.opponent ?? null,
    judge: cite.judge ?? null,
    createdAt: cite.created_at ?? null,
  }))
  await insertChunked(citeRows, 11, (chunk) => db.insert(caselistTeamCites).values(chunk).onConflictDoNothing())
}

/**
 * Step 1: finds the team's pages in every season and saves them.
 *
 * @param actor - Who ran the sync, recorded on each page.
 */
export async function syncTeamPages(
  db: Database,
  client: CaselistClient,
  query: TeamSyncQuery,
  actor: string,
  options: { maxSeasons?: number; now?: number } = {},
): Promise<TeamPagesSyncResult> {
  await ensureCaselistTeamTables(db)
  const found = await findTeamPages(client, query, options)
  const lookupKey = "url" in query ? "" : teamLookupKey(query.dataset, query.school, query.team)
  const now = options.now ?? Math.floor(Date.now() / 1000)
  for (const page of found) await savePage(db, client, page, { lookupKey, actor, now })
  const ids = found.map((page) => `${page.caselist.name}/${page.school.name}/${page.team.name}`)
  return { pages: await listSyncedPages(db, { ids }), pendingFiles: await pendingFiles(db, ids) }
}

/** Open-source paths on these pages whose file is not stored yet, newest season first. */
export async function pendingFiles(db: Database, pageIds: string[]): Promise<string[]> {
  if (pageIds.length === 0) return []
  const rows = (await db
    .select({ path: caselistTeamRounds.opensource, pageId: caselistTeamRounds.pageId, createdAt: caselistTeamRounds.createdAt })
    .from(caselistTeamRounds)
    .where(
      and(
        inArray(caselistTeamRounds.pageId, pageIds.slice(0, 90)),
        isNotNull(caselistTeamRounds.opensource),
        isNull(caselistTeamRounds.documentId),
      ),
    )) as { path: string | null; pageId: string; createdAt: string | null }[]
  const order = new Map(pageIds.map((id, index) => [id, index]))
  rows.sort(
    (a, b) => (order.get(a.pageId) ?? 0) - (order.get(b.pageId) ?? 0) || (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
  )
  return [...new Set(rows.map((row) => row.path).filter((path): path is string => Boolean(path && isOpenSourcePath(path))))]
}

/** Saved pages, newest sync first; `ids` narrows to those pages. */
export async function listSyncedPages(
  db: Database,
  options: { ids?: string[]; limit?: number } = {},
): Promise<SyncedTeamPage[]> {
  await ensureCaselistTeamTables(db)
  if (options.ids && options.ids.length === 0) return []
  const base = db.select().from(caselistTeamPages)
  const pages = (await (options.ids
    ? base.where(inArray(caselistTeamPages.id, options.ids.slice(0, 90)))
    : base.orderBy(desc(caselistTeamPages.syncedAt), desc(caselistTeamPages.year)).limit(options.limit ?? 50))) as CaselistTeamPageRow[]
  if (pages.length === 0) return []
  const storedCounts = new Map<string, number>()
  const counts = (await db
    .select({ pageId: caselistTeamRounds.pageId, stored: sql<number>`count(distinct ${caselistTeamRounds.documentId})` })
    .from(caselistTeamRounds)
    .where(and(inArray(caselistTeamRounds.pageId, pages.map((page) => page.id)), isNotNull(caselistTeamRounds.documentId)))
    .groupBy(caselistTeamRounds.pageId)) as { pageId: string; stored: number }[]
  for (const row of counts) storedCounts.set(row.pageId, Number(row.stored))
  const result = pages.map((page) => ({
    id: page.id,
    caselist: page.caselistSlug,
    caselistLabel: page.caselistLabel,
    year: page.year,
    school: page.schoolDisplayName,
    team: page.teamName,
    teamDisplayName: page.teamDisplayName,
    debaters: parseDebaters(page.debaters),
    pageUrl: page.pageUrl,
    rounds: page.roundCount,
    cites: page.citeCount,
    files: page.fileCount,
    storedFiles: storedCounts.get(page.id) ?? 0,
    syncedAt: page.syncedAt,
  }))
  return options.ids ? result.sort((a, b) => b.year - a.year) : result
}

function parseDebaters(json: string): string[] {
  try {
    const value = JSON.parse(json) as unknown
    return Array.isArray(value) ? value.map(String) : []
  } catch {
    return []
  }
}

// ── Step 2: one open-source file ─────────────────────────────────────────────

/** What step 2 answers for one file. */
export interface TeamFileSyncResult {
  path: string
  documentId: number
  fileName: string
  bytes: number
  /** Whether the file was converted to HTML (a `.docx` that opened). */
  converted: boolean
  cardCount: number
  /** Why the conversion failed, when it did; the original file is kept either way. */
  conversionError?: string
}

/** Rough card count of converted HTML: Verbatim tags each card with a Heading 4. */
export function countCards(html: string): number {
  return (html.match(/<h4[\s>]/gi) ?? []).length
}

const SIDE_NAMES: Record<string, string> = { A: "Aff", N: "Neg" }

/**
 * Step 2: downloads one open-source file, stores its HTML and bytes in R2
 * and its metadata in `caselist_documents`, and links the rounds that list it.
 */
export async function syncTeamFile(
  db: Database,
  bucket: CaselistFileBucket,
  client: CaselistClient,
  path: string,
): Promise<TeamFileSyncResult> {
  if (!isOpenSourcePath(path)) throw new Error("Not a caselist open-source path")
  await ensureCaselistTeamTables(db)

  const [round] = (await db
    .select({ side: caselistTeamRounds.side, createdAt: caselistTeamRounds.createdAt, label: caselistTeamPages.caselistLabel })
    .from(caselistTeamRounds)
    .leftJoin(caselistTeamPages, eq(caselistTeamPages.id, caselistTeamRounds.pageId))
    .where(eq(caselistTeamRounds.opensource, path))
    .limit(1)) as { side: string; createdAt: string | null; label: string | null }[]

  const upstream = await client.download(path)
  const bytes = await upstream.arrayBuffer()
  const fileName = openSourceFileName(path)
  const [slug, school, team] = path.split("/")
  const documentId = teamFileDocumentId(path)

  await bucket.put(caselistFileKey(path), bytes, {
    httpMetadata: {
      contentType: caselistFileContentType(fileName),
      contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  })

  let html = ""
  let conversionError: string | undefined
  if (/\.docx$/i.test(fileName)) {
    try {
      html = await docxBytesToHtml(bytes)
    } catch (error) {
      conversionError = describeDocxImportError(error).reason
    }
  } else {
    conversionError = "Only .docx files are converted to text; the original file is stored."
  }
  if (html) {
    await bucket.put(caselistDocKey(documentId), html, { httpMetadata: { contentType: "text/html; charset=utf-8" } })
  }

  const cardCount = countCards(html)
  const document = {
    id: documentId,
    pathHash: buildPathHash(slug, path),
    caselistSlug: slug,
    caselistLabel: round?.label ?? slug,
    school,
    team,
    side: SIDE_NAMES[(round?.side ?? "").toUpperCase()] ?? null,
    fileName,
    archivePath: path,
    // The HTML lives in R2 (caselist-docs/<id>.html), as for moved bulk documents.
    html: "",
    cardCount,
    archiveDate: round?.createdAt ?? null,
  }
  const { id: _id, pathHash: _hash, ...update } = document
  await db
    .insert(caselistDocuments)
    .values(document)
    .onConflictDoUpdate({ target: caselistDocuments.id, set: { ...update, ingestedAt: new Date() } })
  await db.update(caselistTeamRounds).set({ documentId }).where(eq(caselistTeamRounds.opensource, path))

  return {
    path,
    documentId,
    fileName,
    bytes: bytes.byteLength,
    converted: Boolean(html),
    cardCount,
    ...(conversionError ? { conversionError } : {}),
  }
}

// ── Reading a team's saved pages for its profile ─────────────────────────────

/** URL the profile reads a stored document's text from. */
export function openSourceTextUrl(path: string): string {
  return `/api/caselist-team/text?path=${encodeURIComponent(path)}`
}

function roundFromRow(row: CaselistTeamRoundRow) {
  return {
    round_id: row.roundId,
    team_id: 0,
    side: row.side,
    tournament: row.tournament,
    round: row.round,
    opponent: row.opponent,
    judge: row.judge,
    report: row.report,
    opensource: row.opensource,
    video: row.video,
    created_at: row.createdAt ?? undefined,
  }
}

function citeFromRow(row: CaselistTeamCiteRow) {
  return {
    cite_id: row.citeId,
    round_id: row.roundId ?? 0,
    title: row.title,
    cites: row.cites,
    side: row.side,
    tournament: row.tournament,
    round: row.round,
    opponent: row.opponent,
    judge: row.judge,
    created_at: row.createdAt ?? undefined,
  }
}

const newestFirst = <T extends { createdAt: string | null }>(rows: T[]) =>
  [...rows].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))

/**
 * A ranked team's synced caselist pages, every season, as the profile's
 * payload — or `null` when an admin has not synced this team.
 *
 * A page belongs to the team when the admin search for exactly this team
 * stored it, or when its debaters' surnames are the team's and its school
 * and format match.
 */
export async function readStoredTeamCaselist(
  db: Database,
  query: { dataset: string; school: string; team: string },
): Promise<TeamCaselistPayload | null> {
  await ensureCaselistTeamTables(db)
  const lookupKey = teamLookupKey(query.dataset, query.school, query.team)
  const namesKey = debatersKey(rankedTeamLastNames(query.team))
  const candidates = (await db
    .select()
    .from(caselistTeamPages)
    .where(
      namesKey
        ? or(eq(caselistTeamPages.lookupKey, lookupKey), eq(caselistTeamPages.debatersKey, namesKey))
        : eq(caselistTeamPages.lookupKey, lookupKey),
    )
    .limit(60)) as CaselistTeamPageRow[]
  const pages = candidates
    .filter(
      (page) =>
        page.lookupKey === lookupKey ||
        (caselistMatchesDataset(page, query.dataset) &&
          schoolMatchScore({ name: page.schoolName, display_name: page.schoolDisplayName }, query.school) > 0),
    )
    .sort((a, b) => b.year - a.year)
  if (pages.length === 0) return null

  const ids = pages.map((page) => page.id)
  const rounds = (await db.select().from(caselistTeamRounds).where(inArray(caselistTeamRounds.pageId, ids))) as CaselistTeamRoundRow[]
  const cites = (await db.select().from(caselistTeamCites).where(inArray(caselistTeamCites.pageId, ids))) as CaselistTeamCiteRow[]

  const seasons: TeamCaselistSeason[] = pages.map((page) => {
    const pageRounds = newestFirst(rounds.filter((round) => round.pageId === page.id))
    const roundsById = new Map(pageRounds.map((round) => [round.roundId, roundFromRow(round)]))
    return {
      caselist: {
        name: page.caselistSlug,
        displayName: page.caselistLabel,
        event: page.event,
        level: page.level,
        year: page.year,
      },
      school: { name: page.schoolName, displayName: page.schoolDisplayName },
      team: { name: page.teamName, displayName: page.teamDisplayName, debaters: parseDebaters(page.debaters) },
      pageUrl: page.pageUrl,
      syncedAt: page.syncedAt,
      rounds: pageRounds.map((row) => {
        const shaped = shapeRound(roundFromRow(row), page.event)
        return shaped.file && row.documentId !== null
          ? { ...shaped, file: { ...shaped.file, stored: true, textUrl: openSourceTextUrl(shaped.file.path) } }
          : shaped
      }),
      cites: newestFirst(cites.filter((cite) => cite.pageId === page.id))
        .filter((cite) => cite.cites.trim() || cite.title)
        .map((cite) => shapeCite(citeFromRow(cite), roundsById, page.event)),
    }
  })

  const [newest] = seasons
  return {
    configured: true,
    found: true,
    stored: true,
    caselist: newest.caselist,
    school: newest.school,
    team: newest.team,
    pageUrl: newest.pageUrl,
    rounds: newest.rounds,
    cites: newest.cites,
    syncedAt: newest.syncedAt,
    seasons,
  }
}

/** A stored document's HTML (from R2) and file name, by its open-source path. */
export async function readStoredTeamFileText(
  db: Database,
  bucket: CaselistFileBucket,
  path: string,
): Promise<{ fileName: string; html: string; cardCount: number } | null> {
  const documentId = teamFileDocumentId(path)
  const [row] = (await db
    .select({ fileName: caselistDocuments.fileName, html: caselistDocuments.html, cardCount: caselistDocuments.cardCount })
    .from(caselistDocuments)
    .where(eq(caselistDocuments.id, documentId))
    .limit(1)) as { fileName: string; html: string; cardCount: number }[]
  if (!row) return null
  const html = row.html || (await (await bucket.get(caselistDocKey(documentId)))?.text()) || ""
  return { fileName: row.fileName, html, cardCount: row.cardCount }
}
