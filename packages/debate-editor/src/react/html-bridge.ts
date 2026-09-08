/**
 * HTML <-> CardMirror-doc bridge.
 *
 * debate-ai.com persists speech-doc content as an HTML string (the
 * contract the prior Lexical/TipTap editors used — see `ReasonEditorProps`
 * in the reason-editor package this replaces). CardMirror itself has no
 * HTML import/export — its own persistence is `.docx` / `.cmir` — but its
 * ProseMirror schema (`../schema/index.js`) carries full `toDOM`/`parseDOM`
 * specs (needed for copy-paste and its own rendering), so the standard
 * ProseMirror `DOMSerializer`/`DOMParser` utilities round-trip through that
 * schema directly, using CardMirror's own semantic markup.
 *
 * Because that string IS the stored document for those hosts, a parse that
 * quietly produces nothing is data loss, not a rendering glitch: the blank
 * doc mounts, the editor reports it as the document's new content, and the
 * saved file is overwritten with emptiness. So the parse reports whether it
 * actually understood its input (`parseHtml`) and the caller decides —
 * `singleton.claim()` refuses to mount, and refuses to save over, a document
 * whose stored content it could not read.
 */

import { DOMParser as PMDOMParser, DOMSerializer, type Node as PMNode } from 'prosemirror-model';
import { schema } from '../schema/index.js';
import { makeBlankDoc } from '../editor/blank-doc.js';

const serializer = DOMSerializer.fromSchema(schema);
const parser = PMDOMParser.fromSchema(schema);

/** Serialize a CardMirror doc node to an HTML string. */
export function docToHtml(doc: PMNode): string {
  const wrapper = document.createElement('div');
  wrapper.appendChild(serializer.serializeFragment(doc.content));
  return wrapper.innerHTML;
}

/** True when `doc` carries nothing a reader would see — no text, and no
 *  atom node (image, footnote ref) that renders without text. The empty
 *  paragraph `makeBlankDoc()` produces is blank by this test, which is the
 *  point: it's what an unreadable load and a genuinely empty document both
 *  come out as, and only the input tells them apart. */
export function isBlankDoc(doc: PMNode): boolean {
  if (doc.textContent.trim() !== '') return false;
  let hasAtom = false;
  doc.descendants((node) => {
    if (hasAtom) return false;
    if (node.isAtom && !node.isText) hasAtom = true;
    return !hasAtom;
  });
  return !hasAtom;
}

/** Does this HTML claim to carry something? Text, or an element that renders
 *  on its own. Used only to tell "the document is empty" apart from "the
 *  document didn't survive parsing". */
function htmlLooksNonEmpty(wrapper: HTMLElement): boolean {
  if ((wrapper.textContent ?? '').trim() !== '') return true;
  return wrapper.querySelector('img, sup, table, hr, br, [data-pmd-image]') !== null;
}

export interface ParsedHtml {
  /** The parsed document — `makeBlankDoc()` when `ok` is false. */
  doc: PMNode;
  /** False when non-empty input produced a blank document, or the parse
   *  threw. The caller must not treat `doc` as this document's content. */
  ok: boolean;
}

/** Parse an HTML string into a CardMirror doc, reporting whether the input
 *  actually survived. Empty input parses to a blank doc with `ok: true` (an
 *  empty document is a legitimate document); input that had content but came
 *  out blank — foreign markup from a previous editor, a malformed or
 *  truncated fragment — reports `ok: false` so the caller can leave the
 *  stored copy alone instead of overwriting it with the blank. */
export function parseHtml(html: string): ParsedHtml {
  if (!html || !html.trim()) return { doc: makeBlankDoc(), ok: true };
  let wrapper: HTMLElement;
  try {
    wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    const doc = parser.parse(wrapper);
    doc.check();
    if (isBlankDoc(doc) && htmlLooksNonEmpty(wrapper)) {
      console.warn('[debate-editor] parseHtml: content did not survive parsing');
      return { doc: makeBlankDoc(), ok: false };
    }
    return { doc, ok: true };
  } catch (err) {
    console.warn('[debate-editor] parseHtml: falling back to blank doc', err);
    return { doc: makeBlankDoc(), ok: false };
  }
}

/** Parse an HTML string into a CardMirror doc node. Empty/whitespace-only
 *  input, or HTML the parser can't fit to a valid document (foreign
 *  markup from a previous editor, malformed fragments), falls back to
 *  `makeBlankDoc()` rather than surfacing a load-time crash. Prefer
 *  {@link parseHtml} anywhere the result is about to replace stored
 *  content — this shape can't tell a blank document from a lost one. */
export function htmlToDoc(html: string): PMNode {
  return parseHtml(html).doc;
}
