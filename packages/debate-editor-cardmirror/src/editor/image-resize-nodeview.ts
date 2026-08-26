/**
 * Resizable image NodeView — gives editor images Word-style resize
 * handles. The image node stays an inline atom whose size is carried
 * by the existing `widthEmu` / `heightEmu` attrs (English Metric
 * Units, 9525 EMU per CSS pixel), so a resize round-trips straight to
 * the `.docx` `<wp:extent>` on export with no new metadata added to
 * the schema.
 *
 * The inner element is rendered by the schema's own `toDOM` (an
 * `<img>` for renderable formats, a placeholder `<span>` for EMF /
 * WMF / TIFF), so this view adds only a thin wrapper plus handles.
 * Handles are created lazily on selection and removed on deselect, so
 * an unselected image costs one extra wrapper span and nothing more —
 * keeping large multi-image documents light.
 */

import { DOMSerializer } from 'prosemirror-model';
import type { Node as PMNode } from 'prosemirror-model';
import type { EditorView, NodeView } from 'prosemirror-view';
import { NodeSelection } from 'prosemirror-state';
import { settings } from './settings.js';
import { transclusionNodeViews } from './transclusion-nodeview.js';
import { selfRefNodeViews } from './self-transclusion-nodeview.js';

const EMU_PER_PX = 9525;
const MIN_PX = 16;

/**
 * Eight Word-style handles: four corners resize proportionally
 * (aspect-locked), four edges resize a single axis (aspect unlocked).
 * For the edge handles to stay WYSIWYG, `renderInner` pins the image's
 * width AND height to the stored EMU dimensions (overriding the
 * schema's responsive `height: auto`), so what you drag is exactly what
 * exports. Handles are created only while the image is selected, so
 * unselected images carry no handle DOM.
 */
const HANDLE_DIRS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
type Dir = (typeof HANDLE_DIRS)[number];

/** Accumulated CSS `zoom` up the ancestor chain (editor panes zoom via
 *  the `zoom` property). Lets us convert screen-space pointer deltas
 *  into the element's own CSS pixels regardless of zoom level. */
function zoomFactorOf(el: HTMLElement): number {
  let z = 1;
  let n: HTMLElement | null = el;
  while (n) {
    const cz = parseFloat(getComputedStyle(n).zoom);
    if (Number.isFinite(cz) && cz > 0) z *= cz;
    n = n.parentElement;
  }
  return z > 0 ? z : 1;
}

class ImageResizeView implements NodeView {
  readonly dom: HTMLElement;
  private inner!: HTMLElement;
  private node: PMNode;
  private readonly view: EditorView;
  private readonly getPos: () => number | undefined;
  private handles: HTMLElement[] = [];
  private dragging = false;

