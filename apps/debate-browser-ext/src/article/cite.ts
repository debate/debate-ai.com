/**
 * Who wrote the page, when, and where it was published — and the citation line
 * the panel puts above the article.
 *
 * The meta-tag lists are the ones qwksearch-research-agent's `extract-webpage`
 * reads (`src/html-to-cite/metadata-to-cite.ts`), which is what keeps a page
 * cited the same way here as it is in the app this panel came from. JSON-LD is
 * read first because a publisher that ships both is more reliable there — the
 * `<meta>` block is frequently the site's, while the JSON-LD block is the
 * article's.
 */

interface MetaLists {
  source: string[];
  title: string[];
  author: string[];
  date: string[];
}

const META_TAGS: MetaLists = {
  source: ['application-name', 'og:site_name', 'twitter:site', 'dc.title'],
  title: ['title', 'og:title', 'twitter:title', 'parsely-title'],
  author: [
    'author',
    'creator',
    'og:creator',
    'article:author',
    'dc.creator',
    'parsely-author',
  ],
  date: [
    'article:published_time',
    'article:modified_time',
    'og:updated_time',
    'dc.date',
    'dc.date.issued',
    'dc.date.created',
    'dc:created',
    'dcterms.date',
    'datepublished',
    'datemodified',
    'updated_time',
    'modified_time',
    'published_time',
    'release_date',
    'date',
    'parsely-pub-date',
    'article:published',
    'og:pubdate',
    'pubdate',
    'datecreated',
    'pdate',
    'sailthru.date',
    'dcterms.created',
  ],
};

export interface CiteMetadata {
  title?: string;
  author?: string;
  date?: string;
  source?: string;
}

/** The `<meta>` values the lists above name, lower-cased keys, first one wins. */
function fromMetaTags(doc: Document): CiteMetadata {
  const result: CiteMetadata = {};
  doc.querySelectorAll('meta').forEach((meta) => {
    const content = meta.getAttribute('content')?.trim();
    if (!content) return;
    const keys = [
      meta.getAttribute('property'),
      meta.getAttribute('itemprop'),
      meta.getAttribute('name'),
    ]
      .filter((key): key is string => Boolean(key))
      .map((key) => key.toLowerCase());

    (Object.keys(META_TAGS) as Array<keyof MetaLists>).forEach((field) => {
      if (result[field]) return;
      if (keys.some((key) => META_TAGS[field].includes(key))) result[field] = content;
    });
  });
  return result;
}

/** A schema.org name, which may be a string, an object, or a list of either. */
function nameOf(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (Array.isArray(value)) {
    const names = value.map(nameOf).filter(Boolean);
    return names.length > 0 ? names.join(', ') : undefined;
  }
  if (value && typeof value === 'object') {
    const name = (value as { name?: unknown }).name;
    return typeof name === 'string' ? name.trim() || undefined : undefined;
  }
  return undefined;
}

/** The publisher's own `Article` JSON-LD, when the page ships one. */
function fromJsonLd(doc: Document): CiteMetadata {
  const result: CiteMetadata = {};
  const blocks = doc.querySelectorAll('script[type="application/ld+json"]');

  const visit = (node: unknown, depth = 0) => {
    if (depth > 4 || !node) return;
    if (Array.isArray(node)) {
      node.forEach((entry) => visit(entry, depth + 1));
      return;
    }
    if (typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    if (Array.isArray(obj['@graph'])) visit(obj['@graph'], depth + 1);

    const type = String(obj['@type'] ?? '');
    if (!/Article|BlogPosting|NewsArticle|Report|WebPage/i.test(type)) return;

    result.title ??= nameOf(obj.headline) ?? nameOf(obj.name);
    result.author ??= nameOf(obj.author);
    result.source ??= nameOf(obj.publisher);
    const date = obj.datePublished ?? obj.dateCreated ?? obj.dateModified;
    if (!result.date && typeof date === 'string') result.date = date.trim();
  };

  blocks.forEach((block) => {
    try {
      visit(JSON.parse(block.textContent || ''));
    } catch {
      // A malformed JSON-LD block is common and is not worth failing over.
    }
  });
  return result;
}

/** An ISO timestamp or ISO date, which is what publishers put in meta tags. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T\s]|$)/;

/** A written-out date that names a specific day, e.g. "March 2, 2024". */
const DAY_AND_YEAR = /\b\d{1,2}\b/;
const FOUR_DIGIT_YEAR = /\b\d{4}\b/;

/**
 * A date rendered for a citation, or the raw value when the page's date names
 * no particular day.
 *
 * The guard matters more than it looks. `new Date()` is lenient enough to turn
 * "Spring 2024" into 1 January 2024 without complaint, and a citation that
 * invents a precise date the page never claimed is worse than one that repeats
 * the vague phrase the page did. So a value is only formatted when it is an
 * ISO date, or names both a day and a year; anything else is passed through as
 * written.
 */
export function formatCiteDate(raw?: string): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;

  const namesADay =
    ISO_DATE.test(trimmed) || (DAY_AND_YEAR.test(trimmed) && FOUR_DIGIT_YEAR.test(trimmed));
  if (!namesADay) return trimmed;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** The site an article is on, from its URL, with a leading `www.` dropped. */
export function sourceFromUrl(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

/**
 * Everything worth citing about a page: JSON-LD first, then `<meta>`, then the
 * document's own title and URL as the last resort — so a page with no metadata
 * at all still gets a usable line rather than an empty one.
 */
export function extractCiteMetadata(doc: Document, url: string): CiteMetadata {
  const jsonLd = fromJsonLd(doc);
  const meta = fromMetaTags(doc);
  return {
    title: jsonLd.title || meta.title || doc.title?.trim() || undefined,
    author: jsonLd.author || meta.author || undefined,
    date: jsonLd.date || meta.date || undefined,
    source: jsonLd.source || meta.source || sourceFromUrl(url),
  };
}

/** The citation line itself: `Author, "Title," Source, Date`, minus whatever is missing. */
export function buildCite(metadata: CiteMetadata): string {
  const parts: string[] = [];
  if (metadata.author) parts.push(metadata.author);
  if (metadata.title) parts.push(`"${metadata.title}"`);
  if (metadata.source && metadata.source !== metadata.author) parts.push(metadata.source);
  const date = formatCiteDate(metadata.date);
  if (date) parts.push(date);
  return parts.join(', ');
}
