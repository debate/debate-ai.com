/**
 * Folder browsing derived from the file index — the pure, separator-
 * agnostic half shared by the index service (`file-index-core.ts`, native
 * `path.sep`) and the palette test fake (`/`). Nothing here touches the
 * filesystem: a "folder" exists only while an indexed file sits beneath it,
 * so the browser can never show more than the file search already can.
 *
 * Two views over one directory:
 *   - empty query → the navigation view: this directory's immediate
 *     subfolders (A→Z), then its direct files ranked by the tiebreak;
 *   - a query → search-this-folder: subfolders whose NAME matches every
 *     token, then every file beneath the directory (any depth) ranked by
 *     the shared file matcher, each carrying the sub-path it lives in.
 * Pinned files float above the rest in both views, as `f`-mode does.
 */

import {
  matchesAllTokens,
  searchFiles,
  tokenizeQuery,
  type FileEntry,
  type FileTiebreak,
} from './file-search.js';
import type { FileBrowseResult, FileBrowseRow } from './file-index-protocol.js';

/** Validate + normalize a directory relative to a root: '' is the root
 *  itself; `..` segments, absolute paths and drive letters are rejected
 *  (null). Separators are unified to `sep`; empty and `.` segments drop. */
export function normalizeRelativeDirectory(rel: string, sep: string): string | null {
  if (/^[\\/]/.test(rel) || /^[a-zA-Z]:/.test(rel)) return null;
  const parts = rel.split(/[\\/]/).filter((p) => p !== '' && p !== '.');
  if (parts.includes('..')) return null;
  return parts.join(sep);
}

/** `relPath` split into segments below `relDir`, or null when the file is
 *  not beneath it. `relDir` must already be normalized (see above). */
function segmentsBelow(relPath: string, relDir: string, sep: string): string[] | null {
  if (relDir === '') return relPath.split(sep).filter(Boolean);
  const prefix = relDir + sep;
  if (!relPath.startsWith(prefix)) return null;
  return relPath.slice(prefix.length).split(sep).filter(Boolean);
}

export interface BrowseInput {
  /** Visible entries of the ONE root being browsed (already exclusion- and
   *  format-filtered by the caller). */
  entries: readonly FileEntry[];
  /** Normalized directory relative to that root ('' = the root). */
  relDir: string;
  query: string;
  sep: string;
  tiebreak: FileTiebreak;
  pins: readonly string[];
  limit: number;
}

export function deriveBrowse(input: BrowseInput): FileBrowseResult {
  const { entries, relDir, sep, tiebreak, limit } = input;
  const tokens = tokenizeQuery(input.query);
  const pins = new Set(input.pins);

  const folders = new Map<string, { name: string; relativeDirectory: string }>();
  const candidates: Array<{ entry: FileEntry; subPath: string }> = [];
  let anyBelow = false;
  for (const entry of entries) {
    const parts = segmentsBelow(entry.relPath, relDir, sep);
    if (!parts || parts.length === 0) continue;
    anyBelow = true;
    if (parts.length === 1) {
      candidates.push({ entry, subPath: '' });
      continue;
    }
    const name = parts[0]!;
    if (!folders.has(name)) {
      folders.set(name, { name, relativeDirectory: relDir ? relDir + sep + name : name });
    }
    // Only the search view reaches past the immediate children.
    if (tokens.length > 0) candidates.push({ entry, subPath: parts.slice(0, -1).join(sep) });
  }
  // A directory is real only while the index holds a file beneath it — the
  // palette walks upward when a branch has vanished.
  if (relDir !== '' && !anyBelow) return { rows: [], total: 0, valid: false };

  const folderRows: FileBrowseRow[] = [...folders.values()]
    .filter((f) => tokens.length === 0 || matchesAllTokens(f.name.toLowerCase(), '', tokens))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    .map((f) => ({ kind: 'folder' as const, name: f.name, relativeDirectory: f.relativeDirectory }));

  const subPathOf = new Map(candidates.map((c) => [c.entry.path, c.subPath]));
  const ranked = searchFiles(candidates.map((c) => c.entry), input.query, tiebreak);
  const ordered = pins.size === 0
    ? ranked
    : [...ranked.filter((f) => pins.has(f.path)), ...ranked.filter((f) => !pins.has(f.path))];
  const fileRows: FileBrowseRow[] = ordered.map((f) => ({
    kind: 'file' as const,
    path: f.path,
    relPath: f.relPath,
    name: f.name,
    mtimeMs: f.mtimeMs,
    pinned: pins.has(f.path),
    subPath: subPathOf.get(f.path) ?? '',
  }));

  const rows = [...folderRows, ...fileRows];
  return { rows: rows.slice(0, Math.max(0, limit)), total: rows.length, valid: true };
}

/** Deepest of `roots` containing `filePath`, with the file's directory
 *  relative to it — pure string containment on `sep`, so the palette fake
 *  and the service agree. `null` when no root contains the file. */
export function locateInRoots(
  filePath: string,
  roots: readonly string[],
  sep: string,
): { root: string; relativeDirectory: string } | null {
  let best: { root: string; rel: string } | null = null;
  for (const root of roots) {
    const base = root.replace(/[\\/]+$/, '');
    if (!filePath.startsWith(base + sep)) continue;
    if (!best || base.length > best.root.length) best = { root, rel: filePath.slice(base.length + 1) };
  }
  if (!best) return null;
  const at = best.rel.lastIndexOf(sep);
  return { root: best.root, relativeDirectory: at < 0 ? '' : best.rel.slice(0, at) };
}
