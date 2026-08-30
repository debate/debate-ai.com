/**
 * Transclusion "live zones" — core logic (see TRANSCLUSION_PLAN.md).
 *
 * A live zone (`transclusion_ref` node) renders the contents under a heading
 * in another CardMirror file. This module is the PURE, view-independent core:
 * extracting a section from a source doc, hashing it, building the node,
 * detaching it back to plain content, computing the doc-relative source path,
 * and the cycle-identity helpers. The NodeView (transclusion-nodeview.ts) and
 * the commands/IPC glue (transclusion-commands.ts) build on this.
 *
 * Nothing here touches the DOM or Electron, so it is fully unit-testable.
 */
import { Fragment, Slice } from 'prosemirror-model';
import type { Node as PMNode, Schema, ResolvedPos } from 'prosemirror-model';
import { NodeSelection } from 'prosemirror-state';
import type { Selection } from 'prosemirror-state';
import {
  collectHeadings,
  computeHeadingRange,
  TYPE_LABEL,
} from './headings.js';
import { HEADING_TYPE_NAMES } from '../schema/ids.js';

export const TRANSCLUSION_NODE = 'transclusion_ref';

/** Hard cap on how deep nested live zones render before we stop and show a
 *  placeholder. Snapshots are finite so this is a perf/pathology backstop,
 *  not a correctness guard — see TRANSCLUSION_PLAN.md §7. */
export const MAX_NEST_DEPTH = 8;

export type SourceRefBase = 'doc' | 'root';

export interface TransclusionAttrs {
  source_ref: string;
  source_ref_base: SourceRefBase;
  source_heading_id: string;
  /** Absolute path the ref was created against — a machine-local resolve
   *  tie-breaker (see the node spec). '' when unknown. */
  source_abs: string;
  /** Hash of the children as last pulled from source (edit detection). */
  source_content_hash: string;
  /** Id-independent hash of the source section as last pulled (divergence
   *  detection — has the SOURCE moved on, regardless of local edits). */
  source_shape_hash: string;
  last_refreshed: number;
  source_label: string;
}

export interface ExtractResult {
  /** The transcluded content as a Fragment, with the source's original heading
   *  ids (the caller rewrites them to fresh ids before inserting). Empty when
   *  the section has no content under the heading. */
  content: Fragment;
  /** The target heading's own text (for the breadcrumb). */
  headingLabel: string;
  /** Schema type of the target heading (pocket/hat/block/tag/analytic). */
  headingType: string;
}

export function isTransclusionNode(node: PMNode | null | undefined): boolean {
  return !!node && node.type.name === TRANSCLUSION_NODE;
}

/** Sentinel `source_ref` marking a linked copy whose source is a section of THIS
 *  document (not a file). Resolution reads the live doc, not disk. A leading
 *  space can't be a real path, so it's an unambiguous marker; it persists
 *  verbatim (source_ref is a free string), so no schema change is needed. */
export const SELF_SOURCE_REF = ' self';

/** A linked copy whose source is in this document (vs another file). */
export function isInDocCopy(node: PMNode | null | undefined): boolean {
  return isTransclusionNode(node) && node!.attrs['source_ref'] === SELF_SOURCE_REF;
}

/**
 * The stable heading id of a transclusion target at doc position `pos`.
 *
 * The node at `pos` is the heading's own id when it's a grouping heading
 * (pocket/hat/block — the outline range starts at the heading node itself). But
 * a `tag` / `analytic` target's outline range starts at the ENCLOSING card /
 * analytic_unit (see `computeHeadingRange`), which carries no id of its own —
 * the id lives on its heading child. So fall back to the first heading-typed
 * descendant's id. Returns '' when nothing id-bearing is found.
 */
