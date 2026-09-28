import type { FileTiebreak } from './file-search.js';

/** One ranked file hit — the compact row shared by search and browse. */
export interface FileIndexRow {
  path: string;
  relPath: string;
  name: string;
  mtimeMs: number;
  pinned: boolean;
}

export interface FileIndexQueryParams {
  query: string;
  roots: string[];
  exclusions: string[];
  formats: 'both' | 'cmir' | 'docx';
  tiebreak: FileTiebreak;
  pins: string[];
  /** Float pinned rows above the rest for scoped file search. */
  partitionPins: boolean;
  limit: number;
}

export interface FileIndexQueryResult {
  rows: FileIndexRow[];
  total: number;
}

/** A directory within one configured root. Empty relativeDirectory is the
 *  root. Segments use the index service's native separator. */
export interface FileBrowseLocation {
  root: string;
  relativeDirectory: string;
}

export type FileBrowseRow =
  | {
      kind: 'folder';
      name: string;
      relativeDirectory: string;
    }
  | ({
      kind: 'file';
      /** Directory of the file relative to the browsed directory ('' when
       *  it sits directly inside it) — the search view reaches any depth. */
      subPath: string;
    } & FileIndexRow);

export interface FileBrowseParams {
  roots: string[];
  location: FileBrowseLocation;
  /** '' lists the directory (subfolders + direct files); otherwise every
   *  file beneath it is searched, plus subfolders whose name matches. */
  query: string;
  exclusions: string[];
  formats: 'both' | 'cmir' | 'docx';
  tiebreak: FileTiebreak;
  pins: string[];
  limit: number;
}

export interface FileBrowseResult {
  rows: FileBrowseRow[];
  total: number;
  /** False when the requested root/directory was invalid or disappeared. */
  valid: boolean;
}

export type LocateCurrentFileFailure = 'outside-roots' | 'excluded';

export type LocateCurrentFileResult =
  | { ok: true; location: FileBrowseLocation }
  | { ok: false; reason: LocateCurrentFileFailure };
