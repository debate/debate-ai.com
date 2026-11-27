/**
 * @file references.ts
 * @description Finding the article behind a bibliography entry, for the docs'
 * References panel "Reading mode" button. Pure string work, no DOM, so the
 * panel (to describe an entry and build manual-search links), the server
 * route (to search for it and check what it found) and the tests all use it.
 *
 * - {@link describeReferenceCitation} turns an entry's bibliography line
 *   (HTML, as the panel holds it) into the fields a search needs: title,
 *   authors, year, publication and the entry's own link, if it has one.
 * - {@link isSafeArticleUrl} is the SSRF gate every URL passes before it is
 *   handed to a server-side extractor: public http(s) pages only.
 * - {@link referenceSearchQueries}, {@link rankSearchResults} and
 *   {@link verifyArticle} pick the right page from search results and refuse
 *   to call a page the article unless its title and author agree with the
 *   entry, so a wrong article is never shown quietly.
 */

/** What is known about one bibliography entry. */
export interface ReferenceDescription {
  /** The article, chapter or book title; empty when the entry has none. */
  title: string
  /** Surnames, `Galloway` or `Hansson & Reijven`, or the byline as written. */
  authors: string
  /** The publication year as cited. */
  year: string
  /** The journal, magazine or site the title appeared in. */
  publication: string
  /** The entry as plain text, without its link. */
  citation: string
  /** The entry's own link, or empty when it has none. */
  url: string
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, name: string) => {
    if (name[0] === "#") {
      const code = name[1]?.toLowerCase() === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1))
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : match
    }
    return ENTITIES[name.toLowerCase()] ?? match
  })
}

/** Visible text of an HTML fragment, spaces collapsed. */
export function htmlText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim()
}

