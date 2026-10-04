import type { Round } from "debate"

// The definitions (and their field docs) live in `@types/debate`.
export type { ArgumentType, EvidenceStatus, Box, Flow, Round } from "debate"

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
