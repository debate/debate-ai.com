/**
 * @file extract-authors.ts
 * @description Builds the authors dataset from the References pages of the
 * docs: one citation per entry (a card with its quoted text), one author per
 * distinct person or organization credited in the entries' bylines.
 *
 * It reuses the parsers behind the References side panel: `parseReferences`
 * (entries, anchors, in-text citation matching), `parseChicagoEntry` (title,
 * journal, link), `classifySource`, `isInstitutionAuthor`,
 * `stripAuthorFromQualification` and `referenceQuoteStatus`. What it adds is
 * the step the panel never needed: telling which bylines name the same person
 * (`author-names.ts`) and splitting a card's qualifications between its
 * co-authors.
 *
 * Pure: it takes the MDX source text of each collection (`collect-authors.ts`
 * reads the files) and returns plain JSON, deterministically, so syncing
 * unchanged docs rewrites the committed snapshot with identical bytes.
 *
 * Limits, all reported as `warnings` or in `stats`:
 * - A byline with `et al.` credits only the authors it names; the rest are not
 *   known. `etAl` marks those cards.
 * - A court case, or any entry without a `Last, First.` byline, has no author.
 * - Spellings are merged on family name and compatible given names; an
 *   initial-only spelling that fits two different people is left unmerged.
 * - Editors named in the tail of an entry (`Edited by Ryan Galloway`) are not
 *   in the byline and are not credited.
 */
import { toAuthorDate, parseChicagoEntry } from '../citation-styles';
import { classifySource, stripAuthorFromQualification } from '../reference-display';
import { referenceQuoteStatus } from '../reference-quote-status';
import { buildCitationIndex, findCitations, htmlToText, parseReferences, type ReferenceEntry } from '../mdx/citation-cards';
import { displayName, mergeNameVariants, parseAuthorPart, searchKey, slugify, sortName, type ParsedAuthorPart, type PersonName } from './author-names';
import type {
  AuthorRecord,
  AuthorRole,
  AuthorsDataset,
  AuthorsDatasetWarning,
  CitationAuthorLink,
  CitationRecord,
  CitedInPage,
} from './types';

/** One docs folder with a References page: its source text and the pages that cite it. */
export interface CollectionSource {
  /** Content-relative folder without slashes at the ends: `journal/synergy-slayer-critiques`. */
  dir: string;
  title: string;
  /** Raw MDX of the folder's `references.mdx`. */
  referencesSource: string;
  /** The folder's other pages, in reading order, for the "cited in" links. */
  pages: { path: string; title: string; source: string }[];
}

/** URL prefix of the docs (`lib/fumadocs/base-path.ts`). */
const DOCS_PATH = '/docs';

const BYLINE = /^(.*?)\.\s+(?:[[(]\d{4}[\])]\s+)?(\d{4}[a-z]?(?=\.)|n\.d\.)/;

const INLINE_TAGS = new Set(['em', 'i', 'strong', 'b']);
const QUOTE_TAGS = new Set(['p', 'u', 'mark', 'em', 'i', 'strong', 'b', 'sup', 'sub', 'br']);

function tidy(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Visible text of an HTML fragment, with the numeric entities `htmlToText` leaves (`&#x27;`) decoded too. */
function plain(html: string): string {
  return tidy(htmlToText(html)).replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code: string) =>
    String.fromCodePoint(code[0]!.toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code)),
  );
}

/** `[www.example.com](https://www.example.com)` left inside link text → `www.example.com`. */
function unwrapMarkdownLinks(text: string): string {
  return text.replace(/\[([^\]]+)\]\((?:https?:\/\/|mailto:)[^)\s]+\)/g, '$1');
}

/** Keeps the listed tags without attributes; everything else is dropped, its text kept. */
function sanitizeTags(html: string, allowed: Set<string>): string {
  return html.replace(/<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (_, close: string, name: string) => {
    const tag = name.toLowerCase();
    if (!allowed.has(tag)) return '';
    if (tag === 'br') return '<br>';
    return `<${close}${tag}>`;
  });
}

