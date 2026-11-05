/**
 * @file citation-styles.ts
 * @description Reformats a Chicago bibliography entry, as written on the
 * Synergy Slayer References pages (notes-bibliography: the year near the end,
 * after the publisher or periodical), into APA (7th), MLA (9th) or Harvard.
 * `toAuthorDate` first moves the year up behind the byline, the shape the
 * parsers below read; entries already written author-date still parse. The pages are authored in Chicago; the citation style switcher
 * (`components/guides/citation-style-switcher.tsx`) and the in-text citation
 * hover cards run each entry through `formatCitation` for the reader's style.
 *
 * Works on the entry's HTML so `<em>` titles and `<a>` links survive. The
 * entry is split into byline, year, title and what follows it (journal and
 * volume, a chapter's book and editors, a periodical's date, a publisher,
 * a link). Anything that does not parse, such as a court case or an entry
 * with no year after the byline, is returned unchanged, still in Chicago.
 *
 * Titles keep the capitalization they were written with: turning them into
 * APA's sentence case would lowercase proper nouns.
 *
 * Pure string work, so it runs in the browser and in tests.
 */

export const CITATION_STYLES = ['chicago', 'apa', 'mla', 'harvard'] as const;
export type CitationStyle = (typeof CITATION_STYLES)[number];

export const CITATION_STYLE_LABELS: Record<CitationStyle, string> = {
  chicago: 'Chicago',
  apa: 'APA',
  mla: 'MLA',
  harvard: 'Harvard',
};

export const DEFAULT_CITATION_STYLE: CitationStyle = 'chicago';

export function isCitationStyle(value: unknown): value is CitationStyle {
  return typeof value === 'string' && (CITATION_STYLES as readonly string[]).includes(value);
}

/** One person in a byline, or a corporate author (`given` empty). */
interface Person {
  family: string;
  given: string;
  suffix: string;
}

interface Byline {
  people: Person[];
  etAl: boolean;
  /** `ed.` / `eds.` after the byline: the people edited the work. */
  editors: boolean;
}

/** What follows the title. Only one of the shapes is set. */
interface Tail {
  /** `<em>Journal</em> 53 (211): 243–55` */
  journal?: { name: string; volume: string; issue: string; pages: string };
  /** `In <em>Book</em>, edited by X, 145–60. Publisher` */
  chapter?: { book: string; editors: string; pages: string; publisher: string };
  /** `<em>Site</em>, July 29` or just `<em>Site</em>` */
  periodical?: { name: string; date: string };
  /** Anything else, e.g. a book's publisher: kept as written. */
  rest?: string;
}

interface Entry {
  byline: Byline;
  year: string;
  /** `(1946) 2007` → `1946`. */
  originalYear: string;
  /** Title as HTML without its wrapping quotes / `<em>` and final period. */
  title: string;
  /** Quoted titles are parts of something (articles, chapters); italic ones stand alone. */
  titleKind: 'part' | 'whole';
  tail: Tail;
  url: string;
}

const SUFFIX = /^(?:Jr|Sr|II|III|IV)\.?$/;

/** `Michael S.` → `M. S.`; `Jean-Paul` → `J.-P.`; lowercase particles dropped. */
function initials(given: string, spaced = true): string {
  return given
    .split(/\s+/)
    .filter((word) => /^\p{Lu}/u.test(word))
    .map((word) =>
      word
        .split('-')
        .map((part) => `${[...part][0]}.`)
        .join('-'),
    )
    .join(spaced ? ' ' : '');
}

function personFromFullName(name: string): Person {
  const words = name.trim().split(/\s+/);
  let suffix = '';
  if (words.length > 1 && SUFFIX.test(words[words.length - 1]!.replace(/,$/, ''))) suffix = words.pop()!;
  const family = words.pop() ?? '';
  return { family, given: words.join(' ').replace(/,$/, ''), suffix };
}