export function resolveHeadingIdAt(doc: PMNode, pos: number): string {
  const node = doc.nodeAt(pos);
  if (!node) return '';
  const own = node.attrs['id'];
  if (typeof own === 'string' && own) return own;
  let found = '';
  node.descendants((n) => {
    if (found) return false;
    const id = n.attrs['id'];
    if (HEADING_TYPE_NAMES.has(n.type.name) && typeof id === 'string' && id) {
      found = id;
      return false;
    }
    return true;
  });
  return found;
}

/** Grouping headings — the structural (sub-)section headers. A transcludable
 *  target's CONTENT may not contain these (only cards/analytics), so a zone is
 *  always a flat run of cards, never a whole section with sub-headings. */
const GROUPING_HEADING_TYPES: ReadonlySet<string> = new Set(['pocket', 'hat', 'block']);

/** Why a fragment can't become a live zone's content, or null if it can.
 *  Two rules keep transclusion simple (see TRANSCLUSION_PLAN):
 *   - `contains-zone`: the content itself holds a live zone — we don't nest
 *     zones (in any context), so this is refused rather than flattened.
 *   - `contains-subheading`: the content spans a grouping heading
 *     (pocket/hat/block), i.e. a whole section — only a single card or a block's
 *     cards (a flat card run) may be transcluded. */
export type ZoneContentIssue = 'contains-zone' | 'contains-subheading';

export function zoneContentIssue(content: Fragment): ZoneContentIssue | null {
  let issue: ZoneContentIssue | null = null;
  const walk = (frag: Fragment): void => {
    frag.forEach((node) => {
      if (issue) return;
      if (node.type.name === TRANSCLUSION_NODE) {
        issue = 'contains-zone';
        return;
      }
      if (GROUPING_HEADING_TYPES.has(node.type.name)) {
        issue = 'contains-subheading';
        return;
      }
      if (node.content.size) walk(node.content);
    });
  };
  walk(content);
  return issue;
}

/**
 * Position of the innermost live zone (`transclusion_ref`) whose INNER range
 * strictly contains `pos`, or null when `pos` is outside every zone (including
 * exactly at a zone boundary). Two positions are "in the same zone" iff this
 * returns the same value for both — the primitive for keeping a drag/move from
 * crossing a zone boundary, and for the in-zone heading-level guard.
 */
export function enclosingZonePos(doc: PMNode, pos: number): number | null {
  const clamped = Math.max(0, Math.min(pos, doc.content.size));
  const $pos = doc.resolve(clamped);
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type.name === TRANSCLUSION_NODE) return $pos.before(d);
  }
  return null;
}

/**
 * Depth of the innermost live zone containing `$from`, or 0 at the doc root. A
 * zone is structurally a mini-doc, so its direct children sit at depth
 * `enclosingZoneDepth + 1` — the base structural/boundary commands measure
 * against so they operate INSIDE a zone (see `structuralBaseDepth` in
 * ribbon-commands, and the zone-edge Enter escape in tag-keymap).
 */
export function enclosingZoneDepth($from: ResolvedPos): number {
  for (let d = 1; d <= $from.depth; d++) {
    if ($from.node(d).type.name === TRANSCLUSION_NODE) return d;
  }
  return 0;
}

/**
 * Extract the transcludable content under `headingId` from a source doc.
 *
 * - pocket / hat / block → the contents BELOW the header (the header line
 *   itself excluded), down to the next heading of equal-or-higher level.
 * - tag / analytic → the whole card / analytic_unit (tagline included).
 *
 * Returns null if the heading id isn't present in the doc.
 */
export function extractSection(doc: PMNode, headingId: string): ExtractResult | null {
  if (!headingId) return null;
  const entry = collectHeadings(doc, { skipCite: true }).find((h) => h.id === headingId);
  if (!entry) return null;
  const range = computeHeadingRange(doc, entry);
  if (!range) return null;

  let from = range.from;
  if (entry.type !== 'tag' && entry.type !== 'analytic') {
    // pocket/hat/block: drop the header line, keep everything under it.
    const node = doc.nodeAt(entry.pos);
    if (!node) return null;
    from = entry.pos + node.nodeSize;
  }
  const to = range.to;
  if (to < from) return null;

  return {
    content: doc.slice(from, to).content,
    headingLabel: entry.text.trim() || TYPE_LABEL[entry.type] || entry.type,
    headingType: entry.type,
  };
}

