/**
 * @fileoverview Builds the Coaching and Research workspaces' sample data out
 * of real corpus cards, and loads or clears it.
 *
 * The sample goes into the same `localStorage` stores the workspace panels
 * already read, so each panel shows it exactly as it would show real work. It
 * is display-only: `debate-search-evidence`'s `sampleRecords.ts` remembers every
 * seeded id and keeps those records out of the account sync, seeding skips any
 * id the user already has, and clearing removes only what was seeded.
 *
 * Research gets evidence-library entries, the arguments they cover and the
 * squad contributions behind them. Coaching gets scouting records (opponent
 * teams and judges, with the profiles the panels list) and a sample round
 * flow built from the same cards, which `CoachHub` holds in memory only.
 *
 * @module lib/sample-data/workspace-sample-data
 */

import type { Box, Flow } from "@debate-ai/round/src/types/flow"
import {
  buildOpponentTeamProfile,
  type OpponentRoundRecord,
} from "@debate-ai/rankings-adapter/src/sync/opponent-team-profile"
import { clearSampleRecords, hasSampleRecords, seedSampleRecords } from "@debate-ai/research-evidence/src/account-sync/sampleRecords"
import { buildJudgeProfile, type JudgeRoundRecord } from "@debate-ai/speech-writer/src/judge/judge-profile"
import type { BuiltinJudgeParadigmId } from "@debate-ai/speech-writer/src/judge/judge-paradigms"
import type { SampleCard } from "./sample-cards"

/** A workspace that has a "Load sample data" button. */
export type SampleWorkspace = "coaching" | "research"

/** Every store a workspace's sample writes, with the field holding each record's id. */
export const SAMPLE_WORKSPACE_STORES: Record<SampleWorkspace, Readonly<Record<string, string>>> = {
  research: {
    evidenceLibraryEntries: "id",
    trackedArguments: "id",
    contributions: "id",
  },
  coaching: {
    opponentRoundRecords: "id",
    opponentTeamProfiles: "teamId",
    judgeRoundRecords: "id",
    judgeProfiles: "judgeId",
  },
}