/** `Carlin, Diana, and David Levasseur` / `Foster, Peter, et al.` / `Macauley, David, ed.` */
export function parseChicagoByline(text: string): Byline {
  let rest = text.trim();
  let editors = false;
  rest = rest.replace(/,\s*eds?\.?$/i, () => {
    editors = true;
    return '';
  });
  let etAl = false;
  rest = rest.replace(/,?\s*et al\.?$/, () => {
    etAl = true;
    return '';
  });
  const comma = rest.indexOf(',');
  if (comma < 0) return { people: [{ family: rest, given: '', suffix: '' }], etAl, editors };

  const family = rest.slice(0, comma).trim();
  const parts = rest
    .slice(comma + 1)
    .split(/,\s*and\s+|\s+and\s+|,\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  const first: Person = { family, given: parts.shift() ?? '', suffix: '' };
  if (parts[0] && SUFFIX.test(parts[0])) first.suffix = parts.shift()!;
  const people = [first];
  for (const part of parts) {
    if (SUFFIX.test(part) && people.length > 1) people[people.length - 1]!.suffix = part;
    else people.push(personFromFullName(part));
  }
  return { people, etAl, editors };
}

/** `243–55` → `243–255`, as APA and Harvard want page ranges in full. */
export function expandPages(pages: string): string {
  return pages.replace(/(\d+)([–-])(\d+)/g, (match, start: string, dash: string, end: string) => {
    if (end.length >= start.length) return match;
    return `${start}${dash}${start.slice(0, start.length - end.length)}${end}`;
  });
}

const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December';
const DATE = new RegExp(String.raw`^(?:(${MONTHS})(?:\s+(\d{1,2}))?|(?:Spring|Summer|Fall|Autumn|Winter)|(?:${MONTHS})[–-](?:${MONTHS}))$`);
/** An editor list: periods only after an initial (`Edward N. Zalta`) or in `et al.` */
const NAMES = String.raw`(?:[^.]|(?<=\b\p{Lu})\.|(?<=\bet al)\.)+?`;
const CHAPTER = new RegExp(
  String.raw`^In <em>(.+?)<\/em>,?\s*(?:edited by (${NAMES})(?:,\s*(\d+(?:[–-]\d+)?))?(?<!\b\p{Lu}|\bet al)\.|(\d+(?:[–-]\d+)?)\.)?\s*(.*)$`,
  'u',
);
const JOURNAL = /^<em>([^<]+)<\/em>,?\s+(\d+)(?:\s*\(([^)]+)\))?(?::\s*(\d+(?:[–-]\d+)?))?\.?$/;
const PERIODICAL = /^<em>([^<]+)<\/em>(?:,\s*([^.<]+))?\.?$/;
/** A trailing link, Chicago's last element. */
const LINK = /\s*<a\b[^>]*\bhref="([^"]*)"[^>]*>[\s\S]*?<\/a>\.?\s*$/;

function parseTail(html: string): Tail {
  const text = html.trim();
  if (!text) return {};
  const chapter = CHAPTER.exec(text);
  if (chapter) {
    return {
      chapter: {
        book: chapter[1]!,
        editors: chapter[2]?.trim() ?? '',
        pages: chapter[3] ?? chapter[4] ?? '',
        publisher: chapter[5]!.replace(/\.$/, '').trim(),
      },
    };
  }
  const journal = JOURNAL.exec(text);
  if (journal) {
    return { journal: { name: journal[1]!, volume: journal[2]!, issue: journal[3] ?? '', pages: journal[4] ?? '' } };
  }
  const periodical = PERIODICAL.exec(text);
  if (periodical && (!periodical[2] || DATE.test(periodical[2].trim()))) {
    return { periodical: { name: periodical[1]!, date: periodical[2]?.trim() ?? '' } };
  }
  return { rest: text.replace(/\.$/, '') };
}

/** Byline, year, title, then the rest: `Last, First. 2003. “Title.” …` */
const ENTRY = /^(.+?)\.\s+(?:\((\d{4})\)\s+)?(\d{4}[a-z]?|n\.d)\.\s+([\s\S]+)$/;

