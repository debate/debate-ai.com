/**
 * Which resolution a Topic Starter belongs to, so each format / year / topic
 * has its own file tree.
 *
 * Every row may carry a `topicCode` (`vcx27`, `lda27`; the scheme is in
 * `../reason-docs/topic-doc-paths`). The importer stamps the code the admin
 * picked on every folder and file it creates, and a folder made from the
 * sidebar takes the code of the tree it was made in. A row without a code of
 * its own belongs to its nearest ancestor's topic, and a row with no coded
 * ancestor at all — everything imported before topics existed — belongs to
 * {@link DEFAULT_TOPIC_CODE}, the library those rows were made for.
 *
 * Both the server (importer, AI organize) and the client (sidebar tree, admin
 * library tree) filter with {@link filterItemsByTopic}, so they agree on what
 * one topic's tree holds.
 *
 * @module lib/topic-starters/topic-scope
 */

import { DEFAULT_TOPIC_CODE, isTopicCode, normalizeTopicCode } from "../reason-docs/topic-doc-paths"

/** The fields topic scoping reads off a row. */
export interface TopicScopedRow {
  id: number
  parentId: number | null
  topicCode?: string | null
}

/** A topic code read from an untrusted value (a form field, a JSON body, a
 *  stored row), in the current shape (old `lda27` reads as `lda27`), or
 *  `null` when it is not shaped like one. */
export function parseTopicStarterTopicCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const code = raw.trim().toLowerCase()
  return isTopicCode(code) ? normalizeTopicCode(code) : null
}

/**
 * The topic each row belongs to, by id: its own code, else its nearest coded
 * ancestor's, else {@link DEFAULT_TOPIC_CODE}. A parent cycle (bad data)
 * stops the walk rather than looping.
 */
export function effectiveTopicCodes(rows: readonly TopicScopedRow[], fallback: string = DEFAULT_TOPIC_CODE): Map<number, string> {
  const byId = new Map(rows.map((row) => [row.id, row]))
  const resolved = new Map<number, string>()
  for (const row of rows) {
    if (resolved.has(row.id)) continue
    const chain: number[] = []
    const seen = new Set<number>()
    let current: TopicScopedRow | undefined = row
    let code: string | null = null
    while (current && !seen.has(current.id)) {
      const known = resolved.get(current.id)
      if (known) {
        code = known
        break
      }
      seen.add(current.id)
      chain.push(current.id)
      const own = parseTopicStarterTopicCode(current.topicCode)
      if (own) {
        code = own
        break
      }
      current = current.parentId == null ? undefined : byId.get(current.parentId)
    }
    for (const id of chain) resolved.set(id, code ?? fallback)
  }
  return resolved
}

/** The rows that make up one topic's tree. `code` null or unknown means the
 *  default topic. */
export function filterItemsByTopic<T extends TopicScopedRow>(rows: readonly T[], code: string | null | undefined): T[] {
  const wanted = parseTopicStarterTopicCode(code) ?? DEFAULT_TOPIC_CODE
  const codes = effectiveTopicCodes(rows)
  return rows.filter((row) => codes.get(row.id) === wanted)
}
