/**
 * Footnote popover — click a footnote/endnote marker to read the note
 * body in a small floating panel; links inside notes are clickable,
 * and a plain-text editor covers light corrections (formatting within
 * an edited note is dropped — the trade the simplified-run model
 * makes; see schema/footnotes.ts).
 *
 * One popover at a time, module-level (mirrors the color picker's
 * open/dismiss pattern). Dismissed on outside pointerdown, Escape,
 * or view destroy.
 */

import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import {
  footnotePlainText,
  plainTextToFootnoteContent,
  type FootnoteContent,
  type FootnoteRun,
} from '../schema/footnotes.js';
import { isAnyOverlayOpen } from './overlay-stack.js';

let openEl: HTMLElement | null = null;
let dismiss: (() => void) | null = null;

function closePopover(): void {
  dismiss?.();
  dismiss = null;
  openEl?.remove();
  openEl = null;
}

function renderRun(run: FootnoteRun): HTMLElement {
  const el = document.createElement(run.link ? 'a' : 'span');
  el.textContent = run.text;
  if (run.bold) el.style.fontWeight = '700';
  if (run.italic) el.style.fontStyle = 'italic';
  if (run.underline) el.style.textDecoration = 'underline';
  if (run.link && el instanceof HTMLAnchorElement) {
    el.href = run.link;
    el.target = '_blank';
    el.rel = 'noopener noreferrer';
  }
  return el;
}

function showPopover(view: EditorView, node: PMNode, nodePos: number, edit = false): void {
  closePopover();

  const kind = String(node.attrs['kind'] ?? 'footnote');
  const content = (node.attrs['content'] ?? []) as FootnoteContent;

  const pop = document.createElement('div');
  pop.className = 'pmd-footnote-popover';

  const title = document.createElement('div');
  title.className = 'pmd-footnote-popover-title';
  title.textContent = kind === 'endnote' ? 'Endnote' : 'Footnote';
  pop.appendChild(title);

  const body = document.createElement('div');
  body.className = 'pmd-footnote-popover-body';
  if (content.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'pmd-footnote-popover-empty';
    empty.textContent = '(empty note)';
    body.appendChild(empty);
  } else {
    for (const para of content) {
      const p = document.createElement('p');
      for (const run of para) p.appendChild(renderRun(run));
      body.appendChild(p);
    }
  }
  pop.appendChild(body);

  // Plain-text editing. Swaps the body for a textarea; Save rewrites
  // the node's content attr in one transaction (undoable normally).
  const actions = document.createElement('div');
  actions.className = 'pmd-footnote-popover-actions';
  const enterEditMode = (): void => {
    const area = document.createElement('textarea');
    area.className = 'pmd-footnote-popover-textarea';
    area.value = footnotePlainText(content);
    body.replaceChildren(area);
    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'pmd-footnote-popover-btn';
    save.textContent = 'Save';
    save.addEventListener('click', () => {
      const current = view.state.doc.nodeAt(nodePos);
      if (current && current.type.name === 'footnote') {
        view.dispatch(
          view.state.tr.setNodeMarkup(nodePos, undefined, {
            ...current.attrs,
            content: plainTextToFootnoteContent(area.value),
          }),
        );
      }
      closePopover();
      view.focus();
    });
    actions.replaceChildren(save);
    area.focus();
  };
  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'pmd-footnote-popover-btn';
  editBtn.textContent = 'Edit';
  editBtn.addEventListener('click', enterEditMode);
  actions.appendChild(editBtn);
  // Delete removes the marker (and with it the note). Backspace over
  // the marker in the document does the same — this is the discoverable
  // route.
  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'pmd-footnote-popover-btn pmd-footnote-popover-delete';
  delBtn.textContent = 'Delete';
  delBtn.addEventListener('click', () => {
    const current = view.state.doc.nodeAt(nodePos);
    if (current && current.type.name === 'footnote') {
      view.dispatch(view.state.tr.delete(nodePos, nodePos + current.nodeSize));
    }
    closePopover();
    view.focus();
  });
  actions.appendChild(delBtn);
  pop.appendChild(actions);

  document.body.appendChild(pop);

  // Below the marker, clamped to the viewport.
  const coords = view.coordsAtPos(nodePos);
  const rect = pop.getBoundingClientRect();
  const left = Math.max(8, Math.min(coords.left, window.innerWidth - rect.width - 8));
  const top =
    coords.bottom + rect.height + 8 > window.innerHeight
      ? Math.max(8, coords.top - rect.height - 4)
      : coords.bottom + 4;
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;

  const onDown = (e: PointerEvent): void => {
    if (openEl && e.target instanceof Node && openEl.contains(e.target)) return;
    closePopover();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return;
    // A modal dialog stacked above owns the keyboard — its Escape must
    // not also dismiss the popover underneath.
    if (isAnyOverlayOpen()) return;
    e.preventDefault();
    e.stopPropagation();
    closePopover();
  };
  document.addEventListener('pointerdown', onDown, true);
  document.addEventListener('keydown', onKey, true);
  openEl = pop;
  dismiss = () => {
    document.removeEventListener('pointerdown', onDown, true);
    document.removeEventListener('keydown', onKey, true);
  };
  if (edit) enterEditMode();
}

/** Open the popover straight into edit mode for the footnote node at
 *  `nodePos` — the Insert Footnote command's entry point (type the
 *  note immediately after inserting the marker). */
export function openFootnoteEditor(view: EditorView, nodePos: number): void {
  const node = view.state.doc.nodeAt(nodePos);
  if (!node || node.type.name !== 'footnote') return;
  showPopover(view, node, nodePos, true);
}

export const footnotePopoverKey = new PluginKey('pmd-footnote-popover');

export function footnotePopoverPlugin(): Plugin {
  return new Plugin({
    key: footnotePopoverKey,
    props: {
      handleClickOn(view, _pos, node, nodePos) {
        if (node.type.name !== 'footnote') return false;
        showPopover(view, node, nodePos);
        return true;
      },
    },
    view() {
      return { destroy: () => closePopover() };
    },
  });
}
