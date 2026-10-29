/**
 * @file citation-cards.ts
 * @description Matches author-date in-text citations — `Shanahan (1993)`,
 * `(Alinsky 1971, 66)`, `(Dean 1994; Dean 2004)` — to the entries of a
 * References page, so `rehype-citation-cards.ts` can turn each one into a
 * link with a hover card showing the full evidence card.
 *
 * A References page is one ordered list. Each item is either a collapsible
 * card, `<details><summary>{citation}</summary><div className="debate-card">
 * {qualification and card text}</div></details>`, or a plain Markdown
 * citation with no card. An entry's number is its position in that list, the
 * number the reader sees beside it.
 *
 * Pure string work, no file system, so it runs in the MDX build and in tests.
 */

/** One entry of a References page. */
export interface ReferenceEntry {
  /** 1-based position in the list, as rendered beside the entry. */
  number: number;
  /** Anchor id on the entry's list item, e.g. `ref-shanahan-1993`. */
  id: string;
  /** Publication year as cited, e.g. `1993` or `2004a`. */
  year: string;
  /** Surnames in byline order; a corporate author is one "surname". */
  surnames: string[];
  /** The byline had "et al." (or three or more authors). */
  etAl: boolean;
  /**
   * Author strings an in-text citation may use for this entry, longest first:
   * `Krause and Williams`, `Ross Arguedas et al.`, `Bethesda Game Studios`.
   */
  labels: string[];
  /** The full bibliography entry as HTML. */
  citationHtml: string;
  /** The card body (qualification, then card text) as HTML; empty if none. */
  cardHtml: string;
}

/** A citation found in a run of text, by character offsets. */
export interface CitationMatch {
  start: number;
  end: number;
  entry: ReferenceEntry;
}

const YEAR = String.raw`(?:\[\d{4}\]\s*)?\d{4}[a-z]?`;
const YEAR_ONLY = new RegExp(`^${YEAR}$`);
/** A parenthetical containing at least one year. */
const PAREN = new RegExp(String.raw`\(([^()]*?\b\d{4}[a-z]?\b[^()]*)\)`, 'g');
/** One parenthetical citation: optional lead-in, author, year, locator. */
const PART = new RegExp(String.raw`^((?:cf\.|see|e\.g\.,?)\s+)?(.+?),?\s+(${YEAR})(?=$|[\s,:;])`, 'i');
/** `Last, First. 1998.` — the author part and year of a Chicago entry. */
const BYLINE = /^(.*?)\.\s+(?:[[(]\d{4}[\])]\s+)?(\d{4}[a-z]?)\./;
/** Roles that trail a byline: `Krause, Keith, and Michael C. Williams, eds.` */
const ROLE = /,\s*(?:eds?|dir|trans|comp|writer and performer)\.?$/i;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Visible text of an HTML fragment. */
export function htmlToText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&(#\d+|[a-z]+);/gi, (m, name: string) =>
      name.startsWith('#') ? String.fromCodePoint(Number(name.slice(1))) : (ENTITIES[name.toLowerCase()] ?? m),
    );
}

/** Folds the variations a hand-typed citation drifts through. */
function normalize(text: string): string {
  return text.normalize('NFC').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
}

/** `Michael C. Williams` → `Williams`. */
function lastName(fullName: string): string {
  const words = fullName.trim().split(/\s+/);
  return words[words.length - 1] ?? fullName;
}

/** Surnames and "et al." from a byline such as `Carlin, Diana, and David Levasseur`. */
export function parseByline(byline: string): { surnames: string[]; etAl: boolean } {
  const authors = byline.replace(ROLE, '').trim();
  const firstComma = authors.indexOf(',');
  if (firstComma < 0) return { surnames: [authors], etAl: false };
  const first = authors.slice(0, firstComma).trim();
  const rest = authors.slice(firstComma + 1);
  const etAl = /\bet al\b/.test(rest);
  // `Keith, and Michael C. Williams` → the first author's given name, then co-authors.
  const others = rest
    .replace(/,?\s*et al\.?/, '')
    .split(/,?\s+and\s+|,\s+/)
    .slice(1)
    .map((name) => lastName(name))
    .filter(Boolean);
  return { surnames: [first, ...others], etAl };
}

/** In-text author strings for an entry, most specific first. */
function citationLabels(surnames: string[], etAl: boolean, title: string | undefined): string[] {
  const [first, second] = surnames;
  const labels: string[] = [];
  if (etAl || surnames.length >= 3) labels.push(`${first} et al.`);
  else if (second) labels.push(`${first} and ${second}`, `${first} & ${second}`);
  labels.push(first!);
  // Unsigned pieces are cited by a short title: (“Debatable Point” 2008).
  if (title) labels.push(`“${title}”`, `"${title}"`);
  return labels.map(normalize).sort((a, b) => b.length - a.length);
}

/** `ref-ross-arguedas-2022`: stable across reorders, readable in a URL. */
function anchorId(surname: string, year: string, taken: Set<string>): string {
  const slug = surname
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const base = `ref-${slug || 'entry'}-${year}`;
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  taken.add(id);
  return id;
}

