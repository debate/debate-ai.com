/**
 * @file rehype-citation-cards.ts
 * @description Fumadocs MDX extension that links author-date citations to a
 * References page and shows the cited card on hover.
 *
 * For every page in a configured folder, each in-text citation that matches an
 * entry of that folder's References page (`citation-cards.ts` does the
 * matching) becomes a `<CitationCard>` — a link to the entry's anchor that
 * opens a tooltip with the entry's number, bibliography line, author
 * qualifications and full card text (`components/guides/citation-card.tsx`).
 * Citations with no entry stay plain text. On the References page itself,
 * each list item gets the `id` those links point at.
 *
 * Runs as a rehype plugin, after Fumadocs has taken each page's processed
 * Markdown, so the "Copy Markdown" / llms.txt exports keep the citations as
 * plain text. Text inside links, code and headings is left alone.
 *
 * Reusable: register it with one `CitationCollection` per folder that has its
 * own References page. `SYNERGY_SLAYER_CITATIONS` is the one in use.
 */
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { DOCS_BASE_PATH } from '../fumadocs/base-path';
import {
  buildCitationIndex,
  findCitations,
  parseReferences,
  type CitationIndex,
  type ReferenceEntry,
} from './citation-cards';
import { SYNERGY_SLAYER_DIR } from './remark-debate-highlight';

/** A docs folder whose pages cite the entries of one References page. */
export interface CitationCollection {
  /** Content-relative folder, with a trailing slash. */
  dir: string;
  /** The References page's file name inside `dir`. */
  references: string;
}

export const SYNERGY_SLAYER_CITATIONS: CitationCollection = {
  dir: SYNERGY_SLAYER_DIR,
  references: 'references.mdx',
};

/** The MDX component each matched citation renders as. */
export const CITATION_COMPONENT = 'CitationCard';

/** The minimal hast / MDX-JSX shape this plugin touches. */
interface HastNode {
  type: string;
  tagName?: string;
  name?: string | null;
  value?: string;
  properties?: Record<string, unknown>;
  attributes?: { type: string; name: string; value: string }[];
  children?: HastNode[];
}

const SKIP_TAGS = new Set(['a', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'script', 'style']);

interface LoadedReferences {
  mtimeMs: number;
  entries: ReferenceEntry[];
  index: CitationIndex;
}

/** Parsed References pages, re-read when the file changes (dev server). */
const cache = new Map<string, LoadedReferences>();

function loadReferences(file: string): LoadedReferences | undefined {
  let mtimeMs: number;
  try {
    mtimeMs = statSync(file).mtimeMs;
  } catch {
    return undefined;
  }
  const cached = cache.get(file);
  if (cached?.mtimeMs === mtimeMs) return cached;
  const entries = parseReferences(readFileSync(file, 'utf8'));
  const loaded = { mtimeMs, entries, index: buildCitationIndex(entries) };
  cache.set(file, loaded);
  return loaded;
}

/** The URL of a References page, from the content-relative folder. */
export function referencesUrl(collection: CitationCollection): string {
  const page = collection.references.replace(/\.mdx?$/, '').replace(/(^|\/)index$/, '');
  return `${DOCS_BASE_PATH}/${collection.dir}${page}`.replace(/\/+$/, '');
}

/** The `<CitationCard>` element for one matched citation. */
function citationElement(entry: ReferenceEntry, label: string, href: string): HastNode {
  const attribute = (name: string, value: string) => ({ type: 'mdxJsxAttribute', name, value });
  return {
    type: 'mdxJsxTextElement',
    name: CITATION_COMPONENT,
    attributes: [
      attribute('href', `${href}#${entry.id}`),
      attribute('number', String(entry.number)),
      attribute('citation', entry.citationHtml),
      attribute('card', entry.cardHtml),
    ],
    children: [{ type: 'text', value: label }],
  };
}

/** Splits one text node around its citations. */
function linkText(node: HastNode, index: CitationIndex, href: string): HastNode[] | undefined {
  const text = node.value ?? '';
  const matches = findCitations(text, index);
  if (matches.length === 0) return undefined;
  const out: HastNode[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start < cursor) continue;
    if (match.start > cursor) out.push({ type: 'text', value: text.slice(cursor, match.start) });
    out.push(citationElement(match.entry, text.slice(match.start, match.end), href));
    cursor = match.end;
  }
  if (cursor < text.length) out.push({ type: 'text', value: text.slice(cursor) });
  return out;
}

function walkCitations(node: HastNode, index: CitationIndex, href: string): void {
  if (!node.children) return;
  if (node.type === 'element' && SKIP_TAGS.has(node.tagName ?? '')) return;
  if (node.name === CITATION_COMPONENT) return;
  const next: HastNode[] = [];
  for (const child of node.children) {
    const replaced = child.type === 'text' ? linkText(child, index, href) : undefined;
    if (replaced) next.push(...replaced);
    else {
      walkCitations(child, index, href);
      next.push(child);
    }
  }
  node.children = next;
}

/** The first ordered list of a page: the References list. */
function findOrderedList(node: HastNode): HastNode | undefined {
  if (node.type === 'element' && node.tagName === 'ol') return node;
  for (const child of node.children ?? []) {
    const found = findOrderedList(child);
    if (found) return found;
  }
  return undefined;
}

/** Puts each entry's anchor id on its list item of the References page. */
function addAnchors(tree: HastNode, entries: ReferenceEntry[]): void {
  const list = findOrderedList(tree);
  const items = (list?.children ?? []).filter((child) => child.type === 'element' && child.tagName === 'li');
  items.forEach((item, i) => {
    const entry = entries[i];
    if (entry) item.properties = { ...item.properties, id: entry.id };
  });
}

/** The collection a file belongs to, and the absolute path of its References page. */
function resolveCollection(
  filePath: string,
  collections: CitationCollection[],
): { collection: CitationCollection; referencesFile: string } | undefined {
  const normalized = filePath.replace(/\\/g, '/');
  for (const collection of collections) {
    const at = normalized.indexOf(`/${collection.dir}`);
    if (at < 0) continue;
    const root = normalized.slice(0, at + 1 + collection.dir.length);
    return { collection, referencesFile: path.join(root, collection.references) };
  }
  return undefined;
}

/**
 * Rehype plugin: author-date citations → `<CitationCard>` hover cards on the
 * pages of each collection, and anchor ids on each collection's References page.
 */
export function rehypeCitationCards(options: { collections?: CitationCollection[] } = {}) {
  const collections = options.collections ?? [SYNERGY_SLAYER_CITATIONS];
  return (tree: HastNode, file?: { path?: string; history?: string[] }) => {
    const filePath = file?.path ?? file?.history?.[0];
    if (!filePath) return;
    const resolved = resolveCollection(filePath, collections);
    if (!resolved) return;
    const loaded = loadReferences(resolved.referencesFile);
    if (!loaded) return;
    if (path.resolve(filePath) === path.resolve(resolved.referencesFile)) {
      addAnchors(tree, loaded.entries);
      return;
    }
    walkCitations(tree, loaded.index, referencesUrl(resolved.collection));
  };
}