const SEASON = String.raw`(?:${MONTHS}|Spring|Summer|Fall|Autumn|Winter)`;
/** `<em>Journal</em> 26, no. 3 (1999): 183–201.` and its no-volume / no-issue variants. */
const NB_JOURNAL = /^(<em>[^<]+<\/em>)(?:\s+(\d+))?(?:,\s*no\.\s*([^\s(]+))?\s*\((?:([^)]*?)\s+)?(\d{4})\)(?::\s*([^.]+))?\.$/;

/**
 * Rewrites a Chicago notes-bibliography entry — the year near the end, as the
 * References pages are written: `Last, First. “Title.” <em>Site</em>, July 29,
 * 2003. <a>…</a>.` — into the author-date shape the parsers here read:
 * `Last, First. 2003. “Title.” <em>Site</em>, July 29. <a>…</a>.` A trailing
 * `Originally published 1785.` becomes the `(1785) 2002` original year.
 *
 * An entry already in author-date shape comes back unchanged; one that is
 * neither (a court case, `Quoted in …`) comes back `undefined`.
 */
export function toAuthorDate(html: string): string | undefined {
  let body = html.trim();
  let link = '';
  const linkMatch = LINK.exec(body);
  if (linkMatch) {
    link = ` ${linkMatch[0].trim()}`;
    body = body.slice(0, linkMatch.index).trim();
  }
  if (ENTRY.test(body)) return html;
  let originalYear = '';
  body = body.replace(/\s*Originally published (\d{4})\.$/, (_, year: string) => {
    originalYear = year;
    return '';
  });
  const match = /^(.+?)\.\s+(“[\s\S]+?”|<em>[\s\S]+?<\/em>\.?)\s*([\s\S]*)$/.exec(body);
  if (!match || match[1]!.includes('<')) return undefined;
  const [, byline, title] = match;
  let rest = match[3]!.trim();
  let year: string;
  const journal = NB_JOURNAL.exec(rest);
  const trailing = /(?:^|\s)(\d{4}|n\.d)\.$/.exec(rest);
  if (journal) {
    const [, name, volume, issue, season, journalYear, pages] = journal;
    year = journalYear!;
    const locator = pages ? `: ${pages}` : '';
    if (volume) rest = `${name} ${volume}${issue ? ` (${issue})` : ''}${locator}.`;
    else if (issue) rest = `${name}, no. ${issue}${season ? ` (${season})` : ''}${locator}.`;
    else rest = `${name}${pages ? `, ${pages}` : ''}.`;
  } else if (trailing) {
    year = trailing[1] === 'n.d' ? 'n.d.' : trailing[1]!;
    const y = year.replace(/\./g, '\\.');
    rest = rest
      .slice(0, trailing.index)
      .replace(/,$/, '')
      .replace(new RegExp(String.raw`,\s*${y}(?=;|$)`, 'g'), '')
      .replace(new RegExp(String.raw`(${SEASON})\s+${y}(?=;|$)`, 'g'), '$1')
      .trim();
    if (rest && !/\.$/.test(rest)) rest += '.';
  } else {
    // The year sits inside the details, e.g. `Winter 2020 ed.`
    const inner = /\((?:[^)]*\s)?(\d{4})\)/.exec(rest)?.[1] ?? rest.match(/\b\d{4}\b(?!.*\b\d{4}\b)/)?.[0];
    if (!inner) return undefined;
    year = inner;
    // A journal standing as the title: `<em>Law Review</em> 41, no. 4 (2007): 1633–.`
    rest = rest.replace(new RegExp(String.raw`^(\d+), no\. ([^\s(]+) \(${year}\)`), '$1 ($2)');
  }
  const lead = `${byline}. ${originalYear ? `(${originalYear}) ` : ''}${year === 'n.d.' ? 'n.d.' : `${year}.`}`;
  return `${lead} ${title}${rest ? ` ${rest}` : ''}${link}`;
}

/**
 * Splits a Chicago entry, notes-bibliography (as the pages are written) or
 * author-date; `undefined` when it is neither.
 */
