/**
 * @fileoverview The newest Topic Starter outline files, mixed across debate
 * formats — what the homepage's "Latest outline files" marquee lists.
 *
 * Built from the names-only file index (`./file-index`), so picking them never
 * reads a file's content. Each file's topic is its effective topic code (its
 * own, else its nearest coded folder's, else the default — see
 * `./topic-scope`), and its link is the same `/<code>/<path>` address the
 * sidebar copies, built from the same path map over the whole library.
 *
 * "Across formats" is a round-robin: each format's files are taken newest
 * first, and the formats take turns in the order of their own newest file. A
 * format with one recent upload is not buried under fifty policy files, and a
 * format with nothing published simply doesn't appear.
 *
 * @module lib/topic-starters/latest-files
 */

import { buildPathMap } from "../reason-docs/doc-path"
import { topicDocsHref } from "../reason-docs/topic-doc-paths"
import { findTopicByCode, type TopicFormat } from "../reason-docs/topic-codes"
import type { TopicStarterIndexEntry } from "./file-index"
import { effectiveTopicCodes } from "./topic-scope"

/** One outline file as the homepage shows it. */
export interface LatestOutlineFile {
  id: number
  title: string
  /** The resolution's topic code, e.g. `vcx27`. */
  topicCode: string
  format: TopicFormat
  /** Short format chip: "Policy", "NDT", "LD", "PF", "BQ". */
  formatLabel: string
  /** The resolution's short name, when the code is a known topic. */
  topicName: string | null
  /** `/<code>/<path>`. */
  href: string
  /** ISO time the file last changed. */
  updatedAt: string | null
  author: string | null
  quoteCount: number | null
  pageCount: number | null
}

/** Chip text per format — short enough for a 170px tile. */
export const OUTLINE_FORMAT_LABELS: Record<TopicFormat, string> = {
  vcx: "Policy",
  ndt: "NDT",
  ld: "LD",
  pf: "PF",
  bq: "BQ",
}

/** The format a topic code names, from its prefix. */
export function topicFormatOf(code: string): TopicFormat {
  if (code.startsWith("ndt")) return "ndt"
  if (code.startsWith("ld")) return "ld"
  if (code.startsWith("pf")) return "pf"
  if (code.startsWith("bq")) return "bq"
  return "vcx"
}

function timeOf(entry: TopicStarterIndexEntry): number {
  const ms = entry.updatedAt ? Date.parse(entry.updatedAt) : Number.NaN
  return Number.isNaN(ms) ? 0 : ms
}

/**
 * The `limit` newest files in `items`, interleaved across formats.
 *
 * @param items - The file index's rows (folders included — they give files
 *   their topic and path).
 * @param limit - How many files to return.
 */
export function latestOutlineFiles(items: readonly TopicStarterIndexEntry[], limit = 12): LatestOutlineFile[] {
  if (limit <= 0) return []
  const codes = effectiveTopicCodes(items)
  const paths = buildPathMap(items)

  const files = items.filter((item) => !item.isFolder).sort((a, b) => timeOf(b) - timeOf(a) || b.id - a.id)

  // Newest first within each format; a Map keeps the formats in the order
  // their newest file was seen, which is the order they take turns in.
  const byFormat = new Map<TopicFormat, TopicStarterIndexEntry[]>()
  for (const file of files) {
    const format = topicFormatOf(codes.get(file.id) ?? "")
    const list = byFormat.get(format)
    if (list) list.push(file)
    else byFormat.set(format, [file])
  }

  const picked: TopicStarterIndexEntry[] = []
  const queues = [...byFormat.values()]
  for (let round = 0; picked.length < limit && queues.some((queue) => queue.length > round); round++) {
    for (const queue of queues) {
      const file = queue[round]
      if (file) picked.push(file)
      if (picked.length >= limit) break
    }
  }

  return picked.map((file) => {
    const topicCode = codes.get(file.id) ?? ""
    const format = topicFormatOf(topicCode)
    return {
      id: file.id,
      title: file.title.replace(/\.(docx?|cmir|html?)$/i, ""),
      topicCode,
      format,
      formatLabel: OUTLINE_FORMAT_LABELS[format],
      topicName: findTopicByCode(topicCode)?.name ?? null,
      href: topicDocsHref(topicCode, paths.get(file.id) || String(file.id)),
      updatedAt: file.updatedAt ?? null,
      author: file.author ?? null,
      quoteCount: file.quoteCount ?? null,
      pageCount: file.pageCount ?? null,
    }
  })
}
