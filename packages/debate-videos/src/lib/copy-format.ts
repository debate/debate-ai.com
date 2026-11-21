/**
 * @fileoverview What the watch page's copy button puts on the clipboard.
 *
 * The viewer picks one of three formats from the menu beside the button, and
 * the choice is remembered in this browser so the next copy uses it too:
 *
 * - `url` — the page's address alone.
 * - `url-title` — the round's title on one line, the address on the next.
 * - `citation` — a Chicago notes-and-bibliography entry for the video,
 *   credited to the Debate AI Institute:
 *   `Debate AI Institute. "Title." February 15, 2026. Video, 1:42:07. https://….`
 * @module lib/copy-format
 */

/** The formats the copy button can produce. */
export type CopyFormat = "url" | "url-title" | "citation"

/** The formats in menu order, with the label each shows. */
export const COPY_FORMATS: ReadonlyArray<{ value: CopyFormat; label: string }> = [
  { value: "url", label: "URL only" },
  { value: "url-title", label: "URL + title" },
  { value: "citation", label: "Citation (Chicago)" },
]

/** The format a viewer who never chose one gets. */
export const DEFAULT_COPY_FORMAT: CopyFormat = "url"

/** Where the chosen format is kept in `localStorage`. */
export const COPY_FORMAT_STORAGE_KEY = "debate-videos:copy-format"

/** The author every citation credits. */
export const CITATION_AUTHOR = "Debate AI Institute"

/** Whether a stored string is one of the {@link CopyFormat}s. */
export function isCopyFormat(value: unknown): value is CopyFormat {
  return COPY_FORMATS.some((format) => format.value === value)
}

/** The saved format, or the default when none was saved or storage is blocked. */
export function readCopyFormat(): CopyFormat {
  try {
    const stored = window.localStorage.getItem(COPY_FORMAT_STORAGE_KEY)
    return isCopyFormat(stored) ? stored : DEFAULT_COPY_FORMAT
  } catch {
    return DEFAULT_COPY_FORMAT
  }
}

/** Remembers the format; a blocked storage just means it is not remembered. */
export function writeCopyFormat(format: CopyFormat): void {
  try {
    window.localStorage.setItem(COPY_FORMAT_STORAGE_KEY, format)
  } catch {
    // Private windows and blocked site data: the choice lasts for this page only.
  }
}

/** What the copy needs to know about the video. */
export interface CopyableVideo {
  /** The page's address. */
  url: string
  /** The round's title as the page heading shows it. */
  title: string
  /** When the video was posted; anything `Date` can parse. */
  publishedAt?: string | number | Date | null
  /** The video's running time in seconds, when known. */
  durationSeconds?: number | null
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

/**
 * The posting date as Chicago writes it ("February 15, 2026"), the year
 * alone when only a bare year was given, or `null` when the date is missing
 * or unreadable. Read in UTC so a date-only value ("2026-02-15") is not
 * shifted a day back in timezones west of Greenwich.
 */
export function citationDate(publishedAt: CopyableVideo["publishedAt"]): string | null {
  if (publishedAt == null || publishedAt === "") return null
  if (typeof publishedAt === "string" && /^\s*\d{4}\s*$/.test(publishedAt)) return publishedAt.trim()
  const parsed = new Date(publishedAt)
  if (Number.isNaN(parsed.getTime())) return null
  return `${MONTHS[parsed.getUTCMonth()]} ${parsed.getUTCDate()}, ${parsed.getUTCFullYear()}`
}

/**
 * A running time as Chicago writes it: `h:mm:ss`, or `m:ss` under an hour
 * (`1:42:07`, `58:03`). `null` when the length is unknown or not positive.
 */
export function citationRunningTime(seconds: CopyableVideo["durationSeconds"]): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null
  const total = Math.round(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = String(total % 60).padStart(2, "0")
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${secs}` : `${minutes}:${secs}`
}

/**
 * The Chicago notes-and-bibliography entry for a debate video:
 *
 * `Author. "Title." Posting date. Video, running time. URL.`
 *
 * The full posting date is used when known ("n.d." when not), and the
 * running time follows "Video," only when the length is known. A title's own
 * closing punctuation is kept inside the quotation marks instead of doubling
 * it with a period.
 */
export function chicagoVideoCitation({ url, title, publishedAt, durationSeconds }: CopyableVideo): string {
  const cleanTitle = title.trim().replace(/\s+/g, " ")
  const quoted = /[.?!]$/.test(cleanTitle) ? `“${cleanTitle}”` : `“${cleanTitle}.”`
  const date = citationDate(publishedAt) ?? "n.d" // the period below closes "n.d."
  const runningTime = citationRunningTime(durationSeconds)
  const medium = runningTime ? `Video, ${runningTime}.` : "Video."
  return `${CITATION_AUTHOR}. ${quoted} ${date}. ${medium} ${url}.`
}

/** The clipboard text for a video in the chosen format. */
export function formatVideoCopy(format: CopyFormat, video: CopyableVideo): string {
  switch (format) {
    case "url-title":
      return `${video.title.trim()}\n${video.url}`
    case "citation":
      return chicagoVideoCitation(video)
    default:
      return video.url
  }
}
