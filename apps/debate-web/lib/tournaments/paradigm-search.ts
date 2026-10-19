/**
 * Finds judges' Tabroom paradigms by name, for `/tournaments` pairings whose
 * judges don't already carry a paradigm id (tournaments hosted here, whose
 * judges have no Tabroom person row).
 *
 * Tabroom's JSON paradigm search (`api.tabroom.com/v1/rest/paradigms`) needs a
 * signed-in Tabroom account, so this searches the public paradigm page on
 * tabroom.com instead — the same search `tabroom.com/index/paradigm.mhtml`
 * offers anyone — and reads each result row's first name, last name and
 * `judge_person_id`. A name answers with an id only when exactly one judge
 * has that first and last name; anything else answers `null`, so a common
 * name is never linked to the wrong person.
 *
 * Mounted at `/api/tabroom-paradigms` by `app/api/tabroom-paradigms/route.ts`:
 * `GET ?name=First|Last&name=…` answers `{ "first last": personId | null }`.
 */

export const TABROOM_PARADIGM_SEARCH = "https://www.tabroom.com/index/paradigm.mhtml"

/** Most names one request may ask for; the client batches to the same size. */
export const MAX_NAMES = 40
const CONCURRENCY = 6
const UPSTREAM_TIMEOUT_MS = 8_000
/** How long an answer is kept in this isolate and in caches downstream. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const MAX_CACHED = 2_000

/** `first last`, lower-cased, as the response keys it. */
export const judgeKey = (first: string, last: string) => `${first.trim()} ${last.trim()}`.toLowerCase()

const normalize = (text: string) =>
  text
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()

/** The text of each `<td>` in a table row. */
function cells(row: string): string[] {
  return [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => normalize(match[1].replace(/<[^>]*>/g, " ")))
}

/**
 * The Tabroom person id of the one judge on a paradigm search page named
 * `first last`, or `null` when none or several are.
 */
export function parseParadigmSearch(html: string, first: string, last: string): number | null {
  const wantFirst = normalize(first)
  const wantLast = normalize(last)
  const ids = new Set<number>()
  for (const [row] of html.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)) {
    const id = /judge_person_id=(\d+)/.exec(row)?.[1]
    if (!id) continue
    const texts = cells(row)
    if (texts.includes(wantFirst) && texts.includes(wantLast)) ids.add(Number(id))
  }
  return ids.size === 1 ? [...ids][0] : null
}

const cache = new Map<string, { id: number | null; at: number }>()

/** Searches Tabroom for one judge; `null` on no single match or on any failure. */
export async function searchParadigm(first: string, last: string, fetchImpl: typeof fetch = fetch): Promise<number | null> {
  const key = judgeKey(first, last)
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.id

  const url = new URL(TABROOM_PARADIGM_SEARCH)
  url.searchParams.set("search_first", first.trim())
  url.searchParams.set("search_last", last.trim())
  let id: number | null = null
  try {
    const res = await fetchImpl(url, { headers: { accept: "text/html" }, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) })
    if (!res.ok) return null
    id = parseParadigmSearch(await res.text(), first, last)
  } catch {
    // Unreachable or too slow: answer without caching, so the next page load retries.
    return null
  }
  if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value as string)
  cache.set(key, { id, at: Date.now() })
  return id
}

/** Reads `?name=First|Last` pairs, de-duplicated and capped at {@link MAX_NAMES}. */
export function parseNames(requestUrl: string): Array<{ first: string; last: string }> {
  const seen = new Map<string, { first: string; last: string }>()
  for (const value of new URL(requestUrl).searchParams.getAll("name")) {
    const [first = "", last = ""] = value.split("|")
    if (!first.trim() || !last.trim() || first.length > 60 || last.length > 60) continue
    seen.set(judgeKey(first, last), { first: first.trim(), last: last.trim() })
    if (seen.size >= MAX_NAMES) break
  }
  return [...seen.values()]
}

/** The `/api/tabroom-paradigms` handler. */
export async function handleParadigmSearch(request: Request, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const names = parseNames(request.url)
  const found: Record<string, number | null> = {}
  for (let i = 0; i < names.length; i += CONCURRENCY) {
    const chunk = names.slice(i, i + CONCURRENCY)
    const ids = await Promise.all(chunk.map(({ first, last }) => searchParadigm(first, last, fetchImpl)))
    chunk.forEach(({ first, last }, j) => {
      found[judgeKey(first, last)] = ids[j]
    })
  }
  return new Response(JSON.stringify(found), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=${CACHE_TTL_MS / 1000}, s-maxage=${CACHE_TTL_MS / 1000}`,
    },
  })
}

/** Clears the in-isolate cache (tests). */
export function clearParadigmCache() {
  cache.clear()
}