/** Hash of a fragment's content — the value stored in `source_content_hash`
 *  and compared against for edit detection. Empty → the 'empty' sentinel. */
export function contentHash(content: Fragment): string {
  return hashFragmentJSON(content.size ? content.toJSON() : null);
}

/** Whether the zone's children differ from what refresh last pulled — i.e. the
 *  user has locally contextualised it (edited a tag, its highlighting, …). */
export function isZoneEdited(node: PMNode): boolean {
  if (node.type.name !== TRANSCLUSION_NODE) return false;
  return contentHash(node.content) !== String(node.attrs['source_content_hash'] ?? '');
}

/** Recursively blank every `attrs.id` in a PM-JSON node — the id-independent
 *  canonical form. Two sections with identical content but different heading ids
 *  (as a source and its freshly-stamped mirror always are) reduce to the same
 *  shape. */
function stripIdsDeep(json: unknown): unknown {
  if (Array.isArray(json)) return json.map(stripIdsDeep);
  if (json && typeof json === 'object') {
    const obj = json as { attrs?: Record<string, unknown>; content?: unknown };
    const out: Record<string, unknown> = { ...obj };
    if (obj.attrs && typeof obj.attrs === 'object' && 'id' in obj.attrs) {
      out['attrs'] = { ...obj.attrs, id: '' };
    }
    if (Array.isArray(obj.content)) out['content'] = obj.content.map(stripIdsDeep);
    return out;
  }
  return json;
}

/** Id-independent hash of a fragment — its content signature ignoring heading
 *  ids. Stored as `source_shape_hash` at pull time and recomputed from a later
 *  source read to detect that the SOURCE has diverged (see
 *  transclusion-divergence.ts). Compare only shapes produced the same way
 *  (flatten nested zones first — as `prepareZoneContent` does). */
export function idIndependentHash(content: Fragment): string {
  return hashFragmentJSON(content.size ? stripIdsDeep(content.toJSON()) : null);
}

/** The id-independent shape a source read should be compared against to decide
 *  divergence: the stored `source_shape_hash` when present, else — for zones
 *  predating that attr — the mirror's own shape, but only when the mirror is
 *  UNedited (an unedited mirror equals its source-at-pull). Null when we can't
 *  tell (an edited pre-attr zone), so the caller leaves it unflagged. */
export function zoneReferenceShape(node: PMNode): string | null {
  if (node.type.name !== TRANSCLUSION_NODE) return null;
  const stored = String(node.attrs['source_shape_hash'] ?? '');
  if (stored) return stored;
  return isZoneEdited(node) ? null : idIndependentHash(node.content);
}

/**
 * Prepare an extracted section to become a zone's children: rewrite heading ids
 * to fresh ones (so two zones of the same source, or the source itself opened
 * alongside, never collide ids), and hash the result for `source_content_hash`.
 */
export function prepareZoneContent(
  content: Fragment,
  freshId: () => string,
): { content: Fragment; hash: string; shapeHash: string } {
  // A section pulled into a zone keeps only PLAIN content: any nested zones are
  // flattened to their snapshot. A zone is live only in the document it was
  // created in — nested inside another zone it becomes ordinary content (update
  // it in its home doc and re-snapshot). This also makes a zone's children
  // structurally zone-free, so a cycle can never form.
  const flattened = flattenZones(content);
  const rewritten = rewriteHeadingIdsInFragment(flattened, freshId);
  // shapeHash is id-independent, so it's identical for `flattened` and the
  // id-`rewritten` copy — recomputable from a later source read of the same
  // section for divergence detection.
  return { content: rewritten, hash: contentHash(rewritten), shapeHash: idIndependentHash(rewritten) };
}

