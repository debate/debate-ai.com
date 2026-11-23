/**
 * @fileoverview The "who debated whom" network behind the rankings page's
 * head-to-head graph: the season's top-ranked entries as nodes, every round
 * two of them debated each other as a link, and a deterministic
 * force-directed layout so the picture is the same on every load.
 *
 * Rounds come from the tournament CSVs in the `debate-rankings-sync-data`
 * submodule (`tournaments/<format>/<slug>/*.csv` plus each folder's
 * `entries.csv`), the same ballots the Bradley-Terry ratings are fitted to.
 * Entries are matched to ranking rows by institution and sorted names, the
 * way upstream's `player_utils.py` builds its ids.
 * @module @debate-ai/rankings/leaderboard/network/headToHeadNetwork
 */

import { parseCsv } from "../../parse"
import type { RankingEntry } from "../../types"

/** One decided round between two entries, keyed by {@link entryKey}. */
export interface HeadToHeadRound {
  aff: string
  neg: string
  /** Key of the entry that won the round. */
  winner: string
  /** Tournament folder slug the round came from. */
  tournament: string
  /** Whether the round was an elimination round. */
  elim: boolean
}

/** One tournament's raw CSV text. */
export interface TournamentCsvs {
  /** Folder slug, e.g. `"greenhill"`. */
  slug: string
  /** `entries.csv` text. */
  entries: string
  /** Every round file's text, with its file name (used to spot elims). */
  rounds: { file: string; text: string }[]
}

/** Upstream's `normalize_name`: capitalize each word that starts lowercase. */
function normalizeName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => (part[0] === part[0].toLowerCase() ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ")
}

/**
 * Upstream's display form of an entry: LD names as-is (normalized), team
 * names split on `&`, normalized and sorted.
 */
export function sortedEntryName(entry: string, singles: boolean): string {
  if (singles) return normalizeName(entry)
  return entry
    .split("&")
    .map((name) => normalizeName(name.trim()))
    .sort()
    .join(" & ")
}

/** The id a round's entry and a ranking row share: institution plus sorted names. */
export function entryKey(school: string, name: string, singles = false): string {
  return `${school.trim().toLowerCase()}|${sortedEntryName(name, singles).toLowerCase()}`
}

/** Upstream's `_is_elimination_round` terms (plus "octa", for files named `octas`): a round file named with one is an elim. */
const ELIM_FILE = /(runoff|double|triple|quad|octo|octa|quarter|semi|final)/i

/**
 * Reads one tournament folder into decided rounds. Byes, unknown codes and
 * rounds without a decision are skipped, as upstream's `run_round` does.
 *
 * @param singles - LD: entries are single debaters.
 */
export function parseTournamentRounds(tournament: TournamentCsvs, singles: boolean): HeadToHeadRound[] {
  const [header, ...rows] = parseCsv(tournament.entries)
  if (!header) return []
  const col = (name: string) => header.findIndex((cell) => cell.trim() === name)
  const inst = col("Institution")
  const entry = col("Entry")
  const code = col("Code")
  if (inst < 0 || entry < 0 || code < 0) return []
  const codes = new Map<string, string>()
  for (const row of rows) {
    const c = row[code]?.trim()
    if (c && row[inst] && row[entry]) codes.set(c, entryKey(row[inst], row[entry], singles))
  }

  const rounds: HeadToHeadRound[] = []
  for (const file of tournament.rounds) {
    const [cols, ...body] = parseCsv(file.text)
    if (!cols) continue
    const names = cols.map((c) => c.trim())
    const affCol = names.findIndex((c) => c === "Aff" || c === "Pro")
    const negCol = names.findIndex((c) => c === "Neg" || c === "Con")
    const winCol = names.indexOf("Win")
    if (affCol < 0 || negCol < 0 || winCol < 0) continue
    const elim = ELIM_FILE.test(file.file) || (names.includes("Judges") && names.includes("Votes"))
    for (const row of body) {
      const aff = codes.get(row[affCol]?.trim() ?? "")
      const neg = codes.get(row[negCol]?.trim() ?? "")
      if (!aff || !neg || aff === neg) continue
      const win = (row[winCol] ?? "").toLowerCase()
      const affWon = win.includes("aff") || win.includes("pro")
      const negWon = win.includes("neg") || win.includes("con")
      if (affWon === negWon) continue
      rounds.push({ aff, neg, winner: affWon ? aff : neg, tournament: tournament.slug, elim })
    }
  }
  return rounds
}