  constructor(node: PMNode, view: EditorView, getPos: () => number | undefined) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    this.dom = document.createElement('span');
    this.dom.className = 'pmd-image-wrap';
    this.renderInner();
  }

  /** Render (or re-render) the schema's `<img>` / placeholder into the
   *  wrapper, then pin its display size to the stored EMU dimensions so
   *  an aspect-unlocked edge resize is WYSIWYG (the schema's default
   *  `height: auto` would otherwise snap the image back to its natural
   *  ratio, hiding a one-axis stretch). */
  private renderInner(): void {
    const spec = this.node.type.spec.toDOM?.(this.node);
    if (!spec) return;
    const { dom } = DOMSerializer.renderSpec(document, spec);
    const el = dom as HTMLElement;
    const widthEmu = Number(this.node.attrs['widthEmu'] ?? 0);
    const heightEmu = Number(this.node.attrs['heightEmu'] ?? 0);
    if (widthEmu > 0 && heightEmu > 0) {
      el.style.width = `${Math.round(widthEmu / EMU_PER_PX)}px`;
      el.style.height = `${Math.round(heightEmu / EMU_PER_PX)}px`;
      // Honor the explicit height (don't let the schema's `height: auto`
      // re-lock the aspect) and show the true set size like Word does.
      el.style.maxWidth = 'none';
    }
    if (this.inner) this.inner.replaceWith(el);
    else this.dom.appendChild(el);
    this.inner = el;
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    // Skip re-render mid-drag: the live inline styles are authoritative
    // until the drag commits the new EMU dimensions.
    if (!this.dragging) this.renderInner();
    return true;
  }

  selectNode(): void {
    this.dom.classList.add('ProseMirror-selectednode');
    if (settings.get('readMode') || !this.view.editable) return;
    this.addHandles();
  }

  deselectNode(): void {
    this.dom.classList.remove('ProseMirror-selectednode');
    this.removeHandles();
  }

  private addHandles(): void {
    if (this.handles.length) return;
    for (const dir of HANDLE_DIRS) {
      const h = document.createElement('span');
      h.className = `pmd-image-handle pmd-image-handle-${dir}`;
      h.addEventListener('pointerdown', (e) => this.startResize(e, dir));
      this.dom.appendChild(h);
      this.handles.push(h);
    }
  }

  private removeHandles(): void {
    for (const h of this.handles) h.remove();
    this.handles = [];
  }

  private startResize(e: PointerEvent, dir: Dir): void {
    e.preventDefault();
    e.stopPropagation();

    const z = zoomFactorOf(this.inner);
    const rect = this.inner.getBoundingClientRect();
    const startW = rect.width / z;
    const startH = rect.height / z;
    if (startW < 1 || startH < 1) return;
    const aspect = startW / startH;
    const startX = e.clientX;
    const startY = e.clientY;

    this.dragging = true;
    const prevMaxWidth = this.inner.style.maxWidth;
    // Let the image grow past the container width while dragging.
    this.inner.style.maxWidth = 'none';
    const handle = e.currentTarget as HTMLElement;
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      /* pointer capture is best-effort */
    }

    let w = startW;
    let h = startH;
    const west = dir === 'nw' || dir === 'w' || dir === 'sw';
    const east = dir === 'ne' || dir === 'e' || dir === 'se';
    const north = dir === 'nw' || dir === 'n' || dir === 'ne';
    const south = dir === 'sw' || dir === 's' || dir === 'se';
    const corner = (west || east) && (north || south);

    const onMove = (ev: PointerEvent): void => {
      const dx = (ev.clientX - startX) / z;
      const dy = (ev.clientY - startY) / z;
      if (corner) {
        // Corner: aspect-locked. Drive width from horizontal motion and
        // derive height so the image scales without distorting.
        const nextW = east ? startW + dx : startW - dx;
        w = Math.max(MIN_PX, nextW);
        h = w / aspect;
      } else {
        // Edge: aspect unlocked — resize only the dragged axis.
        if (east) w = Math.max(MIN_PX, startW + dx);
        else if (west) w = Math.max(MIN_PX, startW - dx);
        if (south) h = Math.max(MIN_PX, startH + dy);
        else if (north) h = Math.max(MIN_PX, startH - dy);
      }
      this.inner.style.width = `${Math.round(w)}px`;
      this.inner.style.height = `${Math.round(h)}px`;
    };

    const onUp = (): void => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      this.dragging = false;
      this.inner.style.maxWidth = prevMaxWidth;
      this.commit(Math.round(w), Math.round(h));
    };

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  }

  /** Write the new pixel dimensions back to the node as EMU. */
  private commit(wPx: number, hPx: number): void {
    const pos = this.getPos();
    if (pos == null) return;
    const live = this.view.state.doc.nodeAt(pos);
    if (!live || live.type.name !== 'image') return;
    const widthEmu = Math.max(0, Math.round(wPx * EMU_PER_PX));
    const heightEmu = Math.max(0, Math.round(hPx * EMU_PER_PX));
    if (live.attrs['widthEmu'] === widthEmu && live.attrs['heightEmu'] === heightEmu) {
      this.renderInner();
      return;
    }
    const tr = this.view.state.tr.setNodeMarkup(pos, undefined, {
      ...live.attrs,
      widthEmu,
      heightEmu,
    });
    // Keep the image selected after the resize so its handles stay up
    // for a follow-up drag (Word keeps the selection too).
    tr.setSelection(NodeSelection.create(tr.doc, pos));
    this.view.dispatch(tr);
  }

  /** Keep PM out of the handle-drag gestures; ordinary clicks on the
   *  image itself still fall through so it selects normally. */
  stopEvent(e: Event): boolean {
    const t = e.target as HTMLElement | null;
    return !!t?.classList?.contains('pmd-image-handle');
  }

  ignoreMutation(): boolean {
    return true;
  }

  destroy(): void {
    this.removeHandles();
  }
}

/** NodeView map shared by every editor surface (single-doc + panes). */
export const editorNodeViews = {
  image: (
    node: PMNode,
    view: EditorView,
    getPos: () => number | undefined,
  ): NodeView => new ImageResizeView(node, view, getPos),
  ...transclusionNodeViews,
  ...selfRefNodeViews,
};
