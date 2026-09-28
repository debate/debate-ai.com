/**
 * Paste-handling plugin.
 *
 * Two interventions over PM's default clipboard handling:
 *
 * 1. **Plain-paste-armed mode (F2).** Browsers won't let a web app
 *    read the clipboard programmatically without a permission prompt
 *    (Chrome's "Paste" chip, Firefox's "Paste" popup — Mozilla doesn't
 *    even offer a permanent grant), so a Verbatim-style "F2 pastes
 *    plain text" can't be a single-keystroke action in a browser.
 *    Instead F2 toggles a plugin-state flag; while armed, every real
 *    `paste` event (a user-initiated Ctrl/Cmd+V) strips all
 *    formatting and inserts the clipboard's `text/plain` content.
 *    If `condenseOnPaste` is on, the F3 default condense then runs
 *    scoped to the pasted range (see `condensePastedRange`). F2
 *    again (or the ribbon button) disarms. The status-bar UI shows
 *    the armed state.
 *
 * 2. **A structural-led paste splits the destination container.** When the
 *    clipboard leads with structural content — a `tag` / `analytic` head, a
 *    doc-level heading (`pocket` / `hat` / `block`), or a whole `card` /
 *    `analytic_unit` — and the cursor sits in a body slot (`card_body` /
 *    `cite_paragraph` / `undertag`) of a `card` / `analytic_unit`, PM's default
 *    fitting demotes the structure to body text (the clipboard's flat, open
 *    `[tag, card_body, …]` shape merges its open head into the cursor's body).
 *    That's wrong — the user wanted the structural type, with its content. We
 *    instead re-group the pasted nodes into proper containers and split the
 *    destination, preserving the FULL pasted structure (see
 *    `tryPasteSplitContainer`). Falls through to default PM behavior in any
 *    other shape (no structural head, cursor not in a body slot, etc.).
 *
 * Order: armed mode wins over auto-split.
 */

import {
  Plugin,
  PluginKey,
  Selection,
  TextSelection,
  type EditorState,
  type Transaction,
} from 'prosemirror-state';
import {
  DOMParser as PMDOMParser,
  Fragment,
  Slice,
  type Node as PMNode,
  type NodeType,
  type ResolvedPos,
} from 'prosemirror-model';
import type { EditorView } from 'prosemirror-view';
import { schema, newHeadingId } from '../schema/index.js';
import { prepareSelectionForReplace } from './type-over-boundary.js';
import { settings } from './settings.js';
import { freshHeadingIds } from './drag-controller.js';
import { condenseBranchC, condenseMerge } from './condense.js';
import { buildImageNodeFromBlob, insertImageNode } from './image-insert.js';
import { fragmentHasZone, flattenZonesInSlice, enclosingZonePos } from './transclusion.js';
import { recallLinkedCopy } from './clipboard-link-cache.js';
import { detectPasteDialect } from './paste-dialect.js';
import { surfaceError } from './error-surface.js';
import { convertWordHtml, convertHakuHtml } from '../import/html-paste.js';
import {
  FOLDABLE_SPACES_RE,
  STRIPPABLE_INVISIBLES_RE,
  UNICODE_BREAKS_RE,
} from './exotic-whitespace.js';


/**
 * Build a Slice representing `text` as plain inline content, splitting
 * on newlines into paragraph breaks. Exported for unit tests.
 *
 * - Single line → `Slice(Fragment(text), 0, 0)` so it merges into the
 *   selection's textblock without forcing a paragraph type.
 * - Multi-line → `Slice([paragraph(line0), paragraph(line1), …], 1, 1)`.
 *   The 1/1 opens mean the first line's content joins the cursor's
 *   block and intermediate splits inherit the surrounding block type
 *   (card_body inside a card, etc.). This is the same shape PM's
 *   default plain-text clipboard parser produces.
 */
export function buildPlainTextSlice(text: string): Slice {
  const lines = text.split(/\r\n|\r|\n/);
  if (lines.length === 1) {
    return new Slice(
      lines[0] ? Fragment.from(schema.text(lines[0])) : Fragment.empty,
      0,
      0,
    );
  }
  const paragraphs = lines.map((line) =>
    schema.nodes['paragraph']!.create(null, line ? schema.text(line) : null),
  );
  return new Slice(Fragment.fromArray(paragraphs), 1, 1);
}

/** Block types that hold single-line / single-paragraph content
 *  in our schema. Plain-paste into these MUST flatten any
 *  internal newlines to spaces — pasting "Article Title\n" (a
 *  triple-click selection in the browser often carries that
 *  trailing newline) would otherwise split the surrounding card
 *  at the newline boundary, because the multi-paragraph slice
 *  forces PM to break out of the single-line parent. */
const SINGLE_LINE_PASTE_PARENTS = new Set<string>([
  'tag',
  'cite_paragraph',
  'undertag',
  'analytic',
]);

/** Normalize clipboard text for paste into the given parent block.
 *  Only the PLAIN-paste paths call this (F2 direct read, the F2-armed
 *  Ctrl/Cmd+V, and Paste-and-Condense) — rich paste and file loads are
 *  deliberately untouched, so existing documents never mutate silently.
 *
 *  All plain pastes fold the PDF-extraction whitespace artifacts (see
 *  exotic-whitespace.ts): soft hyphens / zero-widths stripped, LINE /
 *  PARAGRAPH SEPARATOR and friends routed into the newline handling
 *  (they carry break semantics, so they become paragraph splits — never
 *  spaces), and every other Unicode space separator folded to a plain
 *  space (U+2007 FIGURE SPACE is the field case: non-breaking, so a
 *  card pasted with it can't wrap at its word gaps). Then, in
 *  single-line contexts (`SINGLE_LINE_PASTE_PARENTS`), collapse any
 *  whitespace run (newlines, tabs, repeated spaces) to a single space
 *  and trim the edges. In multi-paragraph contexts (`card_body`,
 *  `paragraph`, etc.) intentional paragraph splits survive. */
export function normalizeClipboardTextForPaste(
  text: string,
  parentTypeName: string,
): string {
  const cleaned = text
    .replace(STRIPPABLE_INVISIBLES_RE, '')
    .replace(UNICODE_BREAKS_RE, '\n')
    .replace(FOLDABLE_SPACES_RE, ' ');
  if (SINGLE_LINE_PASTE_PARENTS.has(parentTypeName)) {
    return cleaned.replace(/\s+/g, ' ').trim();
  }
  return cleaned;
}

const SPLITTABLE_BODY_SLOTS = new Set<string>([
  'card_body',
  'cite_paragraph',
  'undertag',
]);

/** Structural heads a paste can lead with that must "win" over a card body:
 *  the card-anchoring `tag`, the analytic_unit-anchoring `analytic`, and the
 *  doc-level headings (`pocket` / `hat` / `block`). */