/** A Chicago entry as safe HTML: italics, bold and plain `http(s)` links only. */
export function sanitizeCitationHtml(html: string): string {
  const cleaned = unwrapMarkdownLinks(html).replace(/<a\b[^>]*>/gi, (tag) => {
    const href = /\bhref\s*=\s*"([^"]*)"/i.exec(tag)?.[1] ?? /\bhref\s*=\s*'([^']*)'/i.exec(tag)?.[1];
    return href && /^https?:\/\//i.test(href.trim()) ? `<a href="${href.trim().replace(/"/g, '&quot;')}">` : '<a>';
  });
  return cleaned
    .replace(/<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (whole, close: string, name: string, rest: string) => {
      const tag = name.toLowerCase();
      if (tag === 'a') return close ? '</a>' : whole;
      if (!INLINE_TAGS.has(tag)) return '';
      void rest;
      return `<${close}${tag}>`;
    })
    .replace(/<a>([\s\S]*?)<\/a>/g, '$1')
    .trim();
}

/** The quoted card text as safe HTML: paragraphs, underlining, highlights and italics. */
export function sanitizeQuoteHtml(html: string): string {
  return sanitizeTags(html, QUOTE_TAGS)
    .replace(/<p>\s*<\/p>/g, '')
    .trim();
}

interface CardParts {
  summary: string;
  qualification: string;
  quoteHtml: string;
}

const BLOCK = /<p\b[^>]*>[\s\S]*?<\/p>|<hr\b[^>]*>/gi;
const QUALIFICATION_BLOCK = /^<p\b[^>]*>\s*<em>([\s\S]*?)<\/em>\s*<\/p>$/i;

/**
 * Splits a card (`summary`, optional qualification, `<hr>`, quote) the way
 * `parseReferenceCard` does for the side panel, without needing a DOM.
 */
export function splitCard(cardHtml: string): CardParts {
  const blocks = cardHtml.match(BLOCK) ?? [];
  if (blocks.length === 0) return { summary: '', qualification: '', quoteHtml: '' };
  const rule = blocks.findIndex((block) => /^<hr/i.test(block));
  const isQualification = (block: string | undefined) => !!block && QUALIFICATION_BLOCK.test(block);
  let head: string[];
  let quote: string[];
  if (rule >= 0) {
    head = blocks.slice(0, rule);
    quote = blocks.slice(rule + 1);
  } else {
    head = [blocks[0]!, ...(isQualification(blocks[1]) ? [blocks[1]!] : [])];
    quote = blocks.slice(head.length);
  }
  const qualificationBlock = head.find(isQualification);
  const summaryBlock = head.find((block) => block !== qualificationBlock);
  const text = (block: string | undefined) => plain(block ?? '');
  return {
    summary: text(summaryBlock),
    qualification: text(qualificationBlock),
    quoteHtml: sanitizeQuoteHtml(quote.join('')),
  };
}

/** Plain text of quote HTML, paragraphs separated by a blank line. */
function quotePlainText(quoteHtml: string): string {
  return quoteHtml
    .split(/<\/p>/i)
    .map((chunk) => plain(chunk.replace(/<br\s*\/?>/gi, ' ')))
    .filter(Boolean)
    .join('\n\n');
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

const NAME_WORDS = String.raw`(?:\p{Lu}[\p{L}.'’-]*\s+){0,4}\p{Lu}[\p{L}.'’-]*`;
const ATTRIBUTED = new RegExp(String.raw`^(?:edited by\s+)?(${NAME_WORDS})\s+[—–-]\s+(.+)$`, 'u');

function upperFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function cleanCoAuthorLead(text: string): string {
  return upperFirst(text.replace(/^co-?authors?\b,?\s*/i, '').trim());
}

/**
 * Splits a card's qualification line between its authors.
 *
 * A card written `Roland Bleiker — Professor …; Amy Kay — co-author, University
 * of Queensland` gives each person their own clause; one without names (`Professor of
 * Law, Ohio State`) is shared by every credited author, minus the author's own
 * name when it leads (`Ryan Galloway is a coach` → `Coach`). In a card that
 * names some authors, one it does not name gets nothing.
 */
export function attributeQualifications(qualification: string, people: PersonName[], institution = ''): string[] {
  const count = Math.max(people.length, institution ? 1 : 0);
  if (!qualification) return Array<string>(count).fill('');
  const clauses = qualification.split(/;\s+/).map(tidy).filter(Boolean);
  const attributed = clauses
    .map((clause) => ATTRIBUTED.exec(clause))
    .filter((match): match is RegExpExecArray => !!match)
    .map((match) => ({ name: searchKey(match[1]!), text: match[2]! }));
  if (attributed.length > 0 && people.length > 0) {
    return people.map((person) => {
      const family = searchKey(person.family);
      const first = searchKey(person.given).split(' ')[0] ?? '';
      const sameFamily = people.filter((other) => searchKey(other.family) === family).length;
      const hit = attributed.find((clause) => {
        const words = ` ${clause.name} `;
        if (!words.includes(` ${family.split(' ').pop()} `) && !clause.name.endsWith(family)) return false;
        return sameFamily < 2 || !first || words.includes(` ${first} `) || (first.length === 1 && words.includes(` ${first}`));
      });
      return hit ? cleanCoAuthorLead(hit.text) : '';
    });
  }
  const lead = new RegExp(String.raw`^(${NAME_WORDS}),\s+(.+)$`, 'u').exec(qualification);
  if (lead && people.length > 1) {
    const leadWords = searchKey(lead[1]!).split(' ');
    const named = people.map((person) => leadWords.includes(searchKey(person.family).split(' ').pop()!));
    if (named.some(Boolean) && !named.every(Boolean)) return named.map((isNamed) => (isNamed ? upperFirst(lead[2]!) : ''));
  }
  const authors = people.length > 0 ? people.map((person) => person.family).join(' & ') : institution;
  const shared = stripAuthorFromQualification(qualification, authors);
  return Array<string>(count).fill(shared);
}

function yearNumber(year: string): number | null {
  const years = year.match(/\d{4}/g);
  return years ? Number(years[years.length - 1]) : null;
}

function firstUrl(citationHtml: string, parsedUrl: string | undefined): string {
  if (parsedUrl) return unwrapMarkdownLinks(parsedUrl).replace(/^\[([^\]]+)\]\(.*\)$/, '$1');
  const href = /href="(https?:\/\/[^"]+)"/i.exec(citationHtml)?.[1];
  return href ?? '';
}

