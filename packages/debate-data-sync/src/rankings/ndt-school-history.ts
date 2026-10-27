/**
 * @fileoverview Parses the National Debate Tournament's "School History"
 * export (`ndt-history.html`, an accordion with one panel per college) into
 * per-school NDT records: years attended, elim qualifiers, championships,
 * speaker awards, first-round at-large bids, coaching awards and Copeland
 * award winners. `bun run build-ndt-history -- <ndt-history.html>` writes
 * `data/ndt-school-history.json`, which the school profile page renders.
 * @module rankings/ndt-school-history
 */

export interface NdtTeamResult {
  year: number
  /** Debaters, as the NDT lists them. */
  team: string
  /** Elim round reached ("Octas" … "Champion"); absent outside elim lists. */
  round?: string
  /** Prelim record, e.g. `5-3`. */
  record?: string
  seed?: number
  /** First-round at-large bid rank. */
  rank?: number
}

export interface NdtSpeakerAward {
  year: number
  speaker: string
  /** Speaker rank the award was won at. */
  rank?: number
}

export interface NdtCoachingAward {
  year: number
  coach: string
  award: string
}

export interface NdtSchoolHistory {
  /** School name as the NDT prints it, e.g. `Harvard University (MA)`. */
  school: string
  years: number[]
  elims: NdtTeamResult[]
  championships: NdtTeamResult[]
  atLargeBids: NdtTeamResult[]
  copelandWinners: NdtTeamResult[]
  speakerAwards: NdtSpeakerAward[]
  coachingAwards: NdtCoachingAward[]
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#039;": "'", "&#8217;": "’" }

function decode(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|#039|#8217);/g, (m) => ENTITIES[m] ?? m)
}

/** Tag-free, whitespace-collapsed lines of one `<li>`, with the year link first. */
function itemText(li: string): string {
  return decode(li.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()
}

function parseTeamItem(text: string): NdtTeamResult | null {
  const match = text.match(/^(\d{4})\s*(Octas|Doubles|Quarters|Semis|Finals|Champion)?\s*-\s*(.+?)(?:\s*\((?:(\d+-\d+)(?:,\s*Seed:\s*(\d+))?|Rank:\s*(\d+))\))?$/)
  if (!match) return null
  const [, year, round, team, record, seed, rank] = match
  return {
    year: Number(year),
    team: team.trim(),
    ...(round && { round }),
    ...(record && { record }),
    ...(seed && { seed: Number(seed) }),
    ...(rank && { rank: Number(rank) }),
  }
}

function listItems(section: string): string[] {
  return [...section.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => itemText(m[1]))
}

/**
 * Parses the saved NDT school-history page.
 *
 * @param html - Contents of `ndt-history.html`.
 * @returns One entry per school, in page (alphabetical) order.
 */
export function parseNdtSchoolHistory(html: string): NdtSchoolHistory[] {
  const schools: NdtSchoolHistory[] = []
  const blocks = html.split(/<button class="accordion[^"]*"[^>]*>/).slice(1)
  for (const block of blocks) {
    const nameEnd = block.indexOf("</button>")
    const school = decode(block.slice(0, nameEnd)).trim()
    const history: NdtSchoolHistory = {
      school,
      years: [],
      elims: [],
      championships: [],
      atLargeBids: [],
      copelandWinners: [],
      speakerAwards: [],
      coachingAwards: [],
    }
    for (const section of block.slice(nameEnd).split(/<div class="section">/).slice(1)) {
      const title = section.match(/<strong>\s*([^<(]+?)\s*\(\d+\):?\s*<\/strong>/)?.[1]
      if (title === "Years in Attendance") {
        history.years = [...section.matchAll(/>(\d{4})<\/a>/g)].map((m) => Number(m[1]))
        continue
      }
      const items = listItems(section)
      const teams = () => items.map(parseTeamItem).filter((item): item is NdtTeamResult => item !== null)
      if (title === "Elim Qualifiers") history.elims = teams()
      else if (title === "Championships") history.championships = teams()
      else if (title === "First Round At-Large Bids") history.atLargeBids = teams()
      else if (title === "Copeland Award Winners") history.copelandWinners = teams()
      else if (title === "Speaker Awards") {
        for (const item of items) {
          const m = item.match(/^(\d{4})\s*-\s*(.+?)(?:\s*\(\s*(\d+)\s*\))?$/)
          if (m) history.speakerAwards.push({ year: Number(m[1]), speaker: m[2].trim(), ...(m[3] && { rank: Number(m[3]) }) })
        }
      } else if (title === "Coaching Awards") {
        for (const item of items) {
          const m = item.match(/^(\d{4})\s*-\s*(.+?)\s*-\s*(.+)$/)
          if (m) history.coachingAwards.push({ year: Number(m[1]), coach: m[2].trim(), award: m[3].trim() })
        }
      }
    }
    schools.push(history)
  }
  return schools
}
