/**
 * Command-palette file search (the `f` prefix) — pure logic.
 *
 * Two layers, both on-demand (no persistent index yet; see
 * ARCHITECTURE.md §11 "corpus search"):
 *   1. File layer  — match `.cmir` filenames recursively found under
 *      the configured search root (the palette does the I/O).
 *   2. Object layer — once a file is picked, parse it and surface its
 *      structural objects (blocks / tags / cites / …) so the user can
 *      search WITHIN it and insert one. Each object carries the doc
 *      slice that gets inserted, mirroring quick cards / dropzone.
 *
 * Matching is the same order-independent multi-token substring AND
 * ranking the rest of the palette uses (see quick-cards-match.ts) —
 * "block search style", not edit-distance fuzz.
 */

import type { Node as PMNode } from 'prosemirror-model';
import { collectHeadings, computeHeadingRange } from './headings.js';

/** Structural object kinds that can appear in within-file results. */
export type FileObjectKind = 'pocket' | 'hat' | 'block' | 'tag' | 'cite' | 'analytic';

/** All kinds, in outline order — the order the settings checklist
 *  shows them and the order results group in. */
export const FILE_OBJECT_KINDS: FileObjectKind[] = [
  'pocket',
  'hat',
  'block',
  'tag',
  'cite',
  'analytic',
];

export const FILE_OBJECT_KIND_LABELS: Record<FileObjectKind, string> = {
  pocket: 'Pocket',
  hat: 'Hat',
  block: 'Block',
  tag: 'Tag',
  cite: 'Cite',
  analytic: 'Analytic',
};

/** Short badge text shown on a within-file result row. */
export const FILE_OBJECT_KIND_BADGES: Record<FileObjectKind, string> = {
  pocket: 'POC',
  hat: 'HAT',
  block: 'BLK',
  tag: 'TAG',
  cite: 'CITE',
  analytic: 'ANL',
};

/** A `.cmir` file discovered under the search root. */
export interface FileEntry {
  /** Absolute path (open target). */
  path: string;
  /** Path relative to the search root (for the dir hint). */
  relPath: string;
  /** Bare filename (the match + display target). */
  name: string;
  /** Last-modified time — the version key for the warm cache. */
  mtimeMs: number;
  /** `name` lowercased once at list-build time. Matching runs over the
   *  whole corpus on every keystroke; lowercasing there allocated two
   *  strings per file per keystroke. Build via `makeFileEntry`. */
  nameLower: string;
  /** Lowercased directory portion of `relPath` (the secondary match
   *  field), precomputed for the same reason. */
  dirLower: string;
}

/** Build a FileEntry from a listing row, deriving the display name and
 *  the precomputed lowercase match fields in one place. */
export function makeFileEntry(path: string, relPath: string, mtimeMs: number): FileEntry {
  const name = stripFileExt(baseName(relPath));
  return {
    path,
    relPath,
    name,
    mtimeMs,
    nameLower: name.toLowerCase(),
    dirLower: dirName(relPath).toLowerCase(),
  };
}

/** A structural object inside a parsed file — a search hit (flat). */
export interface FileObject {
  kind: FileObjectKind;
  /** Match + display text (heading text, or the cite string). */
  label: string;
  /** Secondary text — the owning tag for a cite, else ''. */
  detail: string;
  /** For a `tag` object, the cite text of its card (author/date), so a
   *  tag is findable by its citation — mirrors Ctrl-F, which can match
   *  a tag's card via the cite_paragraph. Used for matching AND shown
   *  as the row's secondary text. Undefined when the card has no cite. */
  cite?: string;
  /** Doc range to slice on insert. Sliced lazily from the kept parsed
   *  doc (the palette holds it for the dive), so a dive never eagerly
   *  builds or holds a slice for every object. */
  from: number;
  to: number;
}

/** One row of a file's outline (the nav-pane-style browse) — the full
 *  structural hierarchy, indented by `level`. Cites are not headings, so
 *  they never appear here; they only surface when you type a query. */
export interface OutlineEntry {
  /** 1 Pocket · 2 Hat · 3 Block · 4 Tag/Analytic. */
  level: number;
  kind: FileObjectKind;
  label: string;
  from: number;
  to: number;
}

/** True when `path` IS an excluded entry or lives under an excluded
 *  folder. Separator-aware prefixing: excluding `/a/b` covers
 *  `/a/b/x.cmir` but never `/a/bc/x.cmir` (both `/` and `\`). Exact
 *  string compare — exclusions and listings come from the same native
 *  pickers/scans, so their casing and shape agree. */
