/**
 * @fileoverview College Debate Results (collegedebateresults.vercel.app) as a
 * source of who debated in college. The Greatest of All Time high school
 * lists give each debater one college point just for appearing there
 * (`hsAllTimeTeams`), whether or not they scored at the NDT.
 *
 * The site's public JSON backend lists every debater it has results for
 * (2003-04 on, `GET /debaters`) and, per debater, the schools and seasons they
 * competed in (`GET /debaters/{code}/season-summary`). Fetching that for every
 * high school debater on each page load is not practical, so
 * `bun run sync-college-participants` queries it once and writes the debaters
 * whose name matches a high school debater to
 * `data/college-results-participants.json`, which the lists bundle.
 * @module sync/college-participants
 */

/** The JSON backend behind collegedebateresults.vercel.app. */
export const COLLEGE_RESULTS_API = "https://backend-production-4460.up.railway.app/api"

/** The public site. */
export const COLLEGE_RESULTS_SITE = "https://collegedebateresults.vercel.app"

/** One debater in `GET /debaters`. */
export interface CollegeResultsDebater {
  debater_code: string
  first_name: string | null
  last_name: string | null
  tournaments_attended?: number
}

/** One season in `GET /debaters/{code}/season-summary`. */
export interface CollegeResultsSeason {
  /** `"2020-2021"`. */
  season: string
  school: string | null
}

/** A college debater found in College Debate Results. */
export interface CollegeParticipant {
  /** The site's debater code; the site tells two people of one name apart by a trailing number (`ASHTONSMITH1`). */
  code: string
  /** `"First Last"`, as the site spells them. */
  name: string
  /** The school of their latest season, as the site names it (`"Emory"`). */
  school: string
  /** The year the first season they competed in ended in (`"2020-2021"` is 2021). */
  firstYear: number
  /** The year the last season they competed in ended in. */
  lastYear: number
}

/** The year a `"2020-2021"` season ends in, or `null` for anything else. */
export function seasonEndYear(season: string): number | null {
  const match = /^(\d{4})-(\d{4})$/.exec(season.trim())
  return match ? Number(match[2]) : null
}

/** A debater's full name from the site's first and last name, or `null` when either is missing or a placeholder. */
export function participantName(debater: Pick<CollegeResultsDebater, "first_name" | "last_name">): string | null {
  const first = debater.first_name?.trim()
  const last = debater.last_name?.trim()
  if (!first || !last || first === "?" || last === "?" || /^debater$/i.test(first)) return null
  return `${first} ${last}`
}

/** The site names a joint squad `FigBow\Emory`; the last part is the school the debater's results count for. */
function cleanSchool(school: string): string {
  return school.split("\\").at(-1)?.trim() ?? school
}

/**
 * A listed debater's record from their seasons, or `null` when the name is
 * unusable or the site has no season for them.
 *
 * @param seasons - The debater's `season-summary` rows, in any order.
 */
export function buildParticipant(
  debater: CollegeResultsDebater,
  seasons: readonly CollegeResultsSeason[],
): CollegeParticipant | null {
  const name = participantName(debater)
  if (!name) return null
  const dated = seasons
    .map((s) => ({ year: seasonEndYear(s.season), school: s.school?.trim() ?? "" }))
    .filter((s): s is { year: number; school: string } => s.year !== null)
    .sort((a, b) => a.year - b.year)
  if (!dated.length) return null
  const latest = [...dated].reverse().find((s) => s.school)
  return {
    code: debater.debater_code,
    name,
    school: latest ? cleanSchool(latest.school) : "",
    firstYear: dated[0].year,
    lastYear: dated[dated.length - 1].year,
  }
}

/** Fetches `path` from the College Debate Results backend and parses it as JSON. */
export type CollegeResultsGetJson = <T>(path: string) => Promise<T>

/** {@link CollegeResultsGetJson} over `fetch`, retrying a failed request a few times. */
export function collegeResultsFetcher(fetcher: typeof fetch = fetch, retries = 3): CollegeResultsGetJson {
  return async <T>(path: string) => {
    let lastError: unknown
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetcher(`${COLLEGE_RESULTS_API}${path}`, { headers: { accept: "application/json" } })
        if (!res.ok) throw new Error(`College Debate Results ${path}: HTTP ${res.status}`)
        return (await res.json()) as T
      } catch (error) {
        lastError = error
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
      }
    }
    throw lastError
  }
}

/**
 * Looks up the debaters College Debate Results lists whose name `wanted`
 * accepts, with their seasons.
 *
 * @param wanted - Whether a listed full name is worth fetching seasons for.
 * @param concurrency - Season requests in flight at once.
 * @returns The participants, sorted by name then code.
 */
export async function fetchCollegeParticipants(
  getJson: CollegeResultsGetJson,
  wanted: (fullName: string) => boolean,
  concurrency = 6,
): Promise<{ participants: CollegeParticipant[]; listed: number; candidates: number }> {
  const listed = await getJson<CollegeResultsDebater[]>("/debaters?q=")
  const candidates = listed.filter((d) => {
    const name = participantName(d)
    return name !== null && wanted(name)
  })
  const participants: CollegeParticipant[] = []
  let next = 0
  const worker = async () => {
    for (let i = next++; i < candidates.length; i = next++) {
      const debater = candidates[i]
      const seasons = await getJson<CollegeResultsSeason[]>(
        `/debaters/${encodeURIComponent(debater.debater_code)}/season-summary`,
      )
      const participant = buildParticipant(debater, seasons)
      if (participant) participants.push(participant)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, candidates.length) }, worker))
  participants.sort((a, b) => a.name.localeCompare(b.name) || a.code.localeCompare(b.code))
  return { participants, listed: listed.length, candidates: candidates.length }
}