/** Build a `transclusion_ref` node from attrs + child content. */
export function createTransclusionNode(
  schema: Schema,
  attrs: Partial<TransclusionAttrs>,
  content?: Fragment,
): PMNode {
  const type = schema.nodes[TRANSCLUSION_NODE];
  if (!type) throw new Error('transclusion_ref not registered in schema');
  return type.create(
    {
      source_ref: attrs.source_ref ?? '',
      source_ref_base: attrs.source_ref_base ?? 'doc',
      source_heading_id: attrs.source_heading_id ?? '',
      source_abs: attrs.source_abs ?? '',
      source_content_hash: attrs.source_content_hash ?? '',
      source_shape_hash: attrs.source_shape_hash ?? '',
      last_refreshed: attrs.last_refreshed ?? 0,
      source_label: attrs.source_label ?? '',
    },
    content,
  );
}

/** The stable identity of a zone's target — `source_ref` + heading id.
 *  Used to detect cycles across nested-zone rendering. */
export const ZONE_ID_SEP = '\u0000';
export function zoneIdentity(node: PMNode): string {
  // NUL separator: it can never appear in a path or a UUID, unlike a space
  // (real Dropbox paths contain spaces, e.g. "Debate Files").
  return `${String(node.attrs['source_ref'] ?? '')}${ZONE_ID_SEP}${String(node.attrs['source_heading_id'] ?? '')}`;
}

/**
 * The content a Detach should leave behind: the zone's cached fragment as a
 * Slice, ready to replace the node. The children already carry unique
 * (rewritten) ids from insert/refresh, so no further rewrite is needed.
 * Returns an empty Slice for an empty zone (which then just vanishes).
 */
export function detachSlice(node: PMNode): Slice {
  if (node.content.size === 0) return Slice.empty;
  return new Slice(node.content, 0, 0);
}

/** Rewrite every heading id in a fragment to a fresh UUID (deep). Mirrors the
 *  drag-copy id-rewrite so a materialized/detached section can't collide ids
 *  with its source. */
export function rewriteHeadingIdsInFragment(
  frag: Fragment,
  freshId: () => string,
): Fragment {
  const mapped: PMNode[] = [];
  frag.forEach((child) => mapped.push(rewriteHeadingIdsInNode(child, freshId)));
  return Fragment.fromArray(mapped);
}

function rewriteHeadingIdsInNode(node: PMNode, freshId: () => string): PMNode {
  const hasId = typeof node.attrs['id'] === 'string' && node.attrs['id'];
  const newContent = node.content.size
    ? rewriteHeadingIdsInFragment(node.content, freshId)
    : node.content;
  if (hasId) {
    return node.type.create({ ...node.attrs, id: freshId() }, newContent, node.marks);
  }
  if (newContent !== node.content) {
    return node.type.create(node.attrs, newContent, node.marks);
  }
  return node;
}

/** All zone identities that appear as DIRECT children of a fragment. Zones
 *  only ever appear at the top level of a section (the schema forbids them
 *  inside cards), so a shallow scan is complete. Used for the picker's
 *  direct-cycle check. */
export function directZoneIdentities(frag: Fragment): Set<string> {
  const out = new Set<string>();
  frag.forEach((child) => {
    if (child.type.name === TRANSCLUSION_NODE) out.add(zoneIdentity(child));
  });
  return out;
}

/** Every zone identity anywhere inside a fragment, at ANY depth (a zone's
 *  cached children can themselves contain zones). Used to reject TRANSITIVE /
 *  edit-introduced cycles at create/refresh time — a section that transitively
 *  transcludes the very zone being built would otherwise keep re-nesting its
 *  own snapshot deeper on every refresh, with no backstop (MAX_NEST_DEPTH was
 *  never enforced). See TRANSCLUSION_PLAN.md §7. */