export function parseChicagoEntry(source: string): Entry | undefined {
  const html = toAuthorDate(source);
  if (!html) return undefined;
  let body = html.trim();
  let url = '';
  const link = LINK.exec(body);
  if (link) {
    url = link[1]!;
    body = body.slice(0, link.index).trim();
  }
  const match = ENTRY.exec(body);
  if (!match || match[1]!.includes('<')) return undefined;
  const [, byline, originalYear = '', year, afterYear] = match;

  let title: string;
  let titleKind: Entry['titleKind'];
  let remainder: string;
  const quoted = /^“([\s\S]+?)”\s*([\s\S]*)$/.exec(afterYear!);
  const italic = /^<em>([\s\S]+?)<\/em>\.?\s*([\s\S]*)$/.exec(afterYear!);
  if (quoted) {
    title = quoted[1]!;
    titleKind = 'part';
    remainder = quoted[2]!;
  } else if (italic) {
    title = italic[1]!;
    titleKind = 'whole';
    remainder = italic[2]!;
  } else {
    return undefined;
  }
  // Chicago tucks the title's period inside the quotes: `“Title.”`.
  title = title.replace(/[.,]$/, '');
  return {
    byline: parseChicagoByline(byline!),
    year: year === 'n.d' ? 'n.d.' : year!,
    originalYear,
    title,
    titleKind,
    tail: parseTail(remainder),
    url,
  };
}

/** Ends a piece with a period unless it already ends in punctuation. */
function sentence(text: string): string {
  return /[.?!][”’]?(?:<\/em>)?[”’]?$/.test(text) ? text : `${text}.`;
}

/** `?`/`!` closing a title stands in for the comma or period after it. */
function endsWithMark(text: string): boolean {
  return /[?!]$/.test(text.replace(/<[^>]*>/g, ''));
}

/** `London: Frank Cass` → `Frank Cass`: APA 7 and MLA 9 drop the place of publication. */
function withoutPlace(publisher: string): string {
  return publisher.replace(/^\p{Lu}[\p{L}.]*(?:,?\s+\p{Lu}[\p{L}.]*)*:\s+/u, '');
}

function linkHtml(url: string, text = url): string {
  return url ? `<a href="${url}">${text}</a>` : '';
}

function urlWithScheme(url: string): string {
  return url && !/^[a-z]+:/i.test(url) ? `https://${url}` : url;
}

// ── APA 7 ────────────────────────────────────────────────────────────────

function apaPerson(person: Person): string {
  if (!person.given) return person.family;
  const suffix = person.suffix ? `, ${person.suffix}` : '';
  return `${person.family}, ${initials(person.given)}${suffix}`;
}

function apaAuthors(byline: Byline): string {
  const names = byline.people.map(apaPerson);
  let list: string;
  if (byline.etAl) list = `${names.join(', ')}, et al.`;
  else if (names.length === 1) list = names[0]!;
  else if (names.length === 2) list = `${names[0]}, & ${names[1]}`;
  else list = `${names.slice(0, -1).join(', ')}, & ${names[names.length - 1]}`;
  if (byline.editors) list = `${sentence(list)} (${names.length > 1 ? 'Eds' : 'Ed'}.)`;
  return sentence(list);
}

/** `Evan Selinger` → `E. Selinger`; `Walter Carlsnaes et al.` kept with `et al.` */
function apaEditors(editors: string): string {
  const etAl = /\bet al\.?$/.test(editors);
  const names = editors
    .replace(/,?\s*et al\.?$/, '')
    .split(/,\s*and\s+|\s+and\s+|,\s*/)
    .filter(Boolean)
    .map(personFromFullName)
    .map((person) => (person.given ? `${initials(person.given)} ${person.family}` : person.family));
  const list = names.length > 2 ? `${names.slice(0, -1).join(', ')}, & ${names.at(-1)}` : names.join(' & ');
  return `${list}${etAl ? ' et al.' : ''} (${names.length > 1 || etAl ? 'Eds' : 'Ed'}.)`;
}