/** Records to seed, by store key. */
export type SampleStoreRecords = Record<string, unknown[]>

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/** A stable 0..1 value per card, so the same cards always build the same sample. */
function unit(seed: number, salt: number): number {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

function eventLabel(event: string): string {
  const upper = event.toUpperCase()
  if (upper === "CX" || upper.includes("POLICY")) return "Policy"
  if (upper === "LD") return "Lincoln-Douglas"
  if (upper === "PF") return "Public Forum"
  return event
}

/**
 * The topic the sample is filed under: the season and event most of the cards
 * were cut for, e.g. "Policy 2025 topic".
 *
 * @param cards - The sample cards.
 * @returns The topic name.
 */
export function sampleTopic(cards: readonly SampleCard[]): string {
  const counts = new Map<string, number>()
  for (const card of cards) {
    const key = `${eventLabel(card.event)}${card.year ? ` ${card.year}` : ""} topic`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Sample topic"
}

function contributorOf(card: SampleCard, index: number): string {
  return card.school || `Squad member ${(index % 4) + 1}`
}

/**
 * Builds the Research workspace's sample.
 *
 * @param cards - The sample cards.
 * @param now - Epoch ms to date the sample from.
 * @returns Records for `evidenceLibraryEntries`, `trackedArguments` and `contributions`.
 */
export function buildResearchSampleData(cards: readonly SampleCard[], now: number): SampleStoreRecords {
  const topic = sampleTopic(cards)

  const evidenceLibraryEntries = cards.map((card, index) => ({
    id: `sample-card-${card.id}`,
    kind: "card",
    argBlock: card.argBlock,
    wordCount: card.wordCount,
    topic,
    caseArea: card.caseArea,
    tags: [card.side, card.caseArea, ...(card.school ? [card.school] : [])],
    text: card.text,
    cite: card.cite,
    createdAt: now - index * 3 * HOUR,
  }))

  const blocks = new Map<string, string>()
  for (const card of cards) if (!blocks.has(card.argBlock)) blocks.set(card.argBlock, card.caseArea)
  const trackedArguments = [...blocks.entries()].slice(0, 10).map(([argBlock, category], index) => ({
    id: `sample-arg-${index + 1}`,
    topic,
    argBlock,
    category,
  }))

  const contributions = cards.map((card, index) => ({
    id: `sample-contribution-${card.id}`,
    kind: "card",
    likes: Math.round(unit(card.id, 1) * 24),
    saves: Math.round(unit(card.id, 2) * 10),
    qualitySignals: [0.55 + unit(card.id, 3) * 0.45, card.cite ? 0.9 : 0.4],
    reviewerEndorsements: index % 3 === 0 ? [{ reviewerWeight: 0.8 }] : [],
    contributorId: contributorOf(card, index),
    submittedAt: now - index * 3 * HOUR,
    argBlock: card.argBlock,
    topic,
    caseArea: card.caseArea,
    tags: [card.side, card.caseArea],
    wordCount: card.wordCount,
  }))

  return { evidenceLibraryEntries, trackedArguments, contributions }
}

/** Tournaments the scouting sample's rounds are dated at. */
const SAMPLE_TOURNAMENTS = ["Greenhill", "Glenbrooks", "Harvard", "Berkeley", "Emory", "TOC Qualifier"]
const SAMPLE_PARADIGMS: BuiltinJudgeParadigmId[] = ["policymaker", "critic", "common-sense", "policymaker"]

function isoDay(epoch: number): string {
  return new Date(epoch).toISOString().slice(0, 10)
}

/**
 * Builds the Coaching workspace's scouting sample: a few opponent teams (the
 * schools the cards came from), the arguments they ran (the cards' case
 * areas and aff hats), a few judges, and the profiles both panels list.
 *
 * @param cards - The sample cards.
 * @param now - Epoch ms to date the sample from.
 * @returns Records for the opponent and judge stores.
 */
export function buildCoachingSampleData(cards: readonly SampleCard[], now: number): SampleStoreRecords {
  const teams = [...new Set(cards.map((card) => card.school).filter(Boolean))].slice(0, 4)
  if (teams.length === 0) teams.push("Opponent A", "Opponent B")
  const division = eventLabel(cards[0]?.event ?? "CX")

  const opponentRoundRecords: Array<OpponentRoundRecord & { id: string }> = []
  teams.forEach((teamId, teamIndex) => {
    const theirCards = cards.filter((card) => card.school === teamId)
    const pool = theirCards.length > 0 ? theirCards : cards
    for (let round = 0; round < 6; round++) {
      const card = pool[round % pool.length] as SampleCard
      const side = round % 2 === 0 ? "aff" : "neg"
      const affCard = pool.find((c) => c.side === "aff") ?? card
      opponentRoundRecords.push({
        id: `sample-opp-${teamIndex + 1}-${round + 1}`,
        teamId,
        tournamentName: SAMPLE_TOURNAMENTS[(teamIndex + round) % SAMPLE_TOURNAMENTS.length] as string,
        date: isoDay(now - (round * 9 + teamIndex) * DAY),
        division,
        side,
        won: unit(card.id + teamIndex, round) > 0.4,
        argumentTags: side === "aff" ? ["Aff", affCard.argBlock.split(" > ")[0] as string] : [card.caseArea],
        caseName: side === "aff" ? affCard.argBlock.split(" > ")[1] ?? affCard.tag.slice(0, 60) : undefined,
        opponentTeamId: teams[(teamIndex + round + 1) % teams.length],
      })
    }
  })
  const opponentTeamProfiles = teams.map((teamId) =>
    buildOpponentTeamProfile(teamId, opponentRoundRecords.filter((record) => record.teamId === teamId)),
  )

  const judges = ["Sample Judge A", "Sample Judge B", "Sample Judge C"]
  const judgeRoundRecords: Array<JudgeRoundRecord & { id: string }> = []
  judges.forEach((judgeId, judgeIndex) => {
    for (let round = 0; round < 6; round++) {
      const seed = (cards[(judgeIndex * 6 + round) % Math.max(cards.length, 1)]?.id ?? round) + judgeIndex
      const theory = unit(seed, 4) > 0.6
      judgeRoundRecords.push({
        id: `sample-judge-${judgeIndex + 1}-${round + 1}`,
        judgeId,
        tournamentName: SAMPLE_TOURNAMENTS[(judgeIndex + round) % SAMPLE_TOURNAMENTS.length] as string,
        date: isoDay(now - (round * 8 + judgeIndex) * DAY),
        division,
        winningSide: unit(seed, 5) > 0.45 + judgeIndex * 0.05 ? "aff" : "neg",
        affSpeakerPoints: Math.round((27.8 + unit(seed, 6) * 1.6) * 10) / 10,
        negSpeakerPoints: Math.round((27.8 + unit(seed, 7) * 1.6) * 10) / 10,
        paceWpm: Math.round(180 + judgeIndex * 70 + unit(seed, 8) * 40),
        theoryArgumentRaised: theory,
        theoryArgumentWon: theory && unit(seed, 9) > 0.5,
        paradigmId: SAMPLE_PARADIGMS[judgeIndex % SAMPLE_PARADIGMS.length],
      })
    }
  })
  const judgeProfiles = judges.map((judgeId) =>
    buildJudgeProfile(judgeId, judgeRoundRecords.filter((record) => record.judgeId === judgeId)),
  )

  return { opponentRoundRecords, opponentTeamProfiles, judgeRoundRecords, judgeProfiles }
}

/** Id of the in-memory sample round flow; negative so it can't collide with a real flow's `Date.now()` id. */
export const SAMPLE_FLOW_ID = -20_261_013

const POLICY_COLUMNS = ["1AC", "1NC", "2AC", "2NC", "1NR", "1AR", "2NR", "2AR"]

function box(content: string, level: number, index: number, children: Box[] = []): Box {
  return { content, children, index, level, focus: false }
}

function cardLine(card: SampleCard): string {
  return card.citeShort ? `${card.tag} — ${card.citeShort}` : card.tag
}

/**
 * Builds the sample round flow: each aff card is a 1AC argument, answered in
 * the 1NC by a neg card, extended in the 2AC by the next aff card, and so on.
 *
 * @param cards - The sample cards.
 * @returns The flow.
 */
export function buildSampleFlow(cards: readonly SampleCard[]): Flow {
  const aff = cards.filter((card) => card.side === "aff")
  const neg = cards.filter((card) => card.side === "neg")
  const rows = Math.min(4, Math.max(aff.length, 1))
  const children: Box[] = []
  for (let row = 0; row < rows; row++) {
    const one = aff[row] ?? cards[row]
    if (!one) break
    const answer = neg[row]
    const extension = aff[row + rows]
    const block = neg[row + rows]
    const chain = [answer && cardLine(answer), extension && cardLine(extension), block && cardLine(block)]
    let tail: Box[] = []
    for (let column = chain.length; column >= 1; column--) {
      const content = chain[column - 1]
      if (!content) {
        tail = []
        continue
      }
      tail = [box(content, column + 1, 0, tail)]
    }
    children.push(box(cardLine(one), 1, row, tail))
  }
  return {
    content: `Sample round — ${sampleTopic(cards)}`,
    level: 0,
    columns: POLICY_COLUMNS,
    invert: false,
    focus: false,
    index: 0,
    lastFocus: [],
    children,
    id: SAMPLE_FLOW_ID,
  }
}

/**
 * Seeds a workspace's sample into its stores.
 *
 * @param workspace - Which workspace.
 * @param cards - The sample cards.
 * @param now - Epoch ms to date the sample from.
 * @returns How many records were added.
 */
export function loadWorkspaceSampleData(workspace: SampleWorkspace, cards: readonly SampleCard[], now = Date.now()): number {
  const records = workspace === "research" ? buildResearchSampleData(cards, now) : buildCoachingSampleData(cards, now)
  const stores = SAMPLE_WORKSPACE_STORES[workspace]
  let added = 0
  for (const [storageKey, idField] of Object.entries(stores)) {
    added += seedSampleRecords(storageKey, idField, records[storageKey] ?? [])
  }
  if (workspace === "coaching" && typeof localStorage !== "undefined") {
    localStorage.setItem(SAMPLE_FLOW_KEY, JSON.stringify(buildSampleFlow(cards)))
  }
  return added
}

/**
 * localStorage key holding the sample round flow. Not a synced store: the
 * flow only ever enters the round workspace's in-memory store while the
 * Coaching workspace is open (see `CoachHub`).
 */
export const SAMPLE_FLOW_KEY = "sampleDataFlow"

/**
 * Reads the loaded sample round flow.
 *
 * @returns The flow, or `null` when no coaching sample is loaded.
 */
export function readSampleFlow(): Flow | null {
  if (typeof localStorage === "undefined") return null
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SAMPLE_FLOW_KEY) ?? "null")
    return parsed && typeof parsed === "object" && (parsed as Flow).id === SAMPLE_FLOW_ID ? (parsed as Flow) : null
  } catch {
    return null
  }
}

/**
 * Removes a workspace's sample from its stores.
 *
 * @param workspace - Which workspace.
 * @returns How many records were removed.
 */
export function clearWorkspaceSampleData(workspace: SampleWorkspace): number {
  const stores = SAMPLE_WORKSPACE_STORES[workspace]
  if (workspace === "coaching" && typeof localStorage !== "undefined") localStorage.removeItem(SAMPLE_FLOW_KEY)
  return clearSampleRecords(Object.keys(stores), stores)
}

/**
 * Whether a workspace's sample is loaded.
 *
 * @param workspace - Which workspace.
 * @returns True when any of its stores holds sample records.
 */
export function hasWorkspaceSampleData(workspace: SampleWorkspace): boolean {
  if (workspace === "coaching" && readSampleFlow()) return true
  return hasSampleRecords(Object.keys(SAMPLE_WORKSPACE_STORES[workspace]))
}
