/**
 * Right-click context menu for image nodes inside the editor.
 *
 * Items: "Edit alt text…" (manual, no network), plus two AI actions —
 * "Generate alt text from image (AI)" and "Generate table from image
 * (AI)". The AI items are gated on `aiFeaturesEnabled` and an
 * Anthropic API key; when unmet they render disabled with a tooltip
 * explaining why, so the affordance stays discoverable.
 *
 * Reuses `nav-panel.ts`'s context-menu styling and
 * close-on-outside-click plumbing (`.pmd-nav-context-menu`) for
 * cross-surface consistency.
 */

import { Plugin } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { settings } from './settings.js';
import { runGenerateAltText, runGenerateTable } from './ai/image-ai.js';
import { AI_DISABLED_MESSAGE, AI_NO_KEY_MESSAGE, activeApiKey } from './ai/llm.js';
import { promptForText } from './text-prompt.js';

/** PM plugin. Installed via `buildEditorPlugins` so every editor
 *  view (single-doc + each multi-pane slot) picks it up. */
export const imageContextMenuPlugin: Plugin = new Plugin({
  props: {
    handleDOMEvents: {
      contextmenu(view, event) {
        const target = event.target as HTMLElement | null;
        if (!target) return false;
        const imgEl = target.closest?.('[data-pmd-image]') as HTMLElement | null;
        if (!imgEl) return false;

        const pos = posOfImageElement(view, imgEl);
        if (pos == null) return false;
        const node = view.state.doc.nodeAt(pos);
        if (!node || node.type.name !== 'image') return false;

        event.preventDefault();
        showImageContextMenu(event.clientX, event.clientY, view, pos, node);
        return true;
      },
    },
  },
});

/** Doc position of the image element. `posAtDOM(el, 0)` maps offset 0
 *  inside `el` — for an atomic inline image, the node's own start —
 *  so `doc.nodeAt(pos)` returns the image node itself. */
function posOfImageElement(view: EditorView, el: HTMLElement): number | null {
  try {
    return view.posAtDOM(el, 0);
  } catch {
    return null;
  }
}

interface MenuItem {
  label: string;
  /** Disabled items render greyed-out and don't fire. Used for AI
   *  options when AI features are off / no API key. */
  disabled?: boolean;
  /** Tooltip text — explains the disabled state. */
  title?: string;
  action: () => void;
}

let openMenuEl: HTMLElement | null = null;

function showImageContextMenu(
  x: number,
  y: number,
  view: EditorView,
  imagePos: number,
  imageNode: PMNode,
): void {
  closeImageContextMenu();

  const aiOn = settings.get('aiFeaturesEnabled');
  const hasKey = activeApiKey() !== '';
  const aiBlockedReason =
    !aiOn ? AI_DISABLED_MESSAGE
    : !hasKey ? AI_NO_KEY_MESSAGE
    : null;

  const items: MenuItem[] = [
    {
      label: 'Edit alt text…',
      action: () => void editAltText(view, imagePos, imageNode),
    },
    {
      label: 'Generate alt text from image (AI)',
      disabled: aiBlockedReason !== null,
      title: aiBlockedReason ?? undefined,
      action: () => runGenerateAltText(view, imagePos, imageNode),
    },
    {
      label: 'Generate table from image (AI)',
      disabled: aiBlockedReason !== null,
      title: aiBlockedReason ?? undefined,
      action: () => runGenerateTable(view, imagePos, imageNode),
    },
  ];

  const menu = document.createElement('div');
  menu.className = 'pmd-nav-context-menu';

  for (const item of items) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pmd-nav-context-item';
    btn.textContent = item.label;
    if (item.disabled) {
      btn.disabled = true;
      btn.classList.add('pmd-nav-context-item-disabled');
    }
    if (item.title) btn.title = item.title;
    btn.addEventListener('click', () => {
      if (item.disabled) return;
      closeImageContextMenu();
      item.action();
    });
    menu.appendChild(btn);
  }

  document.body.appendChild(menu);

  // Clamp into viewport — match nav-panel's positioning logic so the
  // menu never spawns off-screen.
  const rect = menu.getBoundingClientRect();
  const maxX = window.innerWidth - rect.width - 4;
  const maxY = window.innerHeight - rect.height - 4;
  menu.style.left = `${Math.min(x, Math.max(0, maxX))}px`;
  menu.style.top = `${Math.min(y, Math.max(0, maxY))}px`;

  openMenuEl = menu;
  // Defer registration so the contextmenu's own mousedown doesn't
  // immediately close the menu we just opened.
  setTimeout(() => {
    window.addEventListener('mousedown', maybeCloseImageContextMenu, { capture: true });
    window.addEventListener('keydown', maybeCloseImageContextMenu, { capture: true });
  });
}

function closeImageContextMenu(): void {
  if (!openMenuEl) return;
  openMenuEl.remove();
  openMenuEl = null;
  window.removeEventListener('mousedown', maybeCloseImageContextMenu, { capture: true });
  window.removeEventListener('keydown', maybeCloseImageContextMenu, { capture: true });
}

/** Manual alt-text edit: multi-line prompt pre-filled with the current
 *  value, written back to `image.attrs.alt` on submit. No network and
 *  no Anthropic key needed — the AI path is a separate menu item. */
async function editAltText(
  view: EditorView,
  imagePos: number,
  imageNode: PMNode,
): Promise<void> {
  const currentAlt = String(imageNode.attrs['alt'] ?? '');
  const next = await promptForText({
    message: 'Image alt text',
    initial: currentAlt,
    placeholder: 'Describe the image for screen readers and accessibility tools.',
    multiline: true,
    okLabel: 'Save',
  });
  if (next === null) return;
  // The doc may have changed while the modal was open (e.g., via a
  // keybinding); if the image is no longer at `imagePos`, abort rather
  // than mutate the wrong node.
  const live = view.state.doc.nodeAt(imagePos);
  if (!live || live.type.name !== 'image') return;
  const tr = view.state.tr.setNodeMarkup(imagePos, undefined, {
    ...live.attrs,
    alt: next,
  });
  view.dispatch(tr);
}

function maybeCloseImageContextMenu(e: MouseEvent | KeyboardEvent): void {
  if (e instanceof KeyboardEvent) {
    if (e.key === 'Escape') closeImageContextMenu();
    return;
  }
  if (!openMenuEl) return;
  if (!openMenuEl.contains(e.target as Node)) closeImageContextMenu();
}
