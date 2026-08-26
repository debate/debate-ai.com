/**
 * View-operating transclusion actions: refresh, detach, insert. Shared by the
 * NodeView header buttons and the ribbon commands. Refresh is async (it reads
 * the source file); detach and insert are synchronous transactions.
 */
import { NodeSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { Node as PMNode, Schema, Fragment } from 'prosemirror-model';
import { newHeadingId } from '../schema/index.js';
import {
  isTransclusionNode,
  isZoneEdited,
  zoneIdentity,
  detachSlice,
  createTransclusionNode,
  extractSection,
  chooseSourceRef,
  prepareZoneContent,
  SELF_SOURCE_REF,
  isInDocCopy,
  type TransclusionAttrs,
  type SourceRefBase,
} from './transclusion.js';
import { getViewDocPath } from './transclusion-doc-path.js';
import { flattenSelfRefsInFragment } from './self-transclusion.js';
import { resolveTransclusion, type ResolveOutcome } from './transclusion-resolve.js';
import { ZONE_REFRESHED_META } from './transclusion-divergence-plugin.js';
import { showConfirm } from './confirm-dialog.js';

/** " › " with explicit code points (space, U+203A, space). */
const CRUMB_SEP = ' › ';

/** Confirm discarding a zone's local edits before a refresh overwrites them.
 *  Resolves true only on an explicit OK. Headless (no `document`) resolves
 *  FALSE — we refuse rather than silently discard edits, since this guards real
 *  data loss. Uses the in-editor dialog, not a native `window.confirm`. */
function confirmDiscardEdits(): Promise<boolean> {
  return showConfirm({
    title: 'Discard your edits?',
    message: 'Refreshing replaces your local edits to this linked copy with the current source.',
    confirmLabel: 'Refresh',
    cancelLabel: 'Keep edits',
  });
}

/** Breadcrumb label: "SourceFile › Heading" (drops the `.cmir` extension). */
export function crumbLabel(sourceName: string, headingLabel: string): string {
  const base = sourceName.replace(/\.cmir$/i, '');
  return base ? `${base}${CRUMB_SEP}${headingLabel}` : headingLabel;
}

export type BuildZoneReason =
  | 'no-heading-id'
  | 'no-section'
  /** The source heading exists but has no content — nothing to transclude. */
  | 'empty-section'
  | 'no-doc-path'
  | 'no-portable-ref';

export interface BuildZoneOutcome {
  ok: boolean;
  reason?: BuildZoneReason;
  attrs?: TransclusionAttrs;
  /** The zone's child content (id-rewritten), ready to insert. */
  content?: Fragment;
  headingLabel?: string;
}

/**
 * Build a new live zone (attrs + child content) from an already-parsed source
 * doc + a target heading id. Shared by every creation entry point (the picker's
 * transclude mode and per-header Mod+Enter). Snapshots the section now, rewrites
 * its heading ids to fresh ones, computes a portable source ref, and rejects
 * direct self-embedding. Pure aside from the `last_refreshed` timestamp.
 */
export function buildLiveZoneAttrs(
  schema: Schema,
  sourceDoc: PMNode,
  headingId: string,
  sourceName: string,
  docPath: string | null,
  sourceAbsPath: string,
  roots: readonly string[],
): BuildZoneOutcome {
  if (!headingId) return { ok: false, reason: 'no-heading-id' };
  const section = extractSection(sourceDoc, headingId);
  if (!section) return { ok: false, reason: 'no-section' };
  // An empty source heading would create an invisible, phantom zone — refuse.
  if (section.content.size === 0) return { ok: false, reason: 'empty-section' };
  if (!docPath) return { ok: false, reason: 'no-doc-path' };
  const chosen = chooseSourceRef(docPath, sourceAbsPath, roots);
  if (!chosen) return { ok: false, reason: 'no-portable-ref' };
  // A linked copy is a FLAT snapshot: materialize any live views in the source
  // section to plain cards (resolved against the source doc). Keeping zone content
  // self_ref-free is what stops a copy from carrying a live view whose rail would
  // stack inside the copy's rail (a second transclusion updating from a different
  // source). Nested linked copies are flattened next by prepareZoneContent.
  const flat = flattenSelfRefsInFragment(section.content, sourceDoc, newHeadingId);
  const { content, hash, shapeHash } = prepareZoneContent(flat, newHeadingId);
  const attrs: TransclusionAttrs = {
    source_ref: chosen.ref,
    source_ref_base: chosen.base,
    source_heading_id: headingId,
    source_abs: sourceAbsPath,
    source_content_hash: hash,
    source_shape_hash: shapeHash,
    last_refreshed: Date.now(),
    source_label: crumbLabel(sourceName, section.headingLabel),
  };
  // No cycle guard needed: prepareZoneContent flattened any nested zones, so the
  // content is structurally zone-free and can't reference this (or any) zone.
  return { ok: true, attrs, content, headingLabel: section.headingLabel };
}

/**
 * Build an in-doc LINKED COPY (attrs + content) from a section of THIS document.
 * Like `buildLiveZoneAttrs` but the source is in-doc: no file path / portable
 * ref, `source_ref` is the `SELF_SOURCE_REF` marker, and refresh + divergence
 * resolve from the live doc. A copy is a FLAT snapshot — nested cross-file copies
 * AND nested live views both materialize to plain cards, so the copy never
 * carries a second transclusion rail (no stacked rails).
 */
export function buildInDocCopyAttrs(doc: PMNode, headingId: string): BuildZoneOutcome {
  if (!headingId) return { ok: false, reason: 'no-heading-id' };
  const section = extractSection(doc, headingId);
  if (!section) return { ok: false, reason: 'no-section' };
  if (section.content.size === 0) return { ok: false, reason: 'empty-section' };
  const flat = flattenSelfRefsInFragment(section.content, doc, newHeadingId);
  const { content, hash, shapeHash } = prepareZoneContent(flat, newHeadingId);
  const attrs: TransclusionAttrs = {
    source_ref: SELF_SOURCE_REF,
    source_ref_base: 'doc',
    source_heading_id: headingId,
    source_abs: '',
    source_content_hash: hash,
    source_shape_hash: shapeHash,
    last_refreshed: Date.now(),
    source_label: crumbLabel('', section.headingLabel),
  };
  return { ok: true, attrs, content, headingLabel: section.headingLabel };
}

/** Toast message for a failed live-zone build. */
export function buildZoneErrorMessage(reason: BuildZoneReason | undefined): string {
  switch (reason) {
    case 'no-heading-id':
      return 'That heading has no stable id — open and save the source in CardMirror, then retry.';
    case 'no-section':
      return 'Could not read that section from the source.';
    case 'empty-section':
      return 'That heading has no content to transclude.';
    case 'no-doc-path':
      return 'Save this document first, then insert a linked copy.';
    case 'no-portable-ref':
      return 'Couldn’t make a portable link to that file.';
    default:
      return 'Could not insert the linked copy.';
  }
}

/** Re-locate a zone after an async gap. If the preferred pos still holds the
 *  same-identity zone, use it. Otherwise the pos went stale (the doc mutated
 *  during the read): only relocate when EXACTLY ONE zone shares this identity.
 *  With duplicate-identity zones we cannot tell which one the user meant, so we
 *  return null and the caller REFUSES — refreshing the wrong zone would silently
 *  discard a different (possibly edited) zone's content. Also null when the zone
 *  vanished (zero matches). */
function findZonePos(doc: PMNode, identity: string, preferredPos: number): number | null {
  const at = doc.nodeAt(preferredPos);
  if (at && isTransclusionNode(at) && zoneIdentity(at) === identity) return preferredPos;
  const matches: number[] = [];
  doc.descendants((n, pos) => {
    if (isTransclusionNode(n) && zoneIdentity(n) === identity) matches.push(pos);
    return true;
  });
  return matches.length === 1 ? matches[0]! : null;
}

/**
 * Refresh the zone at `pos`: read its source, extract the section, and replace
 * the cache. Returns the resolve outcome so the caller can surface failures
 * (the NodeView shows an "unreachable" chip; a command shows a toast). On
 * success the doc is updated in place; on failure nothing changes (the cache
 * keeps rendering). Best-effort — never throws.
 */
export interface RefreshOptions {
  /** Prompt before a refresh discards the zone's local edits (default true).
   *  The whole-document refresh passes `false` — it confirms ONCE up front for
   *  every zone, so per-zone prompts would be redundant. */
  confirmEdits?: boolean;
}

/** Resolve an in-doc linked copy's source from the live doc (no file read). Live
 *  views in the section materialize to plain cards (against the live doc), so a
 *  refresh re-pulls a flat snapshot — the copy never re-acquires a nested rail. */
function resolveInDocSource(doc: PMNode, headingId: string): ResolveOutcome {
  const section = extractSection(doc, headingId);
  if (!section) return { ok: false, reason: 'heading-missing' };
  const content = flattenSelfRefsInFragment(section.content, doc, newHeadingId);
  return { ok: true, result: { ...section, content }, sourceName: '' };
}

export async function refreshZoneAtPos(
  view: EditorView,
  pos: number,
  opts: RefreshOptions = {},
): Promise<ResolveOutcome> {
  const confirmEdits = opts.confirmEdits !== false;
  const node = view.state.doc.nodeAt(pos);
  if (!node || !isTransclusionNode(node)) return { ok: false, reason: 'heading-missing' };
  const identity = zoneIdentity(node);
  // Fast path: if the clicked zone is already edited, confirm up front so a
  // large source read isn't done only to be discarded on cancel.
  const preEdited = isZoneEdited(node);
  if (confirmEdits && preEdited && !(await confirmDiscardEdits())) {
    return { ok: false, reason: 'cancelled' };
  }

  const docPath = getViewDocPath(view);
  // In-doc linked copies resolve from the LIVE doc (no file read); cross-file
  // copies read the source file.
  const outcome = isInDocCopy(node)
    ? resolveInDocSource(view.state.doc, String(node.attrs['source_heading_id'] ?? ''))
    : await resolveTransclusion(
        docPath,
        String(node.attrs['source_ref'] ?? ''),
        node.attrs['source_ref_base'] === 'root' ? 'root' : 'doc',
        String(node.attrs['source_heading_id'] ?? ''),
        String(node.attrs['source_abs'] ?? ''),
      );
  if (!outcome.ok || !outcome.result) return outcome;
  // The heading is still there but has been emptied since the last sync — refuse
  // rather than blank the zone (which would leave an invisible husk). Keep cache.
  if (outcome.result.content.size === 0) {
    return { ok: false, reason: 'source-empty', sourceName: outcome.sourceName };
  }

  // Re-locate the target AFTER the await. findZonePos returns null when the pos
  // went stale AND duplicate-identity zones make the target ambiguous — refuse
  // rather than overwrite the wrong (possibly edited) zone.
  const targetPos = findZonePos(view.state.doc, identity, pos);
  if (targetPos === null) {
    return { ok: false, reason: 'ambiguous', sourceName: outcome.sourceName };
  }
  const live = view.state.doc.nodeAt(targetPos);
  if (!live || !isTransclusionNode(live)) {
    return { ok: false, reason: 'ambiguous', sourceName: outcome.sourceName };
  }
  // If we didn't already confirm and the zone became edited DURING the read (the
  // user typed into it in the async window), confirm now — otherwise those
  // just-made edits would be replaced with no prompt.
  if (confirmEdits && !preEdited && isZoneEdited(live) && !(await confirmDiscardEdits())) {
    return { ok: false, reason: 'cancelled' };
  }

  // Replace the whole zone node with a fresh one: new children (nested zones
  // flattened, source ids rewritten), reset content hash + timestamp + label.
  const { content, hash, shapeHash } = prepareZoneContent(outcome.result.content, newHeadingId);
  const newNode = createTransclusionNode(
    view.state.schema,
    {
      source_ref: String(live.attrs['source_ref'] ?? ''),
      source_ref_base: (live.attrs['source_ref_base'] === 'root' ? 'root' : 'doc') as SourceRefBase,
      source_heading_id: String(live.attrs['source_heading_id'] ?? ''),
      source_abs: String(live.attrs['source_abs'] ?? ''),
      source_content_hash: hash,
      source_shape_hash: shapeHash,
      last_refreshed: Date.now(),
      source_label: crumbLabel(outcome.sourceName ?? '', outcome.result.headingLabel),
    },
    content,
  );
  const tr = view.state.tr.replaceWith(targetPos, targetPos + live.nodeSize, newNode);
  tr.setMeta('addToHistory', true);
  // Tell the divergence plugin a zone was just re-pulled, so it rechecks and
  // clears this zone's "source updated" badge promptly (not on the idle cadence).
  tr.setMeta(ZONE_REFRESHED_META, true);
  view.dispatch(tr);
  return outcome;
}

/** Outcome of a whole-document refresh. `confirmed: false` means the user
 *  cancelled the single up-front confirmation and nothing was touched. */
export interface RefreshAllSummary {
  /** Live zones found in the document. */
  total: number;
  /** Zones successfully re-pulled from source. */
  refreshed: number;
  /** Zones whose source couldn't be read (cache kept rendering). */
  failed: number;
  confirmed: boolean;
}

/** One confirmation covering EVERY zone — a whole-doc refresh discards all local
 *  edits and re-pulls every source, so it's confirmed once up front rather than
 *  once per edited zone. */
function confirmRefreshAll(count: number): Promise<boolean> {
  const zones = count === 1 ? 'the 1 linked copy' : `all ${count} linked copies`;
  return showConfirm({
    title: 'Refresh every linked copy?',
    message: `This replaces ${zones} in this document with their current sources, discarding any local edits and contextualization.`,
    confirmLabel: 'Refresh all',
    cancelLabel: 'Cancel',
  });
}

/**
 * Refresh EVERY live zone in the document after a single confirmation. Zones are
 * refreshed bottom-to-top so replacing one never shifts a not-yet-processed
 * zone's position, and each call re-validates its own target. Per-zone edit
 * prompts are suppressed — the one up-front confirm stands in for all of them.
 * Best-effort: a source that can't be read leaves that zone's cache in place and
 * counts as a failure. Returns a summary for the caller to surface.
 */
export async function refreshAllZones(view: EditorView): Promise<RefreshAllSummary> {
  const positions: number[] = [];
  view.state.doc.descendants((n, pos) => {
    if (!isTransclusionNode(n)) return true;
    positions.push(pos);
    return false; // zones never nest — no need to descend into one
  });
  if (positions.length === 0) return { total: 0, refreshed: 0, failed: 0, confirmed: true };
  if (!(await confirmRefreshAll(positions.length))) {
    return { total: positions.length, refreshed: 0, failed: 0, confirmed: false };
  }
  let refreshed = 0;
  let failed = 0;
  // Bottom-to-top: a replace only shifts positions AFTER it, which are already
  // done, so every remaining `pos` stays exact (refreshZoneAtPos then takes its
  // fast path and never hits the ambiguous-identity guard).
  positions.sort((a, b) => b - a);
  for (const pos of positions) {
    const outcome = await refreshZoneAtPos(view, pos, { confirmEdits: false });
    if (outcome.ok) refreshed++;
    else failed++;
  }
  return { total: positions.length, refreshed, failed, confirmed: true };
}

/**
 * Detach the zone at `pos`: replace it with its children as ordinary editable
 * content, breaking the link (edits are kept — the ids are already unique). An
 * empty zone just vanishes. Returns false if there's no zone there.
 */
export function detachZoneAtPos(view: EditorView, pos: number): boolean {
  const node = view.state.doc.nodeAt(pos);
  if (!node || !isTransclusionNode(node)) return false;
  const slice = detachSlice(node);
  const tr = view.state.tr.replaceRange(pos, pos + node.nodeSize, slice);
  view.dispatch(tr.scrollIntoView());
  return true;
}

/**
 * Delete the zone at `pos` outright — the wrapper AND its contents — unlike
 * detach, which keeps the content as loose cards. Undo-able. Returns false if
 * there's no zone there.
 */
export function deleteZoneAtPos(view: EditorView, pos: number): boolean {
  const node = view.state.doc.nodeAt(pos);
  if (!node || !isTransclusionNode(node)) return false;
  const tr = view.state.tr.delete(pos, pos + node.nodeSize);
  view.dispatch(tr.scrollIntoView());
  return true;
}

/**
 * Insert a new live zone (with its child content) after the top-level block
 * containing the selection, and select it. Returns false if the schema won't
 * allow it (shouldn't happen at the doc root).
 */
export function insertZoneAtSelection(
  view: EditorView,
  attrs: Partial<TransclusionAttrs>,
  content?: Fragment,
): boolean {
  const node = createTransclusionNode(view.state.schema, attrs, content);
  const { $from } = view.state.selection;
  const pos = $from.depth > 0 ? $from.after(1) : $from.pos;
  let tr;
  try {
    tr = view.state.tr.insert(pos, node);
  } catch {
    // Schema wouldn't allow a zone here — honor the documented contract.
    return false;
  }
  try {
    tr = tr.setSelection(NodeSelection.create(tr.doc, pos));
  } catch {
    // Selection placement is best-effort.
  }
  view.dispatch(tr.scrollIntoView());
  return true;
}

/**
 * Replace the zone at `pos` with a freshly built one — used by "Re-pick source"
 * to re-target a zone (or relink an unlinked/frozen one) in place, preserving
 * its position. Returns false if there's no zone there.
 */
export function replaceZoneAtPos(
  view: EditorView,
  pos: number,
  identity: string,
  attrs: Partial<TransclusionAttrs>,
  content?: Fragment,
): boolean {
  // The picker is a long interaction, so `pos` may have gone stale (a collab
  // peer edit, etc.). Re-locate the ORIGINAL zone by identity — findZonePos
  // refuses (null) if it's ambiguous or gone, so we never re-target the wrong
  // zone. (identity is the zone's pre-re-pick source_ref + heading id.)
  const targetPos = findZonePos(view.state.doc, identity, pos);
  if (targetPos === null) return false;
  const node = view.state.doc.nodeAt(targetPos);
  if (!node || !isTransclusionNode(node)) return false;
  const newNode = createTransclusionNode(view.state.schema, attrs, content);
  const tr = view.state.tr.replaceWith(targetPos, targetPos + node.nodeSize, newNode);
  tr.setMeta('addToHistory', true);
  try {
    view.dispatch(tr.scrollIntoView());
  } catch {
    // The view was torn down (e.g. its pane closed while the picker was open).
    return false;
  }
  return true;
}

/** How to open the picker in "re-pick" mode. Registered by the app wiring
 *  (index.ts) because the picker needs deps the NodeView doesn't carry. */
let rePickOpener: ((view: EditorView, pos: number, identity: string) => void) | null = null;
export function setRePickOpener(fn: (view: EditorView, pos: number, identity: string) => void): void {
  rePickOpener = fn;
}
/** Open the re-pick picker for the zone at `pos`. No-op (false) when there's no
 *  zone there or nothing is registered (e.g. the web build). Captures the zone's
 *  identity now so the eventual replace can re-locate it safely. */
export function rePickZoneAtPos(view: EditorView, pos: number): boolean {
  const node = view.state.doc.nodeAt(pos);
  if (!node || !isTransclusionNode(node) || !rePickOpener) return false;
  rePickOpener(view, pos, zoneIdentity(node));
  return true;
}

/** How to open a zone's linked source file. Registered by the app wiring
 *  (index.ts) — it needs host + file-open plumbing the NodeView doesn't carry. */
let openSourceOpener: ((view: EditorView, pos: number) => void) | null = null;
export function setOpenSourceOpener(fn: (view: EditorView, pos: number) => void): void {
  openSourceOpener = fn;
}
/** Open the linked source file for the zone at `pos`. No-op (false) when nothing
 *  is registered (e.g. the web build). */
export function openZoneSourceAtPos(view: EditorView, pos: number): boolean {
  if (!openSourceOpener) return false;
  openSourceOpener(view, pos);
  return true;
}