const STRUCTURAL_HEAD_NAMES = new Set<string>([
  'tag',
  'analytic',
  'pocket',
  'hat',
  'block',
]);
const DOC_LEVEL_HEADINGS = new Set<string>(['pocket', 'hat', 'block']);
/** Whole structural containers a paste can lead with. */
const STRUCTURAL_CONTAINERS = new Set<string>(['card', 'analytic_unit']);
/** Blocks that are valid `card` / `analytic_unit` content, so a paste of them
 *  can be fitted INTO the container instead of bubbling a split up to the card
 *  level. `paragraph` is converted to `card_body`; the rest keep their type. */
const CARD_FITTABLE_PASTE = new Set<string>([
  'paragraph',
  'cite_paragraph',
  'undertag',
  'card_body',
]);

/** Fit an arbitrary body node into a `card`'s content rule
 *  (`card_body | undertag | cite_paragraph | table`). A bare `paragraph`
 *  (common from external HTML) — or a stray `analytic`, which is not
 *  legal card content — becomes a `card_body`; the rest pass through.
 *  (Structural-led pastes route analytics into their own analytic_unit via
 *  `groupStructuralNodes`, so an analytic shouldn't reach here; the coercion is
 *  defensive, keeping the card schema-valid either way.) */
function fitForCard(child: PMNode): PMNode {
  const t = child.type.name;
  if (t === 'card_body' || t === 'undertag' || t === 'cite_paragraph' || t === 'table') {
    return child;
  }
  return schema.nodes['card_body']!.create(null, child.content);
}

/** Fit a body node into an `analytic_unit`'s content rule
 *  (`card_body | undertag | cite_paragraph | table`). An `analytic` (only one
 *  is allowed, the head) or a bare `paragraph` folds into a `card_body`. */
function fitForAnalyticUnit(child: PMNode): PMNode {
  const t = child.type.name;
  if (t === 'card_body' || t === 'undertag' || t === 'cite_paragraph' || t === 'table') {
    return child;
  }
  return schema.nodes['card_body']!.create(null, child.content);
}

/** Convert a card/unit body child into the equivalent node valid at the doc
 *  root — for when a pasted doc-level heading ejects the post-cursor remainder
 *  out of its container. Mirrors `liftCardChild` in ribbon-commands. */
function liftToDocRoot(child: PMNode): PMNode {
  const t = child.type.name;
  if (t === 'card_body' || t === 'cite_paragraph') {
    return schema.nodes['paragraph']!.create(null, child.content);
  }
  if (t === 'analytic') {
    return schema.nodes['analytic_unit']!.create(null, [child]);
  }
  return child;
}

/** Normalize a flat sequence of pasted structural nodes into doc-level-valid
 *  containers: a bare `tag` (plus the body nodes that follow it) wraps into a
 *  `card`; a bare `analytic` into an `analytic_unit`; doc-level headings,
 *  whole `card`/`analytic_unit` nodes, and loose blocks pass through. This
 *  re-closes the open, flat `[tag, card_body, …]` shape the clipboard produces
 *  when a selection starts inside a tag — the shape PM would otherwise demote
 *  by merging the open head into the cursor's body. */
function groupStructuralNodes(nodes: PMNode[]): PMNode[] {
  const out: PMNode[] = [];
  let i = 0;
  const isBoundary = (n: PMNode): boolean =>
    STRUCTURAL_HEAD_NAMES.has(n.type.name) || STRUCTURAL_CONTAINERS.has(n.type.name);
  while (i < nodes.length) {
    const n = nodes[i]!;
    const t = n.type.name;
    if (t === 'tag' || t === 'analytic') {
      const isCard = t === 'tag';
      const fit = isCard ? fitForCard : fitForAnalyticUnit;
      const bodies: PMNode[] = [];
      i++;
      while (i < nodes.length && !isBoundary(nodes[i]!)) {
        bodies.push(fit(nodes[i]!));
        i++;
      }
      out.push(
        schema.nodes[isCard ? 'card' : 'analytic_unit']!.create(null, [n, ...bodies]),
      );
    } else {
      out.push(n);
      i++;
    }
  }
  return out;
}

export interface PastePluginCtx {
  condenseOnPaste: () => boolean;
  paragraphIntegrity: () => boolean;
  usePilcrows: () => boolean;
  headingMode: () => 'strict' | 'respect' | 'demolish';
  /** Smart paste conversion (settings toggle, default on): route
   *  recognized Word / haku clipboard HTML through the structure
   *  converters instead of PM's generic HTML parse. */
  smartPasteConversion: () => boolean;
  /** Called whenever the armed flag flips, so the chrome can mirror it. */
  onArmedChange?: (armed: boolean) => void;
}

interface PluginState {
  plainPasteArmed: boolean;
}

export const plainPasteKey = new PluginKey<PluginState>('pmd-paste');

/** Is the next Ctrl/Cmd+V going to be treated as plain-paste? */
export function isPlainPasteArmed(state: EditorState): boolean {
  return plainPasteKey.getState(state)?.plainPasteArmed ?? false;
}

/** Toggle the plain-paste flag. Used by F2 in the browser edition,
 *  where Chromium's clipboard-permission UI forbids a synchronous
 *  one-keystroke paste. Electron's F2 path uses
 *  `applyPlainPasteFromText` directly instead. */
export function togglePlainPaste(): (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean {
  return (state, dispatch) => {
    if (!dispatch) return true;
    const armed = isPlainPasteArmed(state);
    dispatch(state.tr.setMeta(plainPasteKey, { plainPasteArmed: !armed }));
    return true;
  };
}

/** Settings-driven condense over just-pasted content. `from` is the
 *  selection start captured BEFORE the paste transaction; the cursor
 *  parks at the far end afterwards, so [from, cursor] spans the
 *  pasted range. Selects that range, condenses it (same pattern as
 *  `pasteTextAndCondense`), then collapses the cursor back to the
 *  end. The range selection is essential: condensing against the
 *  post-paste empty cursor would scope to the enclosing card — or
 *  no-op entirely at doc level, where plain-text blobs usually land. */
function condensePastedRange(
  view: EditorView,
  from: number,
  ctx: Pick<PastePluginCtx, 'paragraphIntegrity' | 'usePilcrows' | 'headingMode'>,
): void {
  const to = view.state.selection.from;
  if (to <= from) return; // nothing landed
  try {
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)));
    const cmd = ctx.paragraphIntegrity()
      ? condenseBranchC()
      : condenseMerge({
          withPilcrows: ctx.usePilcrows(),
          headingMode: ctx.headingMode(),
        });
    cmd(view.state, view.dispatch.bind(view));
  } catch (err) {
    // Keep the committed paste, but surface the failure (audit tier 4)
    // — a silent warn would hide a real condense bug in the field.
    surfaceError('condense after paste', err);
  }
  // F2 normally leaves a collapsed cursor at the end of the paste;
  // restore that after the temporary range selection.
  const sel = view.state.selection;
  if (!sel.empty) {
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, sel.to)));
  }
}