/** `*Title*` → `<em>Title</em>`, for the plain Markdown entries. */
function markdownInline(text: string): string {
  return text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

/**
 * Reads the entries of a References page's MDX source. Lines that are not
 * ordered-list items (frontmatter, the stats table) are ignored.
 */
export function parseReferences(source: string): ReferenceEntry[] {
  const entries: ReferenceEntry[] = [];
  const taken = new Set<string>();
  for (const line of source.split(/\r?\n/)) {
    const item = /^\d+\.\s+(.*)$/.exec(line);
    if (!item) continue;
    const body = item[1]!.trim();
    const details = /^<details>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>\s*$/.exec(body);
    const citationHtml = details ? details[1]!.trim() : markdownInline(body);
    const cardHtml = details ? details[2]!.trim().replace(/\bclassName=/g, 'class=') : '';

    const text = normalize(htmlToText(citationHtml));
    const byline = BYLINE.exec(text);
    // A non-Chicago entry (`Tetlock, Philip E. *Title* …, 2017.`): the year is
    // the last one given, the authors everything before the first sentence.
    const year = byline?.[2] ?? text.match(/\b\d{4}\b(?!.*\b\d{4}\b)/)?.[0] ?? '';
    const authorPart = byline?.[1] ?? text.split(/\.\s/)[0] ?? text;
    const { surnames, etAl } = parseByline(authorPart);
    const title = /\d{4}[a-z]?\.\s+“(?:(?:A|An|The)\s+)?([^”]+?)[.,]?”/.exec(text)?.[1];

    entries.push({
      number: entries.length + 1,
      id: anchorId(surnames[0] ?? '', year, taken),
      year,
      surnames,
      etAl,
      labels: citationLabels(surnames, etAl, title),
      citationHtml,
      cardHtml,
    });
  }
  return entries;
}

/** Entries grouped by year, for lookups from in-text citations. */
export type CitationIndex = Map<string, ReferenceEntry[]>;

export function buildCitationIndex(entries: ReferenceEntry[]): CitationIndex {
  const index: CitationIndex = new Map();
  for (const entry of entries) {
    const bucket = index.get(entry.year) ?? [];
    bucket.push(entry);
    index.set(entry.year, bucket);
  }
  return index;
}

/** `[1888] 1990` → `1990`: entries are filed under the edition year. */
function editionYear(year: string): string {
  return year.replace(/^\[\d{4}\]\s*/, '');
}

/** The entry an author string and year cite, if the References list has it. */
export function lookupCitation(index: CitationIndex, author: string, year: string): ReferenceEntry | undefined {
  const wanted = normalize(author).replace(/'s$/, '');
  return index.get(editionYear(year))?.find((entry) => entry.labels.includes(wanted));
}

/**
 * For a narrative citation, `Name (1993)`: the entry whose author label the
 * text before the parenthesis ends with, and where that label starts.
 */
function lookupNarrative(
  index: CitationIndex,
  before: string,
  year: string,
): { entry: ReferenceEntry; labelStart: number } | undefined {
  const text = before.replace(/\s+$/, '');
  const possessive = /['’]s$/.test(text);
  const bare = normalize(possessive ? text.slice(0, -2) : text);
  for (const entry of index.get(editionYear(year)) ?? []) {
    for (const label of entry.labels) {
      if (!bare.endsWith(label)) continue;
      const preceding = bare.charAt(bare.length - label.length - 1);
      if (preceding && /[\p{L}\p{N}]/u.test(preceding)) continue;
      // Offsets in `before`: the normalized text only ever shortens whitespace
      // runs and swaps one apostrophe for another, so count back on the raw text.
      const rawLabelLength = label.length + (possessive ? 2 : 0);
      const labelStart = text.length - rawLabelLength;
      if (labelStart < 0 || normalize(text.slice(labelStart)) !== normalize(label + (possessive ? "'s" : ''))) {
        continue;
      }
      return { entry, labelStart };
    }
  }
  return undefined;
}

/**
 * Every citation in a run of text that matches an entry, in order. Citations
 * that match nothing are left out, so they stay plain text.
 *
 * - Narrative, one year: `Shanahan (1993)`, `Hazlett’s (2021)`,
 *   `Bronner (1999, 302)` — the author and the parenthesis are one match.
 * - Narrative, several years: `Foucault (1972, 1988)` — each year is a match.
 * - Parenthetical: `(Alinsky 1971, 66)`, `(cf. Adorno 1973: 303; Hitchens 1999)`
 *   — each `;`-separated part, author through locator, is a match.
 */
export function findCitations(text: string, index: CitationIndex): CitationMatch[] {
  const matches: CitationMatch[] = [];
  for (const paren of text.matchAll(PAREN)) {
    const open = paren.index!;
    const inner = paren[1]!;
    const innerStart = open + 1;
    const close = open + paren[0].length;

    const pieces = inner.split(',').map((piece) => piece.trim());
    const years: string[] = [];
    for (const piece of pieces) {
      if (!YEAR_ONLY.test(piece)) break;
      years.push(piece);
    }

    if (years.length > 0) {
      // Narrative: the author sits right before the parenthesis.
      const before = text.slice(0, open);
      if (years.length === 1) {
        const hit = lookupNarrative(index, before, years[0]!);
        if (hit) matches.push({ start: hit.labelStart, end: close, entry: hit.entry });
        continue;
      }
      let cursor = innerStart;
      for (const year of years) {
        const at = text.indexOf(year, cursor);
        cursor = at + year.length;
        const hit = lookupNarrative(index, before, year);
        if (hit) matches.push({ start: at, end: cursor, entry: hit.entry });
      }
      continue;
    }

    let partStart = innerStart;
    for (const part of inner.split(';')) {
      const leading = part.length - part.trimStart().length;
      const trimmed = part.trim();
      const parsed = PART.exec(trimmed);
      if (parsed) {
        const entry = lookupCitation(index, parsed[2]!, parsed[3]!);
        if (entry) {
          const start = partStart + leading + (parsed[1]?.length ?? 0);
          matches.push({ start, end: partStart + leading + trimmed.length, entry });
        }
      }
      partStart += part.length + 1;
    }
  }
  return matches.sort((a, b) => a.start - b.start);
}