export function deepZoneIdentities(frag: Fragment): Set<string> {
  const out = new Set<string>();
  const walk = (node: PMNode): void => {
    if (node.type.name === TRANSCLUSION_NODE) out.add(zoneIdentity(node));
    node.content.forEach(walk);
  };
  frag.forEach(walk);
  return out;
}

/** Cheap presence check — is there any zone anywhere in this fragment? Lets the
 *  clipboard hooks skip the rebuild for the common no-zone copy/paste. */
export function fragmentHasZone(frag: Fragment): boolean {
  let found = false;
  const walk = (n: PMNode): void => {
    if (found) return;
    if (n.type.name === TRANSCLUSION_NODE) {
      found = true;
      return;
    }
    n.content.forEach(walk);
  };
  frag.forEach(walk);
  return found;
}

/** Unwrap every zone in a fragment to its cached content (recursively). A zone
 *  is live only in the document it was created in; nested inside another zone —
 *  or ported elsewhere — it becomes ordinary content. Shared by content-prep
 *  (nested zones) and cross-document drops. */
export function flattenZones(frag: Fragment): Fragment {
  const out: PMNode[] = [];
  frag.forEach((child) => {
    const mapped = child.content.size ? flattenZones(child.content) : child.content;
    const node = mapped === child.content ? child : child.type.create(child.attrs, mapped, child.marks);
    if (node.type.name === TRANSCLUSION_NODE) {
      node.content.forEach((c) => out.push(c));
    } else {
      out.push(node);
    }
  });
  return Fragment.fromArray(out);
}

/** Slice wrapper around flattenZones — unwrap any zones a captured slice carries
 *  before inserting it into a (foreign) doc. A no-op when the slice has no zone.
 *  Used by the "captured slice → insert" transfer paths (dropzone shelf, pairing
 *  inbox, send-to-speech), which are all effectively cross-doc. */
export function flattenZonesInSlice(slice: Slice): Slice {
  if (!fragmentHasZone(slice.content)) return slice;
  // Removing a zone that sits on an OPEN edge of the slice makes the content one
  // level shallower there, so the open depth must drop by that wrapper level.
  // Otherwise PM's Fitter opens one node too deep and merges away the first /
  // last heading boundary — the "pasted headings get unformatted" symptom.
  const firstIsZone = isTransclusionNode(slice.content.firstChild);
  const lastIsZone = isTransclusionNode(slice.content.lastChild);
  const openStart = firstIsZone && slice.openStart > 0 ? slice.openStart - 1 : slice.openStart;
  const openEnd = lastIsZone && slice.openEnd > 0 ? slice.openEnd - 1 : slice.openEnd;
  return new Slice(flattenZones(slice.content), openStart, openEnd);
}