/** Replace the current selection with `text` as plain inline
 *  content, with the same condense-after-paste behavior the armed-
 *  mode `handlePaste` path uses. Exported for Electron's F2 flow,
 *  which fetches the clipboard via IPC and pastes directly without
 *  the browser-only "arm then Ctrl/Cmd+V" dance. No-op when `text`
 *  is empty. */
export function applyPlainPasteFromText(
  view: EditorView,
  text: string,
  ctx: {
    condenseOnPaste: () => boolean;
    paragraphIntegrity: () => boolean;
    usePilcrows: () => boolean;
    headingMode: () => 'strict' | 'respect' | 'demolish';
  },
): void {
  if (!text) return;
  // Same normalization as the armed-paste handler, for the Electron
  // F2 / menu path.
  const normalized = normalizeClipboardTextForPaste(
    text,
    view.state.selection.$from.parent.type.name,
  );
  if (!normalized) return;
  const slice = buildPlainTextSlice(normalized);
  // Multi-line plain-paste into a card_body cursor: pre-convert
  // the slice's paragraphs to card_body nodes so PM's Fitter
  // doesn't bubble the split up to the card level. Without this,
  // a 3+ line F2 paste mid-card_body lifts the middle paragraphs
  // out as doc-level orphans — the absorb plugin claims them back,
  // but with visible artifacts and a cursor mapping that bounces
  // through the lift+re-absorb instead of landing at the end of
  // the pasted content. Same template as the rich-paste path
  // (handlePaste below).
  const pasteFrom = view.state.selection.from;
  let tr = tryPasteAsCardBodies(view.state, slice);
  if (!tr) tr = view.state.tr.replaceSelection(slice);
  tr.setStoredMarks([]);
  view.dispatch(tr.scrollIntoView());
  if (ctx.condenseOnPaste()) condensePastedRange(view, pasteFrom, ctx);
}

/**
 * True when the clipboard's text flavors carry actual content — not
 * just markup wrapping the image flavor. Decides image-vs-text
 * precedence in `handlePaste`: Word ships a rendered bitmap of the
 * copied selection ALONGSIDE text/html + text/plain, and the bitmap
 * must not win over the real content. A browser "Copy image", by
 * contrast, has an empty text/plain and (at most) a bare `<img>`
 * as text/html — no text once tags are stripped.
 *
 * Exported for tests.
 */