interface ExtractedEntry {
  entry: ReferenceEntry;
  collection: CollectionSource;
  parsed: ParsedAuthorPart | undefined;
  card: CardParts;
  citedIn: CitedInPage[];
}

/** An initial or `Jr.`/`Sr.` at the end of a byline lost its period to the sentence the byline ends. */
function restoreFinalPeriod(part: string): string {
  return /(?:^|[\s,])(?:\p{Lu}|Jr|Sr)$/u.test(part) ? `${part}.` : part;
}

function authorPartOf(entry: ReferenceEntry): string | undefined {
  const authorDate = toAuthorDate(entry.citationHtml);
  if (!authorDate) return undefined;
  const part = BYLINE.exec(plain(authorDate))?.[1];
  return part && restoreFinalPeriod(part);
}

/** A byline in an entry that has no title and year in the usual place: `Thomas, Clarence. Concurring opinion in …`. */
const PERSON_LEAD = /^(\p{Lu}[\p{L}'’ -]+,\s+[\p{L}.'’ -]+?)\.\s+\p{Lu}/u;

function leadingPersonPart(entry: ReferenceEntry): string | undefined {
  if (/^\s*<em>/.test(entry.citationHtml)) return undefined;
  const part = PERSON_LEAD.exec(plain(entry.citationHtml))?.[1];
  return part && !/\sv\.\s/.test(part) ? restoreFinalPeriod(part) : undefined;
}

function citedInPages(collection: CollectionSource, entries: ReferenceEntry[]): Map<string, CitedInPage[]> {
  const index = buildCitationIndex(entries);
  const byEntry = new Map<string, CitedInPage[]>();
  for (const page of collection.pages) {
    const body = page.source.replace(/^---[\s\S]*?\n---\s*\n/, '');
    const seen = new Set<string>();
    for (const match of findCitations(body, index)) {
      if (seen.has(match.entry.id)) continue;
      seen.add(match.entry.id);
      const list = byEntry.get(match.entry.id) ?? [];
      list.push({ path: page.path, title: page.title });
      byEntry.set(match.entry.id, list);
    }
  }
  return byEntry;
}

interface AuthorAccumulator {
  key: string;
  kind: 'person' | 'institution';
  person?: PersonName;
  institution?: string;
  variants: Set<string>;
  qualifications: string[];
  citations: Set<string>;
}

/** Identity of an organization: its name without case, accents or punctuation. */
function institutionKey(name: string): string {
  return `i:${searchKey(name).replace(/ /g, '')}`;
}

/**
 * Reads the References pages of every collection into the dataset.
 *
 * @param collections - Each folder's sources, in the order the citations should be listed.
 */
