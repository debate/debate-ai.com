/** Finer argument-role tag for a flowed row, beyond the plain heading/argument split. */
export type ArgumentType = 'contention' | 'link' | 'impact' | 'turn' | 'answer' | 'extension'

/** How well-supported a flowed row's evidence is, independent of whether it's been answered. */
export type EvidenceStatus = 'cited' | 'contested' | 'unverified'

export type Box = {
  content: string
  children: Box[]
  index: number
  level: number
  focus: boolean
  empty?: boolean
  placeholder?: string
  crossed?: boolean
  /** Marks this row as a collapsible section heading in the flow grid */
  isHeading?: boolean
  /** Finer argument-role tag for this row (link/impact/turn/answer/extension/...) */
  argumentType?: ArgumentType
  /** Id of the debater/speaker who introduced this row, e.g. for outline filtering by contributor */
  authorId?: string
  /** How well-supported this row's evidence is */
  evidenceStatus?: EvidenceStatus
}

export type Flow = {
  content: string
  level: number
  columns: string[]
  invert: boolean
  focus: boolean
  index: number
  lastFocus: number[]
  children: Box[]
  id: number
  speechDocs?: Record<string, string>
  sharedSpeeches?: Record<string, { timestamp: number; emails: string[] }>
  archived?: boolean
  roundId?: number
  speechNumber?: number
  winner?: "aff" | "neg" | "undecided"
}

export type Round = {
  id: number
  tournamentName: string
  roundLevel: string
  debaters: {
    aff: [string, string]
    neg: [string, string]
  }
  schools?: {
    aff: [string, string]
    neg: [string, string]
  }
  judges: string[]
  spectators?: string[]
  flowIds: number[]
  timestamp: number
  status: "pending" | "active" | "completed"
  isPrivate?: boolean
  winner?: "aff" | "neg"
  /** Formatted title: "2025 Glenbrooks - Octos - Lynbrook BZ vs Monta Vista EY" */
  title?: string
  /** URL slug: "2025-glenbrooks/lynbrook-bz-monta-ey" */
  slug?: string
}

/**
 * Generates a formatted title for a debate round
 * Format: "2025 Glenbrooks - Octos - Lynbrook BZ vs Monta Vista EY"
 */
export function generateRoundTitle(round: Pick<Round, 'tournamentName' | 'roundLevel' | 'schools'>): string {
  const year = new Date().getFullYear()
  const affSchool = round.schools?.aff[0] || 'Team Aff'
  const negSchool = round.schools?.neg[0] || 'Team Neg'

  return `${year} ${round.tournamentName} - ${round.roundLevel} - ${affSchool} vs ${negSchool}`
}

/**
 * Generates a URL slug for a debate round
 * Format: "2025-glenbrooks/lynbrook-bz-monta-ey"
 */
export function generateRoundSlug(round: Pick<Round, 'tournamentName' | 'schools'>): string {
  const year = new Date().getFullYear()
  const tournament = round.tournamentName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  const affSchool = (round.schools?.aff[0] || 'team-aff')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  const negSchool = (round.schools?.neg[0] || 'team-neg')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  return `${year}-${tournament}/${affSchool}-${negSchool}`
}
