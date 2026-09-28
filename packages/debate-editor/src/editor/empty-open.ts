/**
 * Genuinely-empty-file opens.
 *
 * Windows Explorer's "New > Microsoft Word Document" (ShellNew — Office's
 * VFS template is literally 0 bytes by design), `touch`, and some export
 * tools create REAL zero-byte files. Word opens those as a blank document
 * bound to the path; through v1.4.0 CardMirror refused them with "This
 * file is empty or hasn't finished downloading" — a guard meant for cloud
 * placeholders, catching innocent files too.
 *
 * The two cases are distinguishable ON DISK: a cloud placeholder that
 * hasn't downloaded stats at the file's REAL size while reading short —
 * the Windows Cloud Files API requires a file's size in its placeholder
 * metadata, and macOS dataless files report the true st_size with zero
 * blocks (Dropbox + Google Drive both verified empirically, 2026-08). So
 * only a file whose `stat` size is 0 — flagged by the host as
 * `emptyOnDisk` at read time — qualifies as genuinely empty; a short read
 * with a non-zero stat keeps the placeholder error, exactly as before.
 */
import type { Node as PMNode } from 'prosemirror-model';
import { serializeNative, toDocx } from '../index.js';

/** Should this opened file mount as a brand-new blank document?
 *  Requires the host's stat-backed flag AND an actually-empty read (the
 *  flag is computed at read time, but stay defensive against a stale or
 *  hand-built payload). Journals are never blank-opened — a 0-byte
 *  `.cmir-journal` is a corrupt journal and should say so. */
export function opensAsBlank(opened: {
  name: string;
  bytes: Uint8Array;
  emptyOnDisk?: boolean | undefined;
}): boolean {
  return (
    opened.emptyOnDisk === true &&
    opened.bytes.length === 0 &&
    !opened.name.toLowerCase().endsWith('.cmir-journal')
  );
}

/** Canonical blank-document bytes for `format` — substituted for the raw
 *  0 bytes so every downstream open path (parse, single-doc mount,
 *  multi-pane slot routing, spawn-window) works unmodified. */
export async function blankDocumentBytes(
  format: 'cmir' | 'docx',
  blankDoc: PMNode,
  opts: { defaultFont?: string } = {},
): Promise<Uint8Array> {
  return format === 'cmir' ? serializeNative(blankDoc) : await toDocx(blankDoc, opts);
}
