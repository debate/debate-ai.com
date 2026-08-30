/**
 * Image-insertion helpers. Shared between the ribbon button (file
 * picker → insert) and the paste-plugin (clipboard image → insert).
 *
 * The schema's `image` node carries base64-encoded bytes + content
 * type + dimensions in EMU (914400 per inch / 9525 per CSS pixel) —
 * the same shape the docx importer produces, so anything we insert
 * here round-trips through Save-As without further transformation.
 */

import type { EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { schema } from '../schema/index.js';

/** EMU-per-CSS-pixel constant. 914400 EMU per inch, 96 CSS px per
 *  inch → 9525 EMU per CSS px. Matches the importer / exporter. */
const EMU_PER_PX = 9525;

/** Browser-renderable formats we can measure via a transient
 *  `<img>` element. Other types (EMF, TIFF, etc.) round-trip
 *  through the schema but render as a placeholder span and we
 *  can't read their pixel dimensions from the browser, so we
 *  fall back to zero EMU which the exporter handles. */
const RENDERABLE = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/svg+xml',
]);

/**
 * Read a `File` / `Blob` and produce a schema `image` node ready
 * for `replaceSelectionWith`. Returns `null` if the file isn't a
 * recognizable image (no `image/*` MIME type, unreadable bytes,
 * etc.).
 *
 * Dimensions: for renderable formats we measure the natural pixel
 * size by loading the data URL into a transient `<img>` and
 * converting to EMU. For non-renderable formats (or measurement
 * failures) we emit zero EMU; the toDOM placeholder gracefully
 * handles that with a minimum-size box, and the exporter writes
 * the original dimensions back when bytes round-trip from disk.
 */
export async function buildImageNodeFromBlob(blob: Blob): Promise<PMNode | null> {
  if (!blob.type.startsWith('image/')) return null;
  const dataUrl = await blobToDataURL(blob);
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const contentType = match[1]!;
  const data = match[2]!;
  let widthEmu = 0;
  let heightEmu = 0;
  if (RENDERABLE.has(contentType)) {
    try {
      const dims = await measureImage(dataUrl);
      widthEmu = Math.round(dims.width * EMU_PER_PX);
      heightEmu = Math.round(dims.height * EMU_PER_PX);
    } catch {
      // Couldn't decode — fall back to zero dims so the node
      // still inserts. The exporter will emit a placeholder
      // size and the user can re-size later.
    }
  }
  return schema.nodes['image']!.createChecked({
    data,
    contentType,
    widthEmu,
    heightEmu,
    alt: '',
  });
}

/** Insert an image node at the editor's current selection. Returns
 *  `true` when the insertion succeeded, `false` when the selection
 *  context doesn't accept inline content (e.g., cursor sitting at
 *  the doc level between cards). */
export function insertImageNode(view: EditorView, node: PMNode): boolean {
  const { state } = view;
  const tr = state.tr;
  // `replaceSelectionWith` validates against the schema; if the
  // active textblock doesn't allow inline content the call is a
  // no-op and the doc stays unchanged. Detect that by comparing
  // `tr.docChanged` after the call.
  tr.replaceSelectionWith(node, false);
  if (!tr.docChanged) return false;
  view.dispatch(tr.scrollIntoView());
  return true;
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function measureImage(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('image decode failed'));
    img.src = dataUrl;
  });
}
