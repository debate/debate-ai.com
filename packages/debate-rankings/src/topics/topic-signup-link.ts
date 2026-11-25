/**
 * @fileoverview The link from any listed resolution to its sign-up page in
 * Practice Debates (`/practice/debates?section=topics`), and the parse of that
 * link on the other side.
 *
 * Every resolution list on the site (the 100 years of topics, the topic-area
 * explorer, the 700 philosophical resolutions) links here, and the Topic
 * Sign-ups tab reads it back. The two ends live in different packages
 * (`debate-videos` lists, `debate-practice-rounds` signs up), so the URL shape
 * is owned once, here in the topics domain both already depend on.
 *
 * A topic is identified by its text. {@link topicKey} turns that text into a
 * stable key, so two lists that print the same resolution with different
 * spacing, case or a trailing full stop share one sign-up board.
 *
 * @module topics/topic-signup-link
 */

/** The Practice Debates page that holds the sign-up tab. */
export const TOPIC_SIGNUP_PATH = "/practice/debates"

/** Longest resolution text carried in a link or stored on a board. */
export const MAX_TOPIC_TEXT = 600

/** The topic a sign-up link opens. */
export interface TopicSignupTarget {
  /** The resolution, exactly as it should be shown. */
  text: string
  /** Format label, e.g. "PF", "LD", "Policy", "College" or "Value". */
  format?: string
  /** Where the topic came from, e.g. "2024-25 LD" or "Value resolution Nuke.1". */
  source?: string
}

/** Collapses whitespace and trims, capped at {@link MAX_TOPIC_TEXT}. */
export function cleanTopicText(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_TOPIC_TEXT)
}

/**
 * The board key for a resolution: lower-cased, "Resolved:" prefix, punctuation
 * and surrounding space dropped. Pure and deterministic, so the client and the
 * API agree on it without a round trip.
 */
export function topicKey(text: string): string {
  return cleanTopicText(text)
    .toLowerCase()
    .replace(/^resolved\s*[:,]?\s*/, "")
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300)
}

/** The sign-up URL for one resolution. */
export function topicSignupHref(target: TopicSignupTarget): string {
  const params = new URLSearchParams({ section: "topics", topic: cleanTopicText(target.text) })
  if (target.format) params.set("format", target.format.slice(0, 40))
  if (target.source) params.set("source", target.source.slice(0, 120))
  return `${TOPIC_SIGNUP_PATH}?${params.toString()}`
}

/** Reads a sign-up link's topic back, or `null` when it names none. */
export function parseTopicSignupParams(params: { get(name: string): string | null }): TopicSignupTarget | null {
  const text = cleanTopicText(params.get("topic") ?? "")
  if (!text || !topicKey(text)) return null
  const format = params.get("format")?.trim().slice(0, 40) || undefined
  const source = params.get("source")?.trim().slice(0, 120) || undefined
  return { text, format, source }
}
