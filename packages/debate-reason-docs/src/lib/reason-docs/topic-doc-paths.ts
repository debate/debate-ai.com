/**
 * @fileoverview The `/docs/<topic code>/<file path>` address of a public Topic
 * Starter, e.g. `/docs/vcx27/neg/cp/aca-expansion-cp-cndi-2026`.
 *
 * A topic code names one resolution: its format, the last two digits of the
 * competition year in `debate-topics.json`, and for the formats that change
 * topic during the season, a letter for which topic of that year it is.
 *
 * | Format | Code | Example |
 * | --- | --- | --- |
 * | High-school policy | `vcx<yy>` | `vcx27` |
 * | High-school policy before 2000 | `vcx19<yy>` | `vcx1928` (1927-28) |
 * | College policy (NDT/CEDA) | `ndt<yy>` | `ndt27` |
 * | Lincoln-Douglas | `ld<a-f><yy>` | `lda27` (first LD topic of 2027) |
 * | Lincoln-Douglas before 2000 | `ld<a-f>19<yy>` | `lda1999` (1998-99) |
 * | Public Forum | `pf<a-j><yy>` | `pfb27` |
 * | Big Questions | `bq<yy>` | `bq27` |
 *
 * LD and PF codes used to put the letter last (`ld27a`, `pf24b`). Those
 * addresses and stored rows still work: {@link normalizeTopicCode} turns the
 * old shape into the new one wherever a code is read.
 *
 * These addresses share `/docs` with the Fumadocs help site, so only a first
 * segment shaped like a topic code is the editor's: no help page is named like
 * `vcx27` or `lda27`, and everything else under `/docs` stays the help docs.
 * `next.config.mjs` rewrites exactly the same shape onto `/reason-editor`
 * (see {@link TOPIC_CODE_SOURCE}), and `isDocsPath` leaves it out so the app
 * shell, not `DocsAppChrome`, renders it.
 *
 * Kept free of the topics data on purpose: the shell checks these paths on
 * every navigation, and the 80 kB resolution list is only needed by the
 * picker (`./topic-codes`).
 *
 * @module lib/reason-docs/topic-doc-paths
 */

/** The prefix topic-starter addresses live under. */
export const TOPIC_DOCS_ROUTE = "/docs"

/** A topic code's shape as a regex source, unanchored. `next.config.mjs`
 *  carries the same pattern in its rewrite. */
export const TOPIC_CODE_SOURCE = "vcx19\\d{2}|ld[a-z]19\\d{2}|(?:vcx|ndt|bq)\\d{2}|(?:ld|pf)[a-z]\\d{2}|(?:ld|pf)\\d{2}[a-z]"

const TOPIC_CODE_RE = new RegExp(`^(?:${TOPIC_CODE_SOURCE})$`)

/** The old LD / PF shape, letter last (`ld27a`). */
const LEGACY_SEASONAL_CODE_RE = /^(ld|pf)(\d{2})([a-z])$/

/**
 * The code a topic-starter link gets when nothing names one — the `?topic=`
 * links written before topic codes, and a starter opened from the sidebar on
 * `/reason-editor`. The library is the current high-school policy topic's;
 * `test/lib/reason-docs/topic-codes.test.ts` fails when `debate-topics.json`
 * gains a newer policy year, as the reminder to move this along.
 */
export const DEFAULT_TOPIC_CODE = "vcx27"

/** Whether `segment` is shaped like a topic code, in the current or the old
 *  letter-last LD / PF shape. Case-sensitive: codes are always written
 *  lower-case. */
export function isTopicCode(segment: string | null | undefined): segment is string {
  return !!segment && TOPIC_CODE_RE.test(segment)
}

/** A topic code in the current shape: the old letter-last LD / PF codes
 *  (`ld21b`, `pf24a`) become `ldb21` / `pfa24`; anything else comes back
 *  unchanged. */
export function normalizeTopicCode(code: string): string {
  const legacy = LEGACY_SEASONAL_CODE_RE.exec(code)
  return legacy ? `${legacy[1]}${legacy[3]}${legacy[2]}` : code
}

/** A topic-starter address read back: the topic code, and the file path
 *  after it (`null` on the bare `/docs/<code>`). */
export interface TopicDocsPath {
  code: string
  ref: string | null
}

/** Reads `/docs/<code>/<path>` off a pathname, or `null` for any other path —
 *  the help docs included. */
export function parseTopicDocsPath(pathname: string | null | undefined): TopicDocsPath | null {
  if (!pathname) return null
  const path = (pathname.split("?")[0]?.split("#")[0] ?? "").replace(/\/+$/, "")
  if (!path.startsWith(`${TOPIC_DOCS_ROUTE}/`)) return null
  const [code, ...rest] = path.slice(TOPIC_DOCS_ROUTE.length + 1).split("/")
  if (!isTopicCode(code)) return null
  const ref = rest
    .map((segment) => {
      try {
        return decodeURIComponent(segment)
      } catch {
        return segment
      }
    })
    .join("/")
  return { code: normalizeTopicCode(code), ref: ref || null }
}

/** True on a topic-starter address (`/docs/vcx27`, `/docs/lda27/aff/case`). */
export function isTopicDocsPath(pathname: string | null | undefined): boolean {
  return parseTopicDocsPath(pathname) != null
}

/** `/docs/<code>/<ref>`, the ref encoded segment-wise so its slashes stay
 *  path structure; `/docs/<code>` without one. */
export function topicDocsHref(code: string, ref?: string | null): string {
  const base = `${TOPIC_DOCS_ROUTE}/${code}`
  if (!ref) return base
  return `${base}/${ref.split("/").map(encodeURIComponent).join("/")}`
}
