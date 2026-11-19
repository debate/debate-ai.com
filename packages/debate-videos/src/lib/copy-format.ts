/**
 * @fileoverview What the watch page's copy button puts on the clipboard.
 *
 * The viewer picks one of three formats from the menu beside the button, and
 * the choice is remembered in this browser so the next copy uses it too:
 *
 * - `url` — the page's address alone.
 * - `url-title` — the round's title on one line, the address on the next.
 * - `citation` — a Chicago-style (notes-bibliography) entry for the video,
 *   credited to the Debate AI Institute:
 *   `Debate AI Institute. "Title." Debate video, 2025. https://…`
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
  /** When the video was published; anything `Date` can parse. */
  publishedAt?: string | number | Date | null
}

/** The publication year, or `null` when the date is missing or unreadable. */
function publicationYear(publishedAt: CopyableVideo["publishedAt"]): number | null {
  if (publishedAt == null || publishedAt === "") return null
  const year = new Date(publishedAt).getFullYear()
  return Number.isFinite(year) ? year : null
}

/**
 * The Chicago-style citation of a debate video.
 *
 * Follows the bibliography form for an online video — author, title in
 * quotation marks, medium and date, then the URL — with "n.d." when the
 * publication date is unknown. A title's own closing punctuation is kept
 * inside the quotation marks instead of doubling it with a period.
 */
export function chicagoVideoCitation({ url, title, publishedAt }: CopyableVideo): string {
  const cleanTitle = title.trim().replace(/\s+/g, " ")
  const quoted = /[.?!]$/.test(cleanTitle) ? `“${cleanTitle}”` : `“${cleanTitle}.”`
  const year = publicationYear(publishedAt)
  return `${CITATION_AUTHOR}. ${quoted} Debate video, ${year ?? "n.d."}. ${url}.`
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