function formatApa(entry: Entry): string {
  const { tail } = entry;
  const date = tail.periodical?.date ? `${entry.year}, ${tail.periodical.date}` : entry.year;
  const parts = [apaAuthors(entry.byline), `(${date}).`];
  parts.push(entry.titleKind === 'whole' ? sentence(`<em>${entry.title}</em>`) : sentence(entry.title));
  if (tail.journal) {
    const { name, volume, issue, pages } = tail.journal;
    let source = `<em>${name}</em>, <em>${volume}</em>${issue ? `(${issue})` : ''}`;
    if (pages) source += `, ${expandPages(pages)}`;
    parts.push(sentence(source));
  } else if (tail.chapter) {
    const { book, editors, pages, publisher } = tail.chapter;
    let source = `In ${editors ? `${apaEditors(editors)}, ` : ''}<em>${book}</em>`;
    if (pages) source += ` (${/[–-]/.test(pages) ? 'pp.' : 'p.'} ${expandPages(pages)})`;
    parts.push(sentence(source));
    if (publisher) parts.push(sentence(withoutPlace(publisher)));
  } else if (tail.periodical) {
    parts.push(sentence(`<em>${tail.periodical.name}</em>`));
  } else if (tail.rest) {
    parts.push(sentence(withoutPlace(tail.rest)));
  }
  if (entry.url) parts.push(linkHtml(entry.url, urlWithScheme(entry.url)));
  if (entry.originalYear) parts.push(`(Original work published ${entry.originalYear})`);
  return parts.join(' ');
}

// ── MLA 9 ────────────────────────────────────────────────────────────────

function fullName(person: Person): string {
  const name = person.given ? `${person.given} ${person.family}` : person.family;
  return person.suffix ? `${name}, ${person.suffix}` : name;
}

function mlaAuthors(byline: Byline): string {
  const [first, second] = byline.people;
  const lead = first!.given
    ? `${first!.family}, ${first!.given}${first!.suffix ? `, ${first!.suffix}` : ''}`
    : first!.family;
  let list: string;
  if (byline.etAl || byline.people.length >= 3) list = `${lead}, et al`;
  else if (second) list = `${lead}, and ${fullName(second)}`;
  else list = lead;
  if (byline.editors) list += byline.people.length > 1 || byline.etAl ? ', editors' : ', editor';
  return sentence(list);
}

/** `July 29` → `29 July`; `January–February` and seasons stay. */
function dayMonth(date: string): string {
  const match = /^([A-Z][a-z]+)\s+(\d{1,2})$/.exec(date);
  return match ? `${match[2]} ${match[1]}` : date;
}