export function clipboardHasMeaningfulText(cd: DataTransfer): boolean {
  const plain = cd.getData('text/plain');
  if (plain.trim() !== '') return true;
  const html = cd.getData('text/html');
  if (!html) return false;
  // Text content outside tags. Entity-decoded only as far as the
  // decision needs: a whitespace entity is still "no real text".
  const text = html.replace(/<[^>]*>/g, ' ').replace(/&(nbsp|#0*160|#x0*a0);/gi, ' ');
  return /\S/.test(text);
}

/** Heal schema-invalid CLOSED containers inside a pasted slice
 *  (Issue #34, the headless-card producer). A cut whose selection
 *  crosses out of one card into the next serializes the second
 *  card's tail as a card WITHOUT its leading tag; `parseSlice`
 *  rebuilds closed nodes with no validation and the paste fitter
 *  trusts slice interiors, so the invalid card lands in the live
 *  doc — where it breaks keystrokes near it and trips the save
 *  heal on every journal write. Blank-head endpoint per the settled
 *  hollow-shell doctrine ("re-delete a blank tag occasionally beats
 *  deleting too much"): prepend an empty tag / analytic rather than
 *  dropping or merging content. Only CLOSED nodes are touched — the
 *  slice's open spine is legitimately partial and is the fitter's
 *  business. */
const HEAD_OF_CONTAINER: Record<string, string> = { card: 'tag', analytic_unit: 'analytic' };

export function healHeadlessContainersInSlice(slice: Slice): Slice {
  const healFragment = (frag: Fragment, openStart: number, openEnd: number): Fragment => {
    let changed = false;
    const kids: PMNode[] = [];
    frag.forEach((child, _off, i) => {
      const startOpen = i === 0 && openStart > 0;
      const endOpen = i === frag.childCount - 1 && openEnd > 0;
      let node = child;
      if (!node.isText && node.content.childCount > 0) {
        const inner = healFragment(
          node.content,
          startOpen ? openStart - 1 : 0,
          endOpen ? openEnd - 1 : 0,
        );
        if (inner !== node.content) {
          node = node.type.create(node.attrs, inner, node.marks);
        }
      }
      const head = HEAD_OF_CONTAINER[node.type.name];
      // A START-OPEN container is allowed to lack its head — its
      // content merges into an existing container at the paste
      // point. A CLOSED (or merely end-open) one is not.
      if (head && !startOpen && node.firstChild?.type.name !== head) {
        try {
          const headNode =
            head === 'tag'
              ? schema.nodes['tag']!.create({ id: newHeadingId() })
              : schema.nodes['analytic']!.create({ id: newHeadingId() });
          const healed = node.type.createChecked(
            node.attrs,
            Fragment.from([headNode]).append(node.content),
            node.marks,
          );
          node = healed;
        } catch {
          /* content invalid beyond the missing head — leave it; the
             fitter will reject or the repair pass will catch it */
        }
      }
      if (node !== child) changed = true;
      kids.push(node);
    });
    return changed ? Fragment.fromArray(kids) : frag;
  };
  const content = healFragment(slice.content, slice.openStart, slice.openEnd);
  return content === slice.content ? slice : new Slice(content, slice.openStart, slice.openEnd);
}

export function buildPastePlugin(ctx: PastePluginCtx): Plugin<PluginState> {
  return new Plugin<PluginState>({
    key: plainPasteKey,
    state: {
      init: () => ({ plainPasteArmed: false }),
      apply(tr, value) {
        const meta = tr.getMeta(plainPasteKey) as PluginState | undefined;
        if (meta && typeof meta.plainPasteArmed === 'boolean') {
          if (meta.plainPasteArmed !== value.plainPasteArmed) {
            ctx.onArmedChange?.(meta.plainPasteArmed);
          }
          return meta;
        }
        return value;
      },
    },
    props: {
      // Stamp every pasted heading with a fresh unique id. The clipboard
      // parser drops `data-id` (our `parseDOM.getAttrs` reads only
      // `indent`), so headings arrive with `id: null`; the nav pane keys
      // expand/collapse, jump, and the 1/2/3/4 level filter off the id,
      // so id-less pasted pockets/hats/blocks/tags would be inert. Runs
      // inside PM's `parseFromClipboard`, before `handlePaste` sees the
      // slice, so the split / card-body paths below also get fresh ids.
      //
      // Layout-table unwrap runs in the same hook so head-detect /
      // card-body fitting downstream see content that's already been
      // lifted out of any single-cell wrapping table.
      transformPasted(slice, view) {
        // Same-doc paste of our own live view / linked copy: restore the link-
        // bearing original (fresh heading ids so the pasted cards don't collide
        // with the source — freshHeadingIds leaves the source-ref attrs alone, so
        // the link survives). A cross-doc / external paste falls through and gets
        // the flattened clipboard content.
        //
        // EXCEPT when the paste lands INSIDE a live zone: a nested transclusion
        // would stack two rails updating from different sources. There we skip the
        // link restore and fall through to flatten (matching drag/create, which
        // never nest a unit in a zone). `selection.from` is the pre-paste caret —
        // where PM will drop the slice.
        const intoZone = enclosingZonePos(view.state.doc, view.state.selection.from) !== null;
        if (!intoZone) {
          const linked = recallLinkedCopy(view, slice);
          if (linked) {
            return healHeadlessContainersInSlice(freshHeadingIds(unwrapSingleCellTables(linked)));
          }
        }
        const out = healHeadlessContainersInSlice(freshHeadingIds(unwrapSingleCellTables(slice)));
        if (!fragmentHasZone(out.content)) return out;
        // Any zone content on the clipboard pastes as a PLAIN cached copy (its
        // cards), never a live link. A partial in-zone copy shouldn't drag the
        // whole zone's linkage along (which would make a refresh pull ALL the
        // source's cards into both the copy and the paste), and a paste into a
        // zone can't nest. flattenZonesInSlice also corrects the open depths so
        // the pasted headings keep their formatting. To duplicate a live zone,
        // use the transclude command (it mints a fresh link).
        return healHeadlessContainersInSlice(flattenZonesInSlice(out));
      },
      // Every custom insertion path below stamps `uiEvent: 'paste'` on
      // its transaction, matching what PM's default paste path does.
      // Downstream plugins key real-paste-only behavior off that meta
      // (comment-clipboard's duplicate-on-paste pass), and a paste that
      // happens to card-fit or split must look like any other paste to
      // them.
      handlePaste(view, event, slice) {
        // A selection PM's replace cannot fit (head-tail cross-
        // container shape) must be merge-collapsed BEFORE any paste
        // branch replaces over it — otherwise replaceSelection throws
        // "Cannot join …" uncaught and the paste dies silently.
        if (!prepareSelectionForReplace(view)) return true;
        // And a SLICE whose open container edges can't fit at this
        // cursor (copy from mid-analytic-unit pasted inside a card)
        // makes PM's own default replaceSelection throw. Probe it; on
        // failure paste a closed + healed rendering of the same
        // content, and as a last resort swallow with a warning — a
        // no-op paste beats an uncaught crash that looks identical
        // to "paste is broken".
        {
          let fits = true;
          try {
            view.state.tr.replaceSelection(slice);
          } catch {
            fits = false;
          }
          if (!fits) {
            event.preventDefault();
            try {
              const closed = healHeadlessContainersInSlice(
                new Slice(slice.content, 0, 0),
              );
              view.dispatch(view.state.tr.replaceSelection(closed).scrollIntoView());
            } catch (err) {
              console.warn('[cardmirror] paste could not fit at this position:', err);
            }
            return true;
          }
        }
        // Clipboard image paste — screenshots, copy-image from a
        // browser, etc. Take precedence over text / HTML branches
        // when the clipboard carries `image/*` file data; users
        // pasting a screenshot don't want the fallback text label.
        //
        // EXCEPT when the clipboard ALSO carries meaningful text:
        // Word (and other rich editors) put a rendered bitmap of the
        // selection alongside the real text/html flavors, and letting
        // the bitmap win pasted a PICTURE of the copied cards (field
        // report 2026-07-15). Text flavors win whenever they have
        // actual content; the image branch is for image-only
        // clipboards, whose text/html — when present at all — is
        // just an <img> wrapper with no text of its own.
        const cd = event.clipboardData;
        const files = cd?.files;
        if (cd && files && files.length > 0) {
          const imageFile = Array.from(files).find((f) => f.type.startsWith('image/'));
          if (imageFile && !clipboardHasMeaningfulText(cd)) {
            event.preventDefault();
            void (async () => {
              const node = await buildImageNodeFromBlob(imageFile);
              if (node) insertImageNode(view, node);
            })();
            return true;
          }
        }
        const armed = isPlainPasteArmed(view.state);
        if (armed) {
          // Sticky-toggle behavior: plain-paste stays on until the user
          // explicitly turns it off (F2 again or the ribbon button).
          // Every Ctrl/Cmd+V while armed pastes plain.
          event.preventDefault();
          const raw = event.clipboardData?.getData('text/plain') ?? '';
          const text = normalizeClipboardTextForPaste(
            raw,
            view.state.selection.$from.parent.type.name,
          );
          if (!text) return true;
          const plainSlice = buildPlainTextSlice(text);
          // Same card_body pre-fit as `applyPlainPasteFromText` — see
          // the rationale comment there. Keeps the armed-paste path
          // (browser/web F2) in sync with the direct Electron F2 path.
          const pasteFrom = view.state.selection.from;
          let tr = tryPasteAsCardBodies(view.state, plainSlice);
          if (!tr) tr = view.state.tr.replaceSelection(plainSlice);
          tr.setStoredMarks([]);
          view.dispatch(tr.scrollIntoView().setMeta('uiEvent', 'paste'));
          if (ctx.condenseOnPaste()) condensePastedRange(view, pasteFrom, ctx);
          return true;
        }

        // Smart paste conversion: clipboard HTML that carries a strong
        // source signature (Word's document shell; haku's builder
        // fingerprint — see paste-dialect.ts) converts through the docx
        // importer's assembly path into real CardMirror structure:
        // cards, cites, headings, named-style marks, highlights,
        // numbering. Runs AFTER the F2 branch (explicit plain paste
        // always wins) and only when the setting is on. The converter
        // returns null when it finds no debate structure, so a
        // false-positive signature match falls through to the default
        // paths — never to mangled output.
        if (ctx.smartPasteConversion()) {
          const html = cd?.getData('text/html') ?? '';
          const dialect = detectPasteDialect(html);
          const converted =
            dialect === 'word'
              ? convertWordHtml(html)
              : dialect === 'haku'
                ? convertHakuHtml(html)
                : null;
          if (converted && converted.content.size) {
            event.preventDefault();
            const convSlice = new Slice(converted.content, 0, 0);
            // Same insertion ladder as the default paths below: fit
            // into the cursor's card, else split the container, else
            // body-then-structural, else a plain replace.
            let tr =
              tryPasteCardContent(view.state, convSlice) ??
              tryPasteSplitContainer(view.state, convSlice) ??
              tryPasteBodyThenStructural(view.state, convSlice);
            if (!tr) tr = view.state.tr.replaceSelection(convSlice);
            view.dispatch(tr.scrollIntoView().setMeta('uiEvent', 'paste'));
            return true;
          }
        }

        // Card-fitting FIRST. Content that BELONGS in the cursor's card — a
        // cite_paragraph / undertag / multiple body paragraphs, OR a cite/body
        // copied from inside a card (which serializes as a single OPEN `card`,
        // openStart>0, with its tag cut off) — must fit INTO the card. Doing it
        // before the split path keeps the split at the card_body level instead
        // of bubbling up to spawn a phantom empty-tag card sibling (the
        // "disconnected tag" bug). Bails for content that should WIN — a tag /
        // heading / closed whole card — which the split path below then handles.
        const cardBodyTr = tryPasteCardContent(view.state, slice);
        if (cardBodyTr) {
          event.preventDefault();
          view.dispatch(cardBodyTr.scrollIntoView().setMeta('uiEvent', 'paste'));
          return true;
        }

        // A structural-led paste (tag / analytic / heading / whole card) into
        // a card body splits the destination so the pasted structure wins.
        // Try the slice PM gave us first; if its head was flattened to inline
        // while fitting the cursor's body slot, recover the true structure by
        // re-parsing the clipboard HTML at the doc level. The reparsed (flat,
        // doc-level) slice is also what the body-then-structural path below
        // wants, so compute it once, lazily.
        let reparsed: Slice | null | undefined;
        const getReparsed = (): Slice | null => {
          if (reparsed === undefined) reparsed = reparseClipboardStructuralSlice(event);
          return reparsed;
        };

        let splitTr = tryPasteSplitContainer(view.state, slice);
        if (!splitTr) {
          const r = getReparsed();
          if (r) splitTr = tryPasteSplitContainer(view.state, r);
        }
        if (splitTr) {
          event.preventDefault();
          view.dispatch(splitTr.scrollIntoView().setMeta('uiEvent', 'paste'));
          return true;
        }

        // A paste that LEADS with body content then turns structural (a
        // paragraph copied with a following heading / card) — neither path above
        // catches it. Merge the body into the cursor's card, then split at the
        // structural node. Prefer the reparsed flat slice; fall back to the raw
        // slice when there's no clipboard HTML.
        const r = getReparsed();
        let mixedTr = r ? tryPasteBodyThenStructural(view.state, r) : null;
        if (!mixedTr) mixedTr = tryPasteBodyThenStructural(view.state, slice);
        if (mixedTr) {
          event.preventDefault();
          view.dispatch(mixedTr.scrollIntoView().setMeta('uiEvent', 'paste'));
          return true;
        }

        return false;
      },
    },
  });
}

/**
 * Strip single-cell layout tables from a clipboard slice. Source
 * HTML routinely wraps blocks in `<table>` as a layout primitive
 * (Google Docs published views, news-site article bodies, marketing
 * emails, .docx page-frame copies). PM's default clipboard parser
 * preserves those tables, leaving text trapped inside a `table_cell`
 * — which `isolating: true` walls off from Backspace/Delete and
 * which renders inset because of cell padding. The empty-1×1
 * degenerate of the same shape is the "intermediate undeletable
 * line" users see between a tag/cite and freshly-pasted body text.
 *
 * "Single-cell" = every row has exactly one cell. Multi-cell-per-row
 * tables (real data tables) pass through unchanged. Cells with
 * only-empty paragraphs lift to nothing, so empty 1×1 tables drop
 * out of the slice entirely.
 *
 * Runs inside `transformPasted`, before head-detect / card-body
 * fitting see the slice. Emits generic `paragraph` nodes at the
 * slice root (PM's contextual fit + `tryPasteAsCardBodies` adapt
 * them to a card_body slot); when the table sits inside a `card`
 * or `analytic_unit` in the slice itself (whole-card paste case),
 * emits `card_body` to satisfy the parent's content rule directly.
 *
 * Exported for tests.
 */
export function unwrapSingleCellTables(slice: Slice): Slice {
  const transformed = transformFragmentUnwrap(slice.content, null);
  if (transformed === slice.content) return slice;
  return new Slice(transformed, slice.openStart, slice.openEnd);
}

function transformFragmentUnwrap(
  fragment: Fragment,
  parentName: string | null,
): Fragment {
  let changed = false;
  const out: PMNode[] = [];
  fragment.forEach((child) => {
    if (child.type.name === 'table' && isSingleCellTable(child)) {
      changed = true;
      out.push(...liftSingleCellTable(child, parentName));
      return;
    }
    if (!child.isLeaf && child.content.size > 0) {
      const inner = transformFragmentUnwrap(child.content, child.type.name);
      if (inner !== child.content) {
        changed = true;
        out.push(child.copy(inner));
        return;
      }
    }
    out.push(child);
  });
  return changed ? Fragment.fromArray(out) : fragment;
}

function isSingleCellTable(table: PMNode): boolean {
  if (table.childCount === 0) return false;
  for (let i = 0; i < table.childCount; i++) {
    const row = table.child(i);
    if (row.type.name !== 'table_row') return false;
    if (row.childCount !== 1) return false;
  }
  return true;
}

function liftSingleCellTable(
  table: PMNode,
  parentName: string | null,
): PMNode[] {
  const wrapTypeName =
    parentName === 'card' || parentName === 'analytic_unit'
      ? 'card_body'
      : 'paragraph';
  const wrapType = schema.nodes[wrapTypeName];
  if (!wrapType) return [];
  const out: PMNode[] = [];
  table.forEach((row) => {
    row.forEach((cell) => {
      cell.forEach((para) => {
        if (para.content.size === 0) return;
        out.push(wrapType.create(null, para.content));
      });
    });
  });
  return out;
}

/**
 * When a pasted slice leads with structural content — a `tag` / `analytic`
 * head, a doc-level heading (`pocket` / `hat` / `block`), or a whole
 * `card` / `analytic_unit` — and the cursor sits in a body slot of a
 * `card` / `analytic_unit`, split the destination so the pasted structure
 * WINS rather than being demoted to body text. Returns null otherwise so PM
 * handles the paste normally.
 *
 * The whole pasted structure is preserved (head AND its content), not just the
 * head: the clipboard's flat, open `[tag, card_body, …]` shape is re-grouped
 * into proper `card` / `analytic_unit` nodes first (`groupStructuralNodes`).
 * The destination splits at the cursor — the original container keeps the
 * pre-cursor children + pre-cursor body text; the pasted nodes land after it;
 * and the post-cursor remainder (post-body + following children) is absorbed
 * by the LAST pasted container (so two clean cards result, no phantom
 * empty-tag sibling). When the paste ends in a doc-level heading instead, the
 * remainder is ejected to the doc root and lifted.
 *
 * Exported for unit tests.
 */
export function tryPasteSplitContainer(
  state: EditorState,
  slice: Slice,
): Transaction | null {
  if (slice.content.childCount === 0) return null;
  const lead = slice.content.firstChild;
  if (!lead) return null;
  // Must lead with structural content; a plain body/inline paste falls through.
  if (!STRUCTURAL_HEAD_NAMES.has(lead.type.name) && !STRUCTURAL_CONTAINERS.has(lead.type.name)) {
    return null;
  }

  const flat: PMNode[] = [];
  slice.content.forEach((n) => flat.push(n));
  return buildContainerSplit(state, flat, []);
}

/**
 * Merge a leading run of pasted body content into the pre-cursor content of a
 * container split. The FIRST body paragraph merges INLINE into the cursor's body
 * (continuing the line); subsequent body paragraphs become their own `card_body`
 * blocks (paragraph breaks preserved); a typed node (`cite_paragraph` /
 * `undertag`) flushes the running body and lands as its own card child. Used by
 * the A4 path (`tryPasteBodyThenStructural`); the plain split passes an empty
 * prefix, which just yields the pre-cursor body (or nothing).
 */
function mergeBodyPrefix(
  preContent: Fragment,
  prefix: PMNode[],
  bodyType: NodeType,
): PMNode[] {
  const out: PMNode[] = [];
  let cur: Fragment | null = preContent.size > 0 ? preContent : null;
  let leadOpen = true; // the lead body can still absorb the first body inline
  for (const node of prefix) {
    if (BODY_PASTE_TYPES.has(node.type.name)) {
      if (leadOpen) {
        cur = (cur ?? Fragment.empty).append(node.content);
        leadOpen = false;
      } else {
        if (cur) out.push(bodyType.create(null, cur));
        cur = null;
        out.push(schema.nodes['card_body']!.create(null, node.content));
      }
    } else {
      if (cur) out.push(bodyType.create(null, cur));
      cur = null;
      leadOpen = false;
      out.push(fitForCard(node));
    }
  }
  if (cur) out.push(bodyType.create(null, cur));
  return out;
}

/**
 * Split the cursor's `card` / `analytic_unit` at the cursor and insert
 * `structuralFlat` (re-grouped into proper containers) after it, with any
 * leading `bodyPrefix` merged into the pre-cursor content. The destination keeps
 * its pre-cursor children + pre-cursor body (+ prefix); the pasted structure
 * lands after; the post-cursor remainder is absorbed by the LAST pasted
 * container, or lifted to the doc root when the paste ends in a doc-level
 * heading. Returns null when the cursor isn't in a splittable body slot.
 */
function buildContainerSplit(
  state: EditorState,
  structuralFlat: PMNode[],
  bodyPrefix: PMNode[],
): Transaction | null {
  const $from = state.selection.$from;
  if ($from.depth !== 2) return null;
  const cursorBody = $from.parent;
  if (!SPLITTABLE_BODY_SLOTS.has(cursorBody.type.name)) return null;
  const container = $from.node(1);
  if (!STRUCTURAL_CONTAINERS.has(container.type.name)) return null;

  let cursorIndex = -1;
  container.forEach((child, _o, idx) => {
    if (cursorIndex === -1 && child === cursorBody) cursorIndex = idx;
  });
  if (cursorIndex < 1) return null;

  // Re-group the (possibly flat, open) pasted nodes into doc-level containers.
  const pastedNodes = groupStructuralNodes(structuralFlat);
  if (pastedNodes.length === 0) return null;

  const parentOffset = $from.parentOffset;
  const preContent = cursorBody.content.cut(0, parentOffset);
  const postContent = cursorBody.content.cut(parentOffset);

  const beforeChildren: PMNode[] = [];
  const followingChildren: PMNode[] = [];
  container.forEach((child, _o, idx) => {
    if (idx < cursorIndex) beforeChildren.push(child);
    else if (idx > cursorIndex) followingChildren.push(child);
  });

  const bodyType = cursorBody.type;
  // Pre-cursor content (with any pasted body prefix merged in) + post-cursor tail.
  const preChildren = mergeBodyPrefix(preContent, bodyPrefix, bodyType);
  const postBody = postContent.size > 0 ? bodyType.create(null, postContent) : null;

  const originalChildren = [...beforeChildren, ...preChildren];
  const originalContainer = container.copy(Fragment.fromArray(originalChildren));

  // The destination's post-cursor remainder.
  const remainder: PMNode[] = [];
  if (postBody) remainder.push(postBody);
  remainder.push(...followingChildren);

  // Absorb the remainder into the LAST pasted container, or — if the paste
  // ends in a doc-level heading — eject + lift it to the doc root after.
  const last = pastedNodes[pastedNodes.length - 1]!;
  const lastName = last.type.name;
  let trailing: PMNode[] = [];
  // Size of the last pasted container's OWN children — recorded before
  // the destination's remainder is absorbed after them, so the
  // end-of-paste cursor mode can stop at the true pasted/absorbed
  // boundary instead of after content the user never pasted.
  let lastOwnKidsSize: number | null = null;
  if (lastName === 'card' || lastName === 'analytic_unit') {
    const fit = lastName === 'card' ? fitForCard : fitForAnalyticUnit;
    const lastKids: PMNode[] = [];
    last.forEach((c) => lastKids.push(c));
    lastOwnKidsSize = lastKids.reduce((sum, k) => sum + k.nodeSize, 0);
    pastedNodes[pastedNodes.length - 1] = last.copy(
      Fragment.fromArray([...lastKids, ...remainder.map(fit)]),
    );
  } else {
    trailing = remainder.map(liftToDocRoot);
  }

  const containerFrom = $from.before(1);
  const containerTo = $from.after(1);
  const replacement = Fragment.fromArray([originalContainer, ...pastedNodes, ...trailing]);
  let tr = state.tr.replaceWith(containerFrom, containerTo, replacement);

  // Cursor placement, per the `pasteCursor` setting.
  //  'after' (default): the end of the pasted content — like every other
  //    paste. When the destination's post-cursor remainder was absorbed
  //    into the last pasted container, "end of pasted" is the boundary
  //    BEFORE that remainder (content the user never pasted).
  //  'tag': the end of the FIRST pasted head's text — the F7/setHeading
  //    convention, so the user can immediately rename the heading.
  const afterOriginal = containerFrom + originalContainer.nodeSize;
  let cursorPos: number;
  if (settings.get('pasteCursor') === 'tag') {
    const firstDoc = pastedNodes[0]!;
    const head = STRUCTURAL_CONTAINERS.has(firstDoc.type.name) ? firstDoc.firstChild : firstDoc;
    cursorPos = STRUCTURAL_CONTAINERS.has(firstDoc.type.name)
      ? afterOriginal + 2 + (head?.content.size ?? 0) // +1 into container, +1 into head
      : afterOriginal + 1 + (head?.content.size ?? 0); // +1 into the heading
  } else if (lastOwnKidsSize !== null) {
    const beforeLast = pastedNodes
      .slice(0, -1)
      .reduce((sum, n) => sum + n.nodeSize, 0);
    // +1 enters the last pasted container; stop after its own kids.
    cursorPos = afterOriginal + beforeLast + 1 + lastOwnKidsSize;
  } else {
    cursorPos = afterOriginal + pastedNodes.reduce((sum, n) => sum + n.nodeSize, 0);
  }
  try {
    if (settings.get('pasteCursor') === 'tag') {
      tr = tr.setSelection(TextSelection.create(tr.doc, cursorPos));
    } else {
      // Snap to the nearest valid text position at/before the boundary —
      // the end of the last pasted textblock.
      tr = tr.setSelection(Selection.near(tr.doc.resolve(cursorPos), -1));
    }
  } catch {
    /* schema rejected the position — selection stays where PM left it */
  }
  return tr;
}

/**
 * A pasted slice that LEADS with body content and THEN contains structural
 * content (a heading / tag / analytic / whole card) — e.g. a paragraph copied
 * together with a following heading. Neither `tryPasteCardContent` (bails on the
 * structural node) nor `tryPasteSplitContainer` (bails on the non-structural
 * lead) catches it, so it would otherwise fall to PM's default fitter and split
 * the card. Merge the leading body into the cursor's card, then split the card
 * at the first structural node — the same result as the structural-led split,
 * with the body prefix folded into the pre-cursor content.
 *
 * Cursor only (a range paste of this shape is left to the default path).
 * Exported for unit tests.
 */
export function tryPasteBodyThenStructural(
  state: EditorState,
  slice: Slice,
): Transaction | null {
  if (slice.content.childCount === 0) return null;
  const sel = state.selection;
  if (!(sel instanceof TextSelection) || sel.from !== sel.to) return null;

  const flat: PMNode[] = [];
  slice.content.forEach((n) => flat.push(n));

  // Split at the first structural node; everything before it must be fittable.
  let k = -1;
  for (let i = 0; i < flat.length; i++) {
    const name = flat[i]!.type.name;
    if (STRUCTURAL_HEAD_NAMES.has(name) || STRUCTURAL_CONTAINERS.has(name)) {
      k = i;
      break;
    }
  }
  if (k <= 0) return null; // no structural node, or it leads (handled elsewhere)
  const prefix = flat.slice(0, k);
  if (!prefix.every((n) => CARD_FITTABLE_PASTE.has(n.type.name))) return null;
  const rest = flat.slice(k);

  return buildContainerSplit(state, rest, prefix);
}

/**
 * Pre-fit a multi-paragraph PLAIN-TEXT paste into a `card_body` cursor:
 * convert each top-level paragraph in the slice to a `card_body` and
 * `replaceSelection`, so PM splits WITHIN the card instead of bubbling the
 * split up to the card level (which would spawn a phantom empty-tag sibling).
 * Used by the F2 / plain-text paste path. Returns null unless the slice is 2+
 * plain paragraphs and the cursor is in a `card_body` inside a card /
 * analytic_unit — a lone paragraph falls through to PM's inline merge.
 *
 * (Rich pastes of cite / undertag / body content go through
 * `tryPasteCardContent`, which implements the full card-paste matrix.)
 *
 * Exported for tests.
 */
export function tryPasteAsCardBodies(
  state: EditorState,
  slice: Slice,
): Transaction | null {
  if (slice.content.childCount < 2) return null;
  for (let i = 0; i < slice.content.childCount; i++) {
    if (slice.content.child(i).type.name !== 'paragraph') return null;
  }
  const sel = state.selection;
  if (!(sel instanceof TextSelection)) return null;
  const $from = sel.$from;
  if ($from.parent.type.name !== 'card_body') return null;
  if ($from.depth < 2) return null;
  const container = $from.node($from.depth - 1);
  if (container.type.name !== 'card' && container.type.name !== 'analytic_unit') {
    return null;
  }
  const cardBodyType = schema.nodes['card_body'];
  if (!cardBodyType) return null;
  const converted: PMNode[] = [];
  slice.content.forEach((p) => converted.push(cardBodyType.create(null, p.content)));
  const newSlice = new Slice(
    Fragment.fromArray(converted),
    slice.openStart,
    slice.openEnd,
  );
  return state.tr.replace(sel.from, sel.to, newSlice);
}

/** Pasted blocks that are body text (vs. a structural label). */
const BODY_PASTE_TYPES = new Set<string>(['card_body', 'paragraph']);
/** Textblocks that ABSORB pasted body text inline (content, not a label). */
const CONTENT_TEXTBLOCKS = new Set<string>(['card_body', 'cite_paragraph']);
/** Card-content slots the cursor can sit in that we fit a paste into. */
const CARD_CONTENT_SLOTS = new Set<string>([
  'card_body',
  'cite_paragraph',
  'undertag',
]);

/**
 * Fit a paste of card content (`cite_paragraph` / `undertag` / body) at the
 * cursor, per the card-paste matrix:
 *  - NEVER breaks the card; pasted block types are preserved.
 *  - Body text is absorbed INLINE into a `card_body` / `cite_paragraph`, and a
 *    same-type paste (cite→cite, undertag→undertag) merges; otherwise the block
 *    inserts as its OWN type, splitting the cursor's block (coalescing empty
 *    edges so there's no stray blank line).
 *  - An EMPTY target block is OVERWRITTEN.
 *  - OUTSIDE a card, content drops in loose (body → `paragraph`).
 *  - Pasting OVER a range selection collapses it first (the selected text is
 *    dropped), then the same matrix runs at the cursor — so pasting over a
 *    paragraph / selection inside a card never tears the card apart either.
 * Returns null for a `tag` / `analytic` / heading / whole closed `card` lead, so
 * the split path handles it — those SHOULD start a new card. Also null when a
 * range selection crosses a structural boundary (into a tag/heading, or between
 * two cards), leaving that rarer case to the default/split path.
 *
 * Exported for tests.
 */
export function tryPasteCardContent(
  state: EditorState,
  slice: Slice,
): Transaction | null {
  if (slice.content.childCount === 0) return null;

  // Unwrap a leading open card / analytic_unit (cite/body copied from inside a
  // card serializes WITH its container — openStart > 0, the tag cut off).
  const lead = slice.content.firstChild!;
  const unwrap =
    slice.content.childCount === 1 &&
    STRUCTURAL_CONTAINERS.has(lead.type.name) &&
    slice.openStart > 0;
  const srcFrag = unwrap ? lead.content : slice.content;
  if (srcFrag.childCount === 0) return null;

  // Every source block must be card-fittable; a tag / analytic / heading /
  // whole card lead bails to the split path — that one breaks the card.
  const blocks: PMNode[] = [];
  let fittable = true;
  srcFrag.forEach((b) => {
    if (!CARD_FITTABLE_PASTE.has(b.type.name)) fittable = false;
    blocks.push(b);
  });
  if (!fittable) return null;

  const sel = state.selection;
  if (!(sel instanceof TextSelection)) return null;

  // Inside a card / analytic_unit? (decided from the selection anchor).
  let inCard = false;
  for (let d = sel.$from.depth; d >= 1; d--) {
    if (STRUCTURAL_CONTAINERS.has(sel.$from.node(d).type.name)) {
      inCard = true;
      break;
    }
  }

  // A RANGE selection — pasting OVER a paragraph / selection — must collapse to a
  // cursor FIRST, then fit. Otherwise PM's default replace of the open-card slice
  // over the range tears the card apart (a phantom empty-tag sibling). Only do
  // this when the whole selection stays in card-content textblocks of a SINGLE
  // container; a selection that reaches into a tag/heading or spans two cards
  // falls through to the default/split path so it isn't silently mangled.
  const tr = state.tr;
  if (sel.from !== sel.to) {
    if (!rangeFitsInOneContainer(sel.$from, sel.$to, inCard)) return null;
    tr.delete(sel.from, sel.to);
  }
  const $from = tr.selection.$from;

  // Outside a card → drop loose; body becomes a plain paragraph.
  if (!inCard) return fitBlocks(tr, blocks, $from, 'paragraph');

  // Cursor must be in a card-content slot (not the tag / analytic head).
  if (!CARD_CONTENT_SLOTS.has($from.parent.type.name)) return null;

  return fitBlocks(tr, blocks, $from, 'card_body');
}

/** Start position of the enclosing `card` / `analytic_unit`, or -1 at the doc
 *  root. Two positions with the same value live in the same container. */
function enclosingContainerStart($pos: ResolvedPos): number {
  for (let d = $pos.depth; d >= 1; d--) {
    if (STRUCTURAL_CONTAINERS.has($pos.node(d).type.name)) return $pos.before(d);
  }
  return -1;
}

/** A range paste is fit in place only when both ends sit in card-content
 *  textblocks of the SAME card (or both at the doc root, outside any card).
 *  Anything crossing a structural boundary — into a tag/heading, or from one
 *  card into another — is left to the default/split path so containers are
 *  never merged or torn. */
function rangeFitsInOneContainer(
  $from: ResolvedPos,
  $to: ResolvedPos,
  inCard: boolean,
): boolean {
  const inSlot = (p: ResolvedPos): boolean =>
    inCard
      ? CARD_CONTENT_SLOTS.has(p.parent.type.name)
      : p.parent.type.name === 'paragraph';
  if (!inSlot($from) || !inSlot($to)) return false;
  return enclosingContainerStart($from) === enclosingContainerStart($to);
}

/**
 * Place `blocks` at the cursor per the card-paste matrix. `bodyType` is what a
 * body block becomes — `card_body` inside a card, `paragraph` at the doc level.
 * A single block MERGES inline into a body-absorbing textblock (or its own type);
 * otherwise blocks insert as their own type, splitting the cursor's block and
 * coalescing empty edges. An EMPTY target is overwritten (filled), not split.
 * The cursor lands at the END of the pasted content, matching the in-card / F2
 * paste paths (so the user keeps typing after what they pasted).
 *
 * Operates on a caller-supplied `tr` whose selection is the (now collapsed)
 * insertion cursor — for a range paste the caller has already deleted the
 * selection, so `tr.selection` is the resulting cursor and `$from` resolves it.
 */
function fitBlocks(
  tr: Transaction,
  blocks: PMNode[],
  $from: ResolvedPos,
  bodyType: 'card_body' | 'paragraph',
): Transaction {
  const sel = tr.selection;
  const Bt = $from.parent.type.name;
  const Bempty = $from.parent.content.size === 0;
  // The destination's own bodyType textblock absorbs body text too (e.g. a
  // plain paragraph at the doc level behaves like a card_body inside a card).
  const absorbsBody = (t: string): boolean =>
    CONTENT_TEXTBLOCKS.has(t) || t === bodyType;

  // A single block can MERGE inline; a multi-block run always lands as blocks.
  if (blocks.length === 1 && !Bempty) {
    const P = blocks[0]!;
    const Pt = P.type.name;
    if ((BODY_PASTE_TYPES.has(Pt) && absorbsBody(Bt)) || Pt === Bt) {
      tr.replaceWith(sel.from, sel.to, P.content); // absorb inline; cursor after
      return tr;
    }
  }

  // Body → bodyType; cite / undertag keep their own type.
  const frag = Fragment.fromArray(
    blocks.map((b) =>
      BODY_PASTE_TYPES.has(b.type.name)
        ? schema.nodes[bodyType]!.create(null, b.content)
        : b,
    ),
  );

  let insertAt: number;
  if (Bempty) {
    insertAt = $from.before();
    tr.replaceWith($from.before(), $from.after(), frag); // fill the empty target
  } else if (sel.from === $from.start()) {
    insertAt = $from.before();
    tr.insert($from.before(), frag); // before B — no empty pre-edge
  } else if (sel.from === $from.end()) {
    insertAt = $from.after();
    tr.insert($from.after(), frag); // after B — no empty post-edge
  } else {
    tr.replaceSelection(new Slice(frag, 0, 0)); // split B, insert between
    return tr; // replaceSelection already lands the cursor after the content
  }
  // Land the cursor at the END of the pasted run (matches in-card / F2).
  tr.setSelection(Selection.near(tr.doc.resolve(insertAt + frag.size), -1));
  return tr;
}

/**
 * Re-parse the clipboard's `text/html` at the DOC level — no `context: $from`,
 * so PM's parser doesn't demote structural heads to fit the cursor's body slot.
 * Used as a fallback when the slice PM handed us has already had its leading
 * head flattened to inline content (it can, when fitting the slice to a
 * `card_body`'s `inline*` rule), so `tryPasteSplitContainer` can still recover
 * the true structure. Re-applies the plugin's `transformPasted` normalization
 * (fresh heading ids + single-cell-table unwrap), which the raw re-parse
 * bypasses. Returns null when there's no HTML or no DOM (headless).
 *
 * Exported for tests.
 */
export function reparseClipboardStructuralSlice(event: ClipboardEvent): Slice | null {
  if (typeof document === 'undefined') return null;
  const html = event.clipboardData?.getData('text/html') ?? '';
  if (!html) return null;
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  const parsed = PMDOMParser.fromSchema(schema).parseSlice(wrap);
  if (parsed.content.childCount === 0) return null;
  return freshHeadingIds(unwrapSingleCellTables(parsed));
}