/** A rank band, drawn as one color and one legend entry. */
export interface NetworkCategory {
  name: string
  /** Last rank (inclusive) in the band. */
  maxRank: number
}

/** Rank bands of the default graph. */
export const NETWORK_CATEGORIES: readonly NetworkCategory[] = [
  { name: "Top 10", maxRank: 10 },
  { name: "11–25", maxRank: 25 },
  { name: "26–50", maxRank: 50 },
  { name: "51–75", maxRank: 75 },
]

/** Entries drawn by default: the top 75. */
export const NETWORK_NODE_LIMIT = 75

/** One entry in the graph. */
export interface NetworkNode {
  /** {@link entryKey} of the entry. */
  id: string
  entry: RankingEntry
  /** Index into the categories. */
  category: number
  /** Opponents in the graph, as indexes into `nodes`. */
  neighbors: number[]
  /** Rounds against other graph nodes. */
  rounds: number
  x: number
  y: number
}

/** Every round two graph nodes debated each other, summed. */
export interface NetworkLink {
  /** Index of the better-ranked entry. */
  source: number
  target: number
  /** Rounds between them. */
  rounds: number
  /** Rounds the source won. */
  sourceWins: number
  /** Rounds the target won. */
  targetWins: number
  /** Elimination rounds between them. */
  elims: number
}

export interface HeadToHeadNetwork {
  nodes: NetworkNode[]
  links: NetworkLink[]
  categories: readonly NetworkCategory[]
  /** Layout box the node positions sit in. */
  width: number
  height: number
}

export interface BuildNetworkOptions {
  /** Most entries to draw. */
  limit?: number
  categories?: readonly NetworkCategory[]
  /** LD: entries are single debaters. */
  singles?: boolean
  width?: number
  height?: number
  /** Force-layout steps. */
  iterations?: number
}

/**
 * Builds the graph: the best-ranked `limit` entries that debated at least one
 * other of them, linked by their rounds, laid out by {@link layoutNetwork}.
 */
export function buildHeadToHeadNetwork(
  entries: readonly RankingEntry[],
  rounds: readonly HeadToHeadRound[],
  options: BuildNetworkOptions = {},
): HeadToHeadNetwork {
  const {
    limit = NETWORK_NODE_LIMIT,
    categories = NETWORK_CATEGORIES,
    singles = false,
    width = 800,
    height = 560,
    iterations = 300,
  } = options
  const top = [...entries].sort((a, b) => a.rank - b.rank).slice(0, limit)
  const index = new Map<string, number>()
  top.forEach((entry, i) => index.set(entryKey(entry.school, entry.name, singles), i))

  const pairs = new Map<string, NetworkLink>()
  for (const round of rounds) {
    const a = index.get(round.aff)
    const b = index.get(round.neg)
    if (a === undefined || b === undefined || a === b) continue
    const [source, target] = a < b ? [a, b] : [b, a]
    const key = `${source}:${target}`
    let link = pairs.get(key)
    if (!link) {
      link = { source, target, rounds: 0, sourceWins: 0, targetWins: 0, elims: 0 }
      pairs.set(key, link)
    }
    link.rounds++
    if (round.elim) link.elims++
    if (index.get(round.winner) === source) link.sourceWins++
    else link.targetWins++
  }

  // Keep only entries with at least one link, re-indexed in rank order.
  const linked = new Set<number>()
  for (const link of pairs.values()) linked.add(link.source).add(link.target)
  const kept = top.map((_, i) => i).filter((i) => linked.has(i))
  const remap = new Map(kept.map((old, i) => [old, i]))

  const nodes: NetworkNode[] = kept.map((old) => {
    const entry = top[old]
    const category = categories.findIndex((c) => entry.rank <= c.maxRank)
    return {
      id: entryKey(entry.school, entry.name, singles),
      entry,
      category: category === -1 ? categories.length - 1 : category,
      neighbors: [],
      rounds: 0,
      x: 0,
      y: 0,
    }
  })
  const links = [...pairs.values()]
    .map((link) => ({ ...link, source: remap.get(link.source)!, target: remap.get(link.target)! }))
    .sort((a, b) => a.source - b.source || a.target - b.target)
  for (const link of links) {
    nodes[link.source].neighbors.push(link.target)
    nodes[link.target].neighbors.push(link.source)
    nodes[link.source].rounds += link.rounds
    nodes[link.target].rounds += link.rounds
  }
  for (const node of nodes) node.neighbors.sort((a, b) => a - b)

  layoutNetwork(nodes, links, width, height, iterations)
  return { nodes, links, categories, width, height }
}