export function isPathExcluded(path: string, exclusions: readonly string[]): boolean {
  for (const raw of exclusions) {
    const ex = raw.replace(/[\\/]+$/, ''); // tolerate a trailing separator
    if (!ex) continue;
    if (path === ex) return true;
    if (
      path.length > ex.length &&
      path.startsWith(ex) &&
      (path[ex.length] === '/' || path[ex.length] === '\\')
    ) {
      return true;
    }
  }
  return false;
}

/** Drop excluded entries from a listing. The ONE choke point for the
 *  exclusion setting: it runs where listings become the palette's file
 *  list, so excluded files never reach results, ranking, or the warm
 *  pass (which only warms paths present in the list — an excluded pin
 *  goes dormant rather than being unpinned). */
export function filterExcludedFiles(
  files: readonly FileEntry[],
  exclusions: readonly string[],
): FileEntry[] {
  if (exclusions.length === 0) return [...files];
  return files.filter((f) => !isPathExcluded(f.path, exclusions));
}

/** Bare filename from a path/relPath (handles `/` and `\`). */
export function baseName(p: string): string {
  const m = p.split(/[\\/]/);
  return m[m.length - 1] ?? p;
}

/** Openable format of a listed file, by extension. The file scan yields
 *  only `.cmir` and `.docx`, so anything not `.docx` is treated as `cmir`. */
export function fileFormat(pathOrName: string): 'cmir' | 'docx' {
  return /\.docx$/i.test(pathOrName) ? 'docx' : 'cmir';
}

/** Display name for a listed file: the openable extension (.cmir/.docx)
 *  stripped, since the result row badges the format separately. Other dots
 *  in the name are left intact. */
export function stripFileExt(name: string): string {
  return name.replace(/\.(cmir|docx)$/i, '');
}

/** Directory portion of a relPath ('' for a top-level file). */
export function dirName(relPath: string): string {
  const i = Math.max(relPath.lastIndexOf('/'), relPath.lastIndexOf('\\'));
  return i < 0 ? '' : relPath.slice(0, i);
}

/** Does `tok` begin at a word boundary anywhere in `text` (both lowercased)?
 *  "war" is a word-start of "at: warming" but not of "software". */
function startsAtWordBoundary(text: string, tok: string): boolean {
  for (let i = text.indexOf(tok); i >= 0; i = text.indexOf(tok, i + 1)) {
    if (i === 0 || !/[a-z0-9]/.test(text[i - 1]!)) return true;
  }
  return false;
}

/** Lowercased whitespace-split query tokens — the palette's shared
 *  tokenization, exported (with `matchesAllTokens`) for filter-style
 *  surfaces like the live-view picker that share the matching but keep
 *  their own ordering. */