export function extractAuthorsDataset(collections: CollectionSource[]): AuthorsDataset {
  const warnings: AuthorsDatasetWarning[] = [];
  const extracted: ExtractedEntry[] = [];

  for (const collection of collections) {
    const entries = parseReferences(collection.referencesSource);
    const citedIn = citedInPages(collection, entries);
    for (const entry of entries) {
      const isCourt = classifySource(entry.citationHtml) === 'court';
      const part = (isCourt ? undefined : authorPartOf(entry)) ?? leadingPersonPart(entry);
      const parsed = part ? parseAuthorPart(part, entry.citationHtml) : undefined;
      extracted.push({ entry, collection, parsed, card: splitCard(entry.cardHtml), citedIn: citedIn.get(entry.id) ?? [] });
      if (!parsed || (parsed.kind === 'person' && parsed.people.length === 0)) {
        if (!isCourt) {
          warnings.push({
            kind: 'no-author',
            message: `${collection.dir} #${entry.number} ${entry.id}: no author could be read from "${plain(entry.citationHtml).slice(0, 80)}"`,
          });
        }
      }
    }
  }

  // Spellings of people, grouped by family name so the merge compares only plausible matches.
  const spellingsByFamily = new Map<string, Map<string, { person: PersonName; count: number }>>();
  for (const { parsed } of extracted) {
    if (parsed?.kind !== 'person') continue;
    for (const person of parsed.people) {
      const family = searchKey(person.family).replace(/ /g, '');
      const group = spellingsByFamily.get(family) ?? new Map();
      const spelling = displayName(person);
      const seen = group.get(spelling);
      group.set(spelling, { person, count: (seen?.count ?? 0) + 1 });
      spellingsByFamily.set(family, group);
    }
  }

  const personKeyBySpelling = new Map<string, string>();
  const accumulators = new Map<string, AuthorAccumulator>();
  let mergedVariants = 0;
  for (const [family, group] of [...spellingsByFamily].sort(([a], [b]) => a.localeCompare(b))) {
    const spellings = [...group.values()];
    const { people, ambiguous } = mergeNameVariants(
      spellings.map((entry) => entry.person),
      spellings.map((entry) => entry.count),
    );
    for (const index of ambiguous) {
      warnings.push({
        kind: 'ambiguous-name',
        message: `"${displayName(spellings[index]!.person)}" could be more than one ${spellings[index]!.person.family}; kept separate`,
      });
    }
    people.forEach((merged, number) => {
      const key = `p:${family}:${number}`;
      const accumulator: AuthorAccumulator = {
        key,
        kind: 'person',
        person: merged.canonical,
        variants: new Set(merged.variants),
        qualifications: [],
        citations: new Set(),
      };
      accumulators.set(key, accumulator);
      mergedVariants += merged.members.length - 1;
      for (const member of merged.members) personKeyBySpelling.set(`${family}|${displayName(spellings[member]!.person)}`, key);
    });
  }

  const citations: CitationRecord[] = [];
  for (const { entry, collection, parsed, card, citedIn } of extracted) {
    const links: CitationAuthorLink[] = [];
    const id = `${collection.dir}#${entry.id}`;
    const authorIds: { key: string; role: AuthorRole; qualification: string }[] = [];

    if (parsed?.kind === 'person' && parsed.people.length > 0) {
      const qualifications = attributeQualifications(card.qualification, parsed.people);
      parsed.people.forEach((person, position) => {
        const key = personKeyBySpelling.get(`${searchKey(person.family).replace(/ /g, '')}|${displayName(person)}`)!;
        authorIds.push({ key, role: parsed.role, qualification: qualifications[position] ?? '' });
        if (position === 0 && parsed.alias) accumulators.get(key)!.variants.add(parsed.alias);
      });
    } else if (parsed?.kind === 'institution' && parsed.institution) {
      const key = institutionKey(parsed.institution);
      const accumulator = accumulators.get(key) ?? {
        key,
        kind: 'institution' as const,
        institution: parsed.institution,
        variants: new Set([parsed.institution]),
        qualifications: [],
        citations: new Set<string>(),
      };
      accumulators.set(key, accumulator);
      authorIds.push({ key, role: parsed.role, qualification: attributeQualifications(card.qualification, [], parsed.institution)[0] ?? '' });
    }

    const seenKeys = new Set<string>();
    authorIds.forEach(({ key, role, qualification }, position) => {
      if (seenKeys.has(key)) return;
      seenKeys.add(key);
      const accumulator = accumulators.get(key)!;
      accumulator.citations.add(id);
      if (qualification) accumulator.qualifications.push(qualification);
      links.push({ authorId: key, position, role, qualification });
    });

    const chicago = sanitizeCitationHtml(entry.citationHtml);
    const chicagoText = plain(chicago);
    const chicagoEntry = parseChicagoEntry(entry.citationHtml);
    const container = chicagoEntry
      ? plain(chicagoEntry.tail.journal?.name ?? chicagoEntry.tail.periodical?.name ?? chicagoEntry.tail.chapter?.book ?? '')
      : '';
    const quotedTitle = /“([^”]+)”/.exec(chicagoText)?.[1];
    const title = plain(chicagoEntry?.title ?? '') || quotedTitle || '';
    const quoteText = quotePlainText(card.quoteHtml);
    if (!entry.year && parsed) {
      warnings.push({ kind: 'no-year', message: `${collection.dir} #${entry.number} ${entry.id}: no year` });
    }

    citations.push({
      id,
      collection: collection.dir,
      collectionTitle: collection.title,
      pagePath: `${DOCS_PATH}/${collection.dir}/references`,
      anchor: entry.id,
      entryNumber: entry.number,
      chicago,
      chicagoText,
      year: entry.year,
      yearNumber: yearNumber(entry.year),
      title,
      container: tidy(container),
      sourceKind: classifySource(entry.citationHtml, card.summary),
      url: firstUrl(entry.citationHtml, chicagoEntry?.url),
      summary: card.summary,
      qualification: card.qualification,
      quoteHtml: card.quoteHtml,
      quoteText,
      quoteWordCount: countWords(quoteText),
      quoteStatus: card.quoteHtml ? referenceQuoteStatus(`<hr />${card.quoteHtml}`) : 'missing',
      etAl: !!parsed?.etAl,
      citedIn,
      authors: links.map((link) => ({ ...link })),
    });
  }

  const citationsById = new Map(citations.map((citation) => [citation.id, citation]));
  const draft = [...accumulators.values()].map((accumulator) => {
    const person = accumulator.person;
    const name = person ? displayName(person) : accumulator.institution!;
    return { accumulator, name, sort: person ? sortName(person) : name };
  });
  draft.sort((a, b) => searchKey(a.sort).localeCompare(searchKey(b.sort)) || a.name.localeCompare(b.name));

  const takenSlugs = new Set<string>();
  const idByKey = new Map<string, string>();
  const authors: AuthorRecord[] = draft.map(({ accumulator, name, sort }) => {
    const base = slugify(name) || 'author';
    let slug = base;
    for (let n = 2; takenSlugs.has(slug); n++) slug = `${base}-${n}`;
    takenSlugs.add(slug);
    const id = `author:${slug}`;
    idByKey.set(accumulator.key, id);

    const cited = [...accumulator.citations].map((citationId) => citationsById.get(citationId)!);
    const years = cited.map((citation) => citation.yearNumber).filter((year): year is number => year !== null);
    const variants = [...accumulator.variants].filter((variant) => variant !== name).sort();
    return {
      id,
      slug,
      name,
      sortName: sort,
      normalizedName: searchKey(name),
      kind: accumulator.kind,
      qualifications: mostCommon(accumulator.qualifications),
      aliases: variants,
      cardCount: cited.length,
      quoteCount: cited.filter((citation) => citation.quoteHtml).length,
      firstYear: years.length ? Math.min(...years) : null,
      lastYear: years.length ? Math.max(...years) : null,
    };
  });

  for (const citation of citations) {
    for (const link of citation.authors) link.authorId = idByKey.get(link.authorId)!;
  }

  const persons = authors.filter((author) => author.kind === 'person').length;
  return {
    version: 1,
    collections: collections.map((collection) => collection.dir),
    stats: {
      authors: authors.length,
      persons,
      institutions: authors.length - persons,
      citations: citations.length,
      unauthoredCitations: citations.filter((citation) => citation.authors.length === 0).length,
      citationsWithQuotes: citations.filter((citation) => citation.quoteHtml).length,
      etAlCitations: citations.filter((citation) => citation.etAl).length,
      mergedVariants,
    },
    warnings,
    authors,
    citations,
  };
}

/** The most frequent string; ties go to the longer, then the alphabetically first. */
function mostCommon(values: string[]): string {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return (
    [...counts].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0]))[0]?.[0] ?? ''
  );
}