function formatMla(entry: Entry): string {
  const { tail } = entry;
  const title = entry.titleKind === 'whole' ? `<em>${entry.title}</em>` : entry.title;
  const parts = [mlaAuthors(entry.byline)];
  const container: string[] = [];
  if (tail.journal) {
    const { name, volume, issue, pages } = tail.journal;
    container.push(`<em>${name}</em>`, `vol. ${volume}`);
    if (issue) container.push(`no. ${issue}`);
    container.push(entry.year);
    if (pages) container.push(`${pages.includes('–') || pages.includes('-') ? 'pp.' : 'p.'} ${pages}`);
  } else if (tail.chapter) {
    const { book, editors, pages, publisher } = tail.chapter;
    container.push(`<em>${book}</em>`);
    if (editors) container.push(`edited by ${editors}`);
    if (publisher) container.push(withoutPlace(publisher));
    container.push(entry.year);
    if (pages) container.push(`${pages.includes('–') || pages.includes('-') ? 'pp.' : 'p.'} ${pages}`);
  } else if (tail.periodical) {
    container.push(`<em>${tail.periodical.name}</em>`);
    container.push(tail.periodical.date ? `${dayMonth(tail.periodical.date)} ${entry.year}` : entry.year);
  } else if (tail.rest) {
    container.push(withoutPlace(tail.rest), entry.year);
  } else {
    container.push(entry.year);
  }
  if (entry.url) container.push(linkHtml(entry.url, entry.url.replace(/^https?:\/\//, '')));

  if (entry.titleKind === 'part') {
    // `“Title.”` — the period sits inside the quotes, unless `?` or `!` ends it.
    parts.push(`“${endsWithMark(title) ? title : `${title}.`}”`);
  } else {
    parts.push(sentence(title));
  }
  parts.push(sentence(container.join(', ')));
  if (entry.originalYear) parts.splice(2, 0, `${entry.originalYear}.`);
  return parts.join(' ');
}

// ── Harvard (Cite Them Right) ────────────────────────────────────────────

function harvardPerson(person: Person): string {
  if (!person.given) return person.family;
  return `${person.family}${person.suffix ? ` ${person.suffix}` : ''}, ${initials(person.given, false)}`;
}

function harvardAuthors(byline: Byline): string {
  const names = byline.people.map(harvardPerson);
  let list: string;
  if (byline.etAl || names.length >= 4) list = `${names[0]} et al.`;
  else if (names.length === 1) list = names[0]!;
  else list = `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  if (byline.editors) list += ` (${names.length > 1 || byline.etAl ? 'eds' : 'ed'}.)`;
  return list;
}

function harvardEditors(editors: string): string {
  const etAl = /\bet al\.?$/.test(editors);
  const names = editors
    .replace(/,?\s*et al\.?$/, '')
    .split(/,\s*and\s+|\s+and\s+|,\s*/)
    .filter(Boolean)
    .map(personFromFullName)
    .map(harvardPerson);
  const list = etAl ? `${names[0]} et al.` : names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0]!;
  return `${list} (${names.length > 1 || etAl ? 'eds' : 'ed'}.)`;
}

function formatHarvard(entry: Entry): string {
  const { tail } = entry;
  const year = entry.originalYear ? `${entry.year} [${entry.originalYear}]` : entry.year;
  const lead = `${harvardAuthors(entry.byline)} (${year})`;
  let body: string;
  if (entry.titleKind === 'whole') {
    body = `${lead} ${sentence(`<em>${entry.title}</em>`)}`;
    if (tail.rest) body += ` ${sentence(tail.rest)}`;
  } else {
    body = `${lead} ‘${entry.title}’`;
    if (tail.journal) {
      const { name, volume, issue, pages } = tail.journal;
      body += `, <em>${name}</em>, ${volume}${issue ? `(${issue})` : ''}`;
      body += pages ? `, ${pages.includes('–') || pages.includes('-') ? 'pp.' : 'p.'} ${expandPages(pages)}.` : '.';
    } else if (tail.chapter) {
      const { book, editors, pages, publisher } = tail.chapter;
      body += sentence(`, in ${editors ? `${harvardEditors(editors)} ` : ''}<em>${book}</em>`);
      if (publisher) body += ` ${publisher}`;
      body += pages ? `${publisher ? ',' : ''} pp. ${expandPages(pages)}.` : publisher ? '.' : '';
    } else if (tail.periodical) {
      body += `, <em>${tail.periodical.name}</em>`;
      body += tail.periodical.date ? `, ${dayMonth(tail.periodical.date)}.` : '.';
    } else if (tail.rest) {
      body += `. ${sentence(tail.rest)}`;
    } else {
      body += '.';
    }
  }
  if (entry.url) body += ` Available at: ${linkHtml(entry.url, urlWithScheme(entry.url))}.`;
  return body;
}

/**
 * `html` (a Chicago entry) in `style`. Entries that don't parse
 * come back unchanged.
 */
export function formatCitation(html: string, style: CitationStyle): string {
  if (style === 'chicago') return html;
  const entry = parseChicagoEntry(html);
  if (!entry) return html;
  switch (style) {
    case 'apa':
      return formatApa(entry);
    case 'mla':
      return formatMla(entry);
    case 'harvard':
      return formatHarvard(entry);
  }
}