export function tokenizeQuery(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/** Order-independent multi-token AND-match: every token must land in the
 *  primary field or (when non-empty) the secondary field. Both fields
 *  must already be lowercase. This is the predicate `matchTier` builds
 *  its relevance tiers on. */
export function matchesAllTokens(p: string, s: string, tokens: readonly string[]): boolean {
  for (const tok of tokens) {
    if (!p.includes(tok) && !(s !== '' && s.includes(tok))) return false;
  }
  return true;
}

/** Relevance tier for a candidate, or null when it doesn't match every token.
 *  Lower is better. Tiers key off the PRIMARY field (a heading's label, a
 *  file's name); a match that only lands in the SECONDARY field (a card's cite,
 *  a file's folder) is the weakest tier, so a primary hit always outranks it.
 *    0 exact · 1 prefix · 2 word-start · 3 substring · 4 secondary-only
 *  `p` and `s` must already be lowercase — this runs per item per
 *  keystroke over the whole corpus, so callers precompute (files) or
 *  lower in their getter (in-file objects). Tokens contain no
 *  whitespace, so per-field `includes` is equivalent to the joined
 *  haystack it replaces (a token can never span the field boundary). */
function matchTier(
  p: string,
  s: string,
  tokens: readonly string[],
  q: string,
  t0: string,
): number | null {
  if (!matchesAllTokens(p, s, tokens)) return null;
  if (p === q) return 0;
  if (p.startsWith(q)) return 1;
  if (tokens.every((tok) => p.includes(tok))) return startsAtWordBoundary(p, t0) ? 2 : 3;
  return 4;
}

/** Order-independent multi-token AND-match, ranked by relevance tier
 *  (exact → prefix → word-start → substring → secondary-only), ties broken by
 *  `tiebreak`. A stable no-op tiebreak (`() => 0`) preserves input order. An
 *  empty query returns everything, ordered only by the tiebreak.
 *  `primary`/`secondary` getters must return LOWERCASE text (see
 *  `matchTier`). */
function rank<T>(
  items: readonly T[],
  query: string,
  primary: (t: T) => string,
  secondary: (t: T) => string,
  tiebreak: (a: T, b: T) => number,
): T[] {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return [...items].sort(tiebreak);
  const q = tokens.join(' ');
  const t0 = tokens[0]!;
  const matched: Array<{ item: T; tier: number }> = [];
  for (const item of items) {
    const tier = matchTier(primary(item), secondary(item), tokens, q, t0);
    if (tier !== null) matched.push({ item, tier });
  }
  return matched
    .sort((a, b) => a.tier - b.tier || tiebreak(a.item, b.item))
    .map((r) => r.item);
}

/** Same-tier ordering for the file search (the setting the user picks). */
export type FileTiebreak = 'recency' | 'alphabetical';

export function searchFiles(
  files: readonly FileEntry[],
  query: string,
  tiebreak: FileTiebreak = 'recency',
): FileEntry[] {
  // Match the bare name first; the folder (from relPath) is the secondary
  // field, so "neg warming" finds Neg/Warming DA — ranked below a name hit.
  const cmp: (a: FileEntry, b: FileEntry) => number =
    tiebreak === 'alphabetical'
      ? (a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      : (a, b) => b.mtimeMs - a.mtimeMs; // recency: most-recently-modified first
  return rank(
    files,
    query,
    (f) => f.nameLower,
    (f) => f.dirLower,
    cmp,
  );
}

export function searchFileObjects(objects: readonly FileObject[], query: string): FileObject[] {
  // Match a tag by its label OR its card's cite text (author/date); the cite is
  // the secondary field, so a label hit outranks a cite-only hit. Same-tier
  // ties stay in document order (stable no-op tiebreak).
  return rank(
    objects,
    query,
    (o) => o.label.toLowerCase(),
    (o) => o.cite?.toLowerCase() ?? '',
    () => 0,
  );
}

/**
 * Walk a parsed `.cmir` doc once and produce both:
 *   - `objects`: the flat, searchable hits of the enabled kinds (+ cites)
 *   - `outline`: the full structural hierarchy for the nav-pane-style
 *     browse, every heading with its level (cites excluded — not headings)
 *
 * Each carries a doc range, not a materialized slice: the caller keeps
 * the parsed doc and slices on insert, so a dive doesn't build a slice
 * for every heading up front. Insertion granularity is whatever
 * `computeHeadingRange` returns:
 *   - tag / cite           → the enclosing card (tag + body)
 *   - block / hat / pocket  → the heading + everything under it
 *   - analytic              → the analytic unit / card
 *
 * Cites aren't a heading type: each tag entry carries the cite text of
 * its card, so a `cite` object piggybacks on the tag entry (same range).
 */
export function extractFile(
  doc: PMNode,
  enabled: ReadonlySet<FileObjectKind>,
): { objects: FileObject[]; outline: OutlineEntry[] } {
  const needCite = enabled.has('cite');
  // Always collect cite text: a tag is searchable by its cite even when
  // the standalone `cite` object kind is off (that only gates the
  // separate CITE rows below).
  const entries = collectHeadings(doc);
  const objects: FileObject[] = [];
  const outline: OutlineEntry[] = [];
  for (const entry of entries) {
    const kind = entry.type as FileObjectKind; // pocket/hat/block/tag/analytic
    const range = computeHeadingRange(doc, entry);
    if (!range) continue;
    const { from, to } = range;
    const label = entry.text.trim();
    // Outline: the full structure, independent of the enabled set.
    outline.push({ level: entry.level, kind, label, from, to });
    // Search hits: enabled kinds (with a label), plus cites.
    if (enabled.has(kind) && label !== '') {
      const obj: FileObject = { kind, label, detail: '', from, to };
      // Carry the card's cite on the tag so it's findable by citation.
      if (kind === 'tag' && entry.cite) obj.cite = entry.cite;
      objects.push(obj);
    }
    if (needCite && entry.type === 'tag' && entry.cite) {
      objects.push({ kind: 'cite', label: entry.cite.trim(), detail: label, from, to });
    }
  }
  return { objects, outline };
}
