/**
 * Transclusion refresh resolver (renderer, desktop-only).
 *
 * Reads a source `.cmir` by its doc-relative ref (via the Electron host, which
 * enforces the path-safety boundary), parses it, and extracts the section under
 * the target heading id. Everything here is best-effort: any failure returns a
 * reason and the caller keeps rendering from cache (TRANSCLUSION_PLAN.md §3.1).
 * On web there is no filesystem, so this always reports `not-desktop`.
 */
import type { Node as PMNode } from 'prosemirror-model';
import { getElectronHost } from './host/index.js';
import { parseNative, newHeadingId } from '../index.js';
import { fromDocx } from '../import/index.js';
import { fileFormat } from './file-search.js';
import { settings } from './settings.js';
import {
  extractSection,
  type ExtractResult,
  type SourceRefBase,
} from './transclusion.js';
import { flattenSelfRefsInFragment } from './self-transclusion.js';

export type ResolveReason =
  | 'not-desktop'
  | 'no-doc-path'
  | 'no-source-ref'
  | 'source-unreadable'
  | 'parse-failed'
  | 'heading-missing'
  /** The source heading still exists but has been emptied since the last sync —
   *  refuse rather than blank the zone; keep the last cached content. */
  | 'source-empty'
  | 'cancelled'
  /** The zone couldn't be uniquely re-located after the async read (it moved and
   *  there are duplicate-identity zones) — refuse rather than risk the wrong one. */
  | 'ambiguous';

export interface ResolveOutcome {
  ok: boolean;
  reason?: ResolveReason;
  result?: ExtractResult;
  /** Basename of the resolved source file, when we got that far. */
  sourceName?: string;
}

/** Whether creating/refreshing live zones is possible in this build (desktop
 *  only — the cache still renders everywhere). */
export function transclusionSupported(): boolean {
  return getElectronHost() !== null;
}

/** User-facing message for a failed refresh (all reasons keep the cache). */
export function refreshFailMessage(reason: ResolveReason | undefined): string {
  switch (reason) {
    case 'not-desktop':
      return 'Linked copies from a file refresh on the desktop app.';
    case 'no-doc-path':
      return 'Save this document first, then refresh the linked copy.';
    case 'source-unreadable':
      return 'Source file not found — showing the last cached content.';
    case 'parse-failed':
      return 'Source file could not be read — showing cached content.';
    case 'heading-missing':
      return 'That heading is gone from the source — showing cached content.';
    case 'source-empty':
      return 'That heading is now empty in the source — keeping the last cached content.';
    case 'ambiguous':
      return 'The document changed while refreshing — try again.';
    case 'cancelled':
      return '';
    default:
      return 'Could not refresh the linked copy — showing cached content.';
  }
}

export async function resolveTransclusion(
  docPath: string | null,
  sourceRef: string,
  base: SourceRefBase,
  headingId: string,
  sourceAbs = '',
): Promise<ResolveOutcome> {
  const electron = getElectronHost();
  if (!electron) return { ok: false, reason: 'not-desktop' };
  if (!docPath) return { ok: false, reason: 'no-doc-path' };
  if (!sourceRef) return { ok: false, reason: 'no-source-ref' };

  const roots = (settings.get('fileSearchRoots') as string[] | undefined) ?? [];
  const first = await resolveOnce(electron, docPath, sourceRef, base, headingId, sourceAbs, roots);
  if (first.ok || !sourceAbs) return first;
  // The exact `source_abs` file was chosen first (Tier 0) but didn't yield the
  // section — it was deleted+replaced, or isn't the intended file. Retry WITHOUT
  // it so the relative resolution (which the abs tie-breaker shadowed) gets a
  // chance. (Doesn't cover two RELATIVE candidates where only the second has the
  // heading — a rarer multi-root case left for a follow-up.)
  if (first.reason === 'heading-missing' || first.reason === 'parse-failed') {
    const second = await resolveOnce(electron, docPath, sourceRef, base, headingId, '', roots);
    if (second.ok) return second;
  }
  return first;
}

async function resolveOnce(
  electron: NonNullable<ReturnType<typeof getElectronHost>>,
  docPath: string,
  sourceRef: string,
  base: SourceRefBase,
  headingId: string,
  sourceAbs: string,
  roots: string[],
): Promise<ResolveOutcome> {
  let file: { bytes: Uint8Array; name: string } | null;
  try {
    file = await electron.readCmirFile(docPath, sourceRef, base, roots, sourceAbs);
  } catch {
    file = null;
  }
  if (!file) return { ok: false, reason: 'source-unreadable' };

  let doc: PMNode;
  try {
    // Parse by the source's own format. A `.docx` re-imports through the docx
    // importer (which reads pmd-heading-* bookmarks back as stable heading ids,
    // so a CardMirror-exported .docx re-locates the section on refresh); a
    // `.cmir` goes through the native reader.
    doc =
      fileFormat(file.name) === 'docx'
        ? await fromDocx(file.bytes)
        : parseNative(file.bytes).doc;
  } catch {
    return { ok: false, reason: 'parse-failed', sourceName: file.name };
  }

  const result = extractSection(doc, headingId);
  if (!result) return { ok: false, reason: 'heading-missing', sourceName: file.name };
  // Materialize any live views in the source section to plain cards (resolved
  // against the SOURCE file's doc — a self_ref is intra-doc, so it must resolve
  // where it lives, not in the transcluding doc). Keeps a linked copy a flat
  // snapshot with no nested transclusion rail, for both refresh and divergence.
  const content = flattenSelfRefsInFragment(result.content, doc, newHeadingId);
  return { ok: true, result: { ...result, content }, sourceName: file.name };
}