const BARE_URL = /\bhttps?:\/\/[^\s<>"')\]]+/i
const YEAR = /\b(1[5-9]\d{2}|20\d{2})[a-z]?\b/
const QUOTED = /[“"]([^”"]{6,300})[”"]/

/** The first web link in a bibliography line: an `href`, else a bare URL in its text. */
export function referenceUrl(citationHtml: string): string {
  const anchor = citationHtml.match(/<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i)
  const href = decodeEntities((anchor?.[1] ?? anchor?.[2] ?? "").trim())
  if (/^https?:\/\//i.test(href)) return href
  const bare = decodeEntities(citationHtml.replace(/<[^>]*>/g, " ")).match(BARE_URL)?.[0] ?? ""
  return bare.replace(/[.,;:]+$/, "")
}

/** The text of the first `<em>`/`<i>` in a line. */
function italicText(html: string): string {
  const match = html.match(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/i)
  return match ? htmlText(match[2] ?? "") : ""
}

function trimTitle(title: string): string {
  return title.replace(/^[\s“"‘']+|[\s,.;:”"’']+$/g, "").replace(/\s+/g, " ").trim()
}

/**
 * Reads a bibliography line (Chicago style, as the docs' References pages
 * write them) into the fields a search needs. `hints` are what the panel
 * already knows from the citation link: the surnames and the year.
 */
export function describeReferenceCitation(
  citationHtml: string,
  hints: { authors?: string; year?: string } = {},
): ReferenceDescription {
  const url = referenceUrl(citationHtml)
  const withoutLinks = citationHtml.replace(/<a\b[\s\S]*?<\/a>/gi, " ")
  const text = htmlText(withoutLinks).replace(BARE_URL, "").replace(/\s+([.,;:])/g, "$1").trim()

  const quoted = trimTitle(text.match(QUOTED)?.[1] ?? "")
  const italic = trimTitle(italicText(withoutLinks))
  const title = quoted || italic
  const publication = quoted ? italic : ""

  const byline = text.split(/\.\s+(?=[“"A-Z])/)[0] ?? ""
  const authors = (hints.authors ?? "").trim() || byline.slice(0, 120).trim()
  const year = (hints.year ?? "").match(YEAR)?.[0] ?? text.match(YEAR)?.[0] ?? ""

  return { title, authors, year: year.replace(/[a-z]$/i, ""), publication, citation: text, url }
}

// ─── SSRF gate ─────────────────────────────────────────────────────────────

export type SafeUrlResult = { ok: true; url: string } | { ok: false; reason: string }

const MAX_URL_LENGTH = 2048
const INTERNAL_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home", ".corp", ".intranet", ".localdomain"]

function privateIpv4(octets: number[]): boolean {
  const [a = 0, b = 0, c = 0] = octets
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  )
}

/**
 * Whether a URL may be handed to a server-side page extractor: a public
 * `http`/`https` page on the default port, with no credentials. Loopback,
 * private, link-local and metadata addresses, IPv6 literals, single-label and
 * internal host names are refused (the URL parser has already folded octal,
 * hex and integer IPv4 spellings into dotted form). The returned URL is
 * normalised and has no fragment.
 */
export function isSafeArticleUrl(input: string): SafeUrlResult {
  const raw = input.trim()
  if (!raw) return { ok: false, reason: "No address." }
  if (raw.length > MAX_URL_LENGTH) return { ok: false, reason: "The address is too long." }
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return { ok: false, reason: "Not a valid web address." }
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: "Only http and https addresses can be read." }
  }
  if (parsed.username || parsed.password) return { ok: false, reason: "Addresses with a login are not read." }
  if (parsed.port && parsed.port !== "80" && parsed.port !== "443") {
    return { ok: false, reason: "Only the standard web ports can be read." }
  }
  const host = parsed.hostname.toLowerCase().replace(/\.$/, "")
  if (!host || host.includes(":") || host.startsWith("[")) return { ok: false, reason: "That address points to a private network." }
  const blockedName = host === "localhost" || INTERNAL_SUFFIXES.some((suffix) => host.endsWith(suffix)) || !host.includes(".")
  if (blockedName) return { ok: false, reason: "That address points to a private network." }
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4 && privateIpv4(ipv4.slice(1).map(Number))) return { ok: false, reason: "That address points to a private network." }
  if (!ipv4 && /^[\d.]+$/.test(host)) return { ok: false, reason: "Not a valid web address." }
  parsed.hash = ""
  return { ok: true, url: parsed.href }
}

// ─── Words and matching ────────────────────────────────────────────────────

const STOPWORDS = new Set(
  "that this with from have they their there were which would could should about these those than then them what when where while will been being into more most also only other such over under very just some because after before between through the and for are but not you all can had her was one our out has his how its may new now old see two way who did get let put say she too use".split(
    " ",
  ),
)

/** Lower-case words of three or more letters or digits, minus common function words. */
export function contentWords(text: string): string[] {
  return (text.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").match(/[a-z0-9][a-z0-9'’-]{2,}/g) ?? [])
    .map((word) => word.replace(/['’-]+$/g, "").replace(/['’]s$/, ""))
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word))
}

/** The share (0–1) of `wanted`'s distinct content words found in `text`. */
export function wordCoverage(wanted: string, text: string): number {
  const need = new Set(contentWords(wanted))
  if (need.size === 0) return 0
  const have = new Set(contentWords(text))
  let found = 0
  for (const word of need) if (have.has(word)) found++
  return found / need.size
}

function bigrams(words: string[]): Set<string> {
  const pairs = new Set<string>()
  for (let i = 0; i + 1 < words.length; i++) pairs.add(`${words[i]} ${words[i + 1]}`)
  return pairs
}

/**
 * Like {@link wordCoverage}, but for a title of three or more content words
 * the words must also sit next to each other as the title has them, so a page
 * that only shares the title's topic words does not pass for the title.
 */
export function titleCoverage(title: string, text: string): number {
  const coverage = wordCoverage(title, text)
  const wanted = bigrams(contentWords(title))
  if (contentWords(title).length < 3 || wanted.size === 0) return coverage
  const have = bigrams(contentWords(text))
  let adjacent = 0
  for (const pair of wanted) if (have.has(pair)) adjacent++
  return coverage * (0.4 + 0.6 * (adjacent / wanted.size))
}

/** The first author's surname from `Galloway`, `Hansson & Reijven`, `Smith, John, et al.`. */
export function firstSurname(authors: string): string {
  const first = authors.split(/\s*(?:&|\band\b|;|\bet al\.?)\s*/i)[0] ?? ""
  const words = (first.split(",")[0] ?? "").trim().split(/\s+/).filter(Boolean)
  return (words[words.length - 1] ?? "").replace(/[^\p{L}'’-]/gu, "")
}

function hasWord(text: string, word: string): boolean {
  if (!word) return false
  return new RegExp(`(^|[^\\p{L}])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "iu").test(text)
}

/**
 * Search queries for an entry, best first, at most `max`: the quoted title
 * with the first author's surname, then the title with its publication and
 * year; without a title, the byline and what follows it.
 */
export function referenceSearchQueries(ref: Partial<ReferenceDescription>, max = 2): string[] {
  const title = (ref.title ?? "").trim()
  const surname = firstSurname(ref.authors ?? "")
  const publication = (ref.publication ?? "").trim()
  const year = (ref.year ?? "").trim()
  const queries: string[] = []
  const add = (query: string) => {
    const clean = query.replace(/\s+/g, " ").trim().slice(0, 200)
    if (clean && !queries.includes(clean)) queries.push(clean)
  }
  if (title) {
    add(surname && !hasWord(title, surname) ? `"${title}" ${surname}` : `"${title}"`)
    add([title, publication, year].filter(Boolean).join(" "))
  } else {
    add([ref.authors ?? "", year, publication].filter(Boolean).join(" "))
    const words = (ref.citation ?? "").replace(/https?:\/\/\S+/g, " ").replace(/[[\](){}]/g, " ").split(/\s+/).filter(Boolean)
    const cited = words.slice(0, 24).join(" ")
    if (contentWords(cited).length >= 2) add(cited)
  }
  return queries.filter((query) => contentWords(query).length >= 1).slice(0, max)
}

/** One search hit, as the quick-search API returns it. */
export interface SearchHit {
  title?: string
  url?: string
  content?: string
}

export interface RankedHit extends SearchHit {
  url: string
  /** 0–1: how well the hit's title, snippet and address agree with the entry. */
  score: number
}

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

/**
 * Orders search hits by how likely each is the entry's article: its title
 * words in the hit's title and snippet count most, then the author's
 * surname, the year and the publication's name in the snippet or address.
 * Hits with an unsafe or missing URL, and duplicates, are dropped.
 */
export function rankSearchResults(hits: readonly SearchHit[], ref: Partial<ReferenceDescription>): RankedHit[] {
  const surname = firstSurname(ref.authors ?? "")
  const subject = ref.title || ref.citation || ""
  const seen = new Set<string>()
  const ranked: RankedHit[] = []
  hits.forEach((hit, rank) => {
    if (typeof hit.url !== "string") return
    const safe = isSafeArticleUrl(hit.url)
    if (!safe.ok || seen.has(safe.url)) return
    seen.add(safe.url)
    const heading = `${hit.title ?? ""} ${hit.content ?? ""}`
    const titled = titleCoverage(subject, heading)
    const author = hasWord(`${heading} ${hit.url}`, surname) ? 1 : 0
    const year = ref.year && heading.includes(ref.year) ? 1 : 0
    const publication = ref.publication && wordCoverage(ref.publication, `${hit.title ?? ""} ${host(safe.url)} ${hit.content ?? ""}`) >= 0.5 ? 1 : 0
    const order = Math.max(0, 1 - rank * 0.1)
    const score = 0.55 * titled + 0.15 * author + 0.05 * year + 0.15 * publication + 0.1 * order
    ranked.push({ ...hit, url: safe.url, score: Math.round(score * 1000) / 1000 })
  })
  return ranked.sort((a, b) => b.score - a.score)
}

/** The least a page's title and text must agree with the entry to be called its article. */
export const MIN_ARTICLE_MATCH = 0.6

export interface ArticleVerdict {
  /** 0–1 agreement between the page and the entry. */
  score: number
  accepted: boolean
}

/**
 * Whether an extracted page is the entry's article. The entry's title words
 * must appear in the page's title or opening text ({@link MIN_ARTICLE_MATCH}),
 * or at least two thirds of that with the author's surname also in the page's
 * byline or opening. An entry without a title is matched on its whole line.
 */
export function verifyArticle(
  page: { title?: string; author?: string; text: string },
  ref: Partial<ReferenceDescription>,
): ArticleVerdict {
  const opening = page.text.slice(0, 3000)
  const subject = ref.title || ref.citation || ""
  const inTitle = titleCoverage(subject, page.title ?? "")
  const inOpening = titleCoverage(subject, `${page.title ?? ""} ${opening}`)
  const titled = ref.title ? Math.max(inTitle, inOpening * 0.9) : inOpening * 0.8
  const surname = firstSurname(ref.authors ?? "")
  const author = hasWord(`${page.author ?? ""} ${opening}`, surname)
  const score = Math.round(Math.min(1, titled + (author ? 0.05 : 0)) * 1000) / 1000
  const accepted = titled >= MIN_ARTICLE_MATCH || (author && titled >= MIN_ARTICLE_MATCH * (2 / 3) && !!ref.title)
  return { score, accepted }
}

// ─── The server route's answer ─────────────────────────────────────────────

/** The article a reference resolved to. */
export interface ReferenceArticle {
  /** Readable body markup; sanitize it (`@debate-ai/reading-mode/article-html`) before showing it. */
  html: string
  title?: string
  author?: string
  date?: string
  source?: string
  wordCount: number
}

/** Why a cited link was not used. */
export interface UrlFailure {
  url: string
  reason: string
}

/** A page the search turned up but could not be confirmed as the article. */
export interface ReferenceCandidate {
  title: string
  url: string
}

export type ReferenceArticleResponse =
  | {
      status: "found"
      /** `url`: the entry's own link. `search`: found by searching the entry's title and author. */
      via: "url" | "search"
      /** The page the text came from. */
      url: string
      query?: string
      /** 0–1 agreement with the entry, for pages found by search. */
      confidence?: number
      urlFailed?: UrlFailure
      article: ReferenceArticle
    }
  | {
      status: "not_found"
      queries: string[]
      urlFailed?: UrlFailure
      candidates: ReferenceCandidate[]
    }
