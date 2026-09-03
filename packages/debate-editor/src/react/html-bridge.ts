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

/** Parse an HTML string into a CardMirror doc node. Empty/whitespace-only
 *  input, or HTML the parser can't fit to a valid document (foreign
 *  markup from a previous editor, malformed fragments), falls back to
 *  `makeBlankDoc()` rather than surfacing a load-time crash. */
export function htmlToDoc(html: string): PMNode {
  if (!html || !html.trim()) return makeBlankDoc();
  try {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    const doc = parser.parse(wrapper);
    doc.check();
    return doc;
  } catch (err) {
    console.warn('[debate-editor] htmlToDoc: falling back to blank doc', err);
    return makeBlankDoc();
  }
}