/**
 * Fruchterman-Reingold layout, in place. Starts from a spiral in rank order
 * (no randomness), so the same data always draws the same picture; links
 * pull by the rounds between the pair, and a weak pull to the center keeps
 * small components from drifting off.
 */
export function layoutNetwork(
  nodes: NetworkNode[],
  links: readonly NetworkLink[],
  width: number,
  height: number,
  iterations: number,
): void {
  const n = nodes.length
  if (!n) return
  const cx = width / 2
  const cy = height / 2
  const golden = Math.PI * (3 - Math.sqrt(5))
  const spread = Math.min(width, height) * 0.45
  nodes.forEach((node, i) => {
    const r = spread * Math.sqrt((i + 0.5) / n)
    node.x = cx + r * Math.cos(i * golden)
    node.y = cy + r * Math.sin(i * golden)
  })
  if (n === 1) return

  const k = Math.sqrt((width * height) / n) * 0.9
  const dx = new Float64Array(n)
  const dy = new Float64Array(n)
  let temperature = width / 8
  const cooling = temperature / (iterations + 1)

  for (let step = 0; step < iterations; step++) {
    dx.fill(0)
    dy.fill(0)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let ddx = nodes[i].x - nodes[j].x
        let ddy = nodes[i].y - nodes[j].y
        let dist = Math.hypot(ddx, ddy)
        if (dist < 0.01) {
          // Coincident points: nudge apart along a fixed direction.
          ddx = 0.01 * ((i % 3) - 1 || 1)
          ddy = 0.01
          dist = Math.hypot(ddx, ddy)
        }
        const force = (k * k) / dist
        dx[i] += (ddx / dist) * force
        dy[i] += (ddy / dist) * force
        dx[j] -= (ddx / dist) * force
        dy[j] -= (ddy / dist) * force
      }
    }
    for (const link of links) {
      const a = nodes[link.source]
      const b = nodes[link.target]
      const ddx = a.x - b.x
      const ddy = a.y - b.y
      const dist = Math.max(Math.hypot(ddx, ddy), 0.01)
      const force = ((dist * dist) / k) * Math.min(1 + Math.log(link.rounds), 3)
      dx[link.source] -= (ddx / dist) * force
      dy[link.source] -= (ddy / dist) * force
      dx[link.target] += (ddx / dist) * force
      dy[link.target] += (ddy / dist) * force
    }
    for (let i = 0; i < n; i++) {
      const node = nodes[i]
      dx[i] += (cx - node.x) * 0.05 * (k / 10)
      dy[i] += (cy - node.y) * 0.05 * (k / 10)
      const len = Math.hypot(dx[i], dy[i])
      if (len > 0) {
        const move = Math.min(len, temperature)
        node.x += (dx[i] / len) * move
        node.y += (dy[i] / len) * move
      }
    }
    temperature -= cooling
  }

  // Fit the result to the box with a margin.
  const margin = 24
  const xs = nodes.map((node) => node.x)
  const ys = nodes.map((node) => node.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const spanX = Math.max(...xs) - minX || 1
  const spanY = Math.max(...ys) - minY || 1
  // Stretch to fill a box whose shape differs from the cloud's (a portrait
  // phone box), but by no more than 1.6x on one axis.
  const fitX = (width - 2 * margin) / spanX
  const fitY = (height - 2 * margin) / spanY
  const scaleX = Math.min(fitX, fitY * 1.6)
  const scaleY = Math.min(fitY, fitX * 1.6)
  const offX = (width - spanX * scaleX) / 2
  const offY = (height - spanY * scaleY) / 2
  for (const node of nodes) {
    node.x = Math.round((offX + (node.x - minX) * scaleX) * 10) / 10
    node.y = Math.round((offY + (node.y - minY) * scaleY) * 10) / 10
  }
}

/** One opponent of a node, for its tooltip. */
export interface NetworkOpponent {
  node: NetworkNode
  wins: number
  losses: number
  rounds: number
}

/** A node's opponents in the graph with its record against each, best-ranked first. */
export function nodeOpponents(network: HeadToHeadNetwork, index: number): NetworkOpponent[] {
  const out: NetworkOpponent[] = []
  for (const link of network.links) {
    if (link.source === index) {
      out.push({ node: network.nodes[link.target], wins: link.sourceWins, losses: link.targetWins, rounds: link.rounds })
    } else if (link.target === index) {
      out.push({ node: network.nodes[link.source], wins: link.targetWins, losses: link.sourceWins, rounds: link.rounds })
    }
  }
  return out.sort((a, b) => a.node.entry.rank - b.node.entry.rank)
}