/** If the current selection is a NodeSelection over a live zone, return it. */
export function selectedTransclusion(
  selection: Selection,
): { node: PMNode; pos: number } | null {
  if (selection instanceof NodeSelection && isTransclusionNode(selection.node)) {
    return { node: selection.node, pos: selection.from };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Hashing — a stable, cross-machine content hash of the cached fragment.
// ---------------------------------------------------------------------------

/** Deterministic hash of a `cached_content` value. Two machines that extract
 *  byte-identical source sections produce the same hash, so staleness is a
 *  cheap compare. `null`/empty hashes to a fixed sentinel. */
export function hashFragmentJSON(json: unknown): string {
  if (json == null) return 'empty';
  return cyrb53(stableStringify(json)).toString(36);
}

/** JSON.stringify with object keys sorted recursively, so attr-key insertion
 *  order can't perturb the hash across machines. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/** cyrb53 — a fast, well-distributed 53-bit string hash (public domain). */
function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

// ---------------------------------------------------------------------------
// Doc-relative path — store source refs relative to the transcluding doc so
// they survive different absolute roots across machines (TRANSCLUSION_PLAN §3).
// ---------------------------------------------------------------------------

/** Split a file path into segments, tolerating both `/` and `\` separators
 *  and a leading drive letter, so it works for Dropbox paths on any OS. */
function splitPath(p: string): { drive: string; segs: string[]; absolute: boolean } {
  let s = p.replace(/\\/g, '/');
  let drive = '';
  const driveMatch = s.match(/^([a-zA-Z]:)\//);
  if (driveMatch) {
    drive = driveMatch[1]!.toUpperCase();
    s = s.slice(driveMatch[1]!.length);
  }
  const absolute = s.startsWith('/') || drive !== '';
  const segs = s.split('/').filter((seg) => seg !== '' && seg !== '.');
  return { drive, segs, absolute };
}

/**
 * Compute the path to `toFile` relative to the DIRECTORY of `fromFile`, using
 * forward slashes. Returns null if the two live on different drives (no
 * relative path exists) — the caller then can't make a portable ref.
 *
 *   relativeSourceRef('/a/b/Doc.cmir', '/a/c/Src.cmir') === '../c/Src.cmir'
 */
export function relativeSourceRef(fromFile: string, toFile: string): string | null {
  const from = splitPath(fromFile);
  const to = splitPath(toFile);
  if (from.drive !== to.drive) return null;
  // Directory of fromFile = its segments minus the filename.
  const fromDir = from.segs.slice(0, -1);
  const toSegs = to.segs;
  let common = 0;
  while (
    common < fromDir.length &&
    common < toSegs.length &&
    fromDir[common] === toSegs[common]
  ) {
    common++;
  }
  const up = fromDir.length - common;
  const rel = [...Array(up).fill('..'), ...toSegs.slice(common)];
  return rel.length ? rel.join('/') : '.';
}

/** True if `target` is inside directory `base` (or is `base` itself). Pure
 *  string form of the desktop `isWithin`; used at insert time in the renderer. */
export function isWithinPure(base: string, target: string): boolean {
  const b = splitPath(base);
  const t = splitPath(target);
  if (b.drive !== t.drive) return false;
  if (t.segs.length < b.segs.length) return false;
  for (let i = 0; i < b.segs.length; i++) {
    if (b.segs[i] !== t.segs[i]) return false;
  }
  return true;
}

/** Path of `target` relative to directory `base` (forward slashes), or null if
 *  `target` isn't inside `base`. */
export function rootRelative(base: string, target: string): string | null {
  if (!isWithinPure(base, target)) return null;
  const b = splitPath(base);
  const t = splitPath(target);
  const rel = t.segs.slice(b.segs.length);
  return rel.length ? rel.join('/') : '.';
}

/**
 * Choose how to store a source ref (user's shared-Dropbox insight): prefer
 * **root-relative** when the transcluding doc AND the source both live under the
 * same configured library root — that ref survives the doc being moved around
 * inside the shared folder, and every teammate has the folder configured. Fall
 * back to **doc-relative** otherwise. Returns null if no portable ref exists
 * (e.g. different Windows drives with no shared root).
 */
export function chooseSourceRef(
  docPath: string,
  sourceAbs: string,
  roots: readonly string[],
): { ref: string; base: SourceRefBase } | null {
  // Prefer the DEEPEST (most-specific) root that contains both the doc and the
  // source — the desktop resolver orders roots deepest-first, so anchoring the
  // stored ref to the same root keeps it resolving correctly on a teammate's
  // machine (nested roots otherwise produce a doubled-prefix, non-portable ref).
  const matching = roots
    .filter((r) => r && isWithinPure(r, docPath) && isWithinPure(r, sourceAbs))
    .sort((a, b) => b.length - a.length);
  for (const root of matching) {
    const ref = rootRelative(root, sourceAbs);
    if (ref && ref !== '.') return { ref, base: 'root' };
  }
  const rel = relativeSourceRef(docPath, sourceAbs);
  return rel ? { ref: rel, base: 'doc' } : null;
}
