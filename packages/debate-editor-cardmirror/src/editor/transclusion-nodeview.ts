/**
 * NodeView for a transclusion "live zone" (TRANSCLUSION_PLAN.md §4).
 *
 * The transcluded cards are REAL child nodes, so the zone is EDITABLE (a
 * `contentDOM` holds the children) — you can contextualise a tag or its
 * highlighting in place without breaking the link. The zone reads as ordinary
 * content: cards flow inline and there is NO header row. A left gutter rail (the
 * card-unit rail grammar, in --pmd-c-transclusion) reveals on hover — like a
 * normal card's rail — and a link glyph caps the rail head. Clicking the glyph
 * opens a menu that carries the source file, section, sync date, edited state,
 * and the actions: Open source / Refresh / Re-pick / Unlink. Refresh re-reads the
 * source and replaces the children (confirming first when edited); Unlink
 * detaches them.
 */
import type { Node as PMNode } from 'prosemirror-model';
import type { Decoration, EditorView, NodeView } from 'prosemirror-view';
import { icon, type IconName } from './icons.js';
import { showToast } from './toast.js';
import { isZoneEdited, isInDocCopy } from './transclusion.js';
import {
  refreshZoneAtPos,
  detachZoneAtPos,
  deleteZoneAtPos,
  rePickZoneAtPos,
  openZoneSourceAtPos,
} from './transclusion-actions.js';
import { transclusionSupported, refreshFailMessage } from './transclusion-resolve.js';
import { jumpToSelfRefSource } from './self-transclusion-commands.js';
import { checkLiveZoneSources } from './transclusion-divergence-plugin.js';
import { showConfirm } from './confirm-dialog.js';

/** " › " with explicit code points (space, U+203A, space) — matches crumbLabel. */
const CRUMB_SEP = ' › ';

function railGlyph(): HTMLElement {
  // Decorative — the button carries the accessible name (with synced/edited
  // state). Starts as the intact chain; refreshEditedState swaps it.
  const g = icon('link');
  g.classList.add('pmd-transclusion-glyph');
  return g;
}

/** Whether the divergence plugin has flagged this zone (via `spec.diverged` on
 *  its node decoration). */
function readDiverged(decorations: readonly Decoration[]): boolean {
  return decorations.some((d) => d.spec?.['diverged'] === true);
}

function formatSyncedDate(ms: number): string {
  try {
    return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'earlier';
  }
}

class TransclusionView implements NodeView {
  readonly dom: HTMLElement;
  readonly contentDOM: HTMLElement;
  private readonly glyphBtn: HTMLButtonElement;
  private readonly glyphIcon: HTMLElement;
  private node: PMNode;
  private readonly view: EditorView;
  private readonly getPos: () => number | undefined;
  private busy = false;
  private transient: 'unreachable' | 'web' | null = null;
  private menuEl: HTMLElement | null = null;
  /** Source has moved on since last pull — set from the divergence plugin's
   *  node decoration (transclusion-divergence-plugin.ts). */
  private diverged = false;

  constructor(
    node: PMNode,
    view: EditorView,
    getPos: () => number | undefined,
    decorations: readonly Decoration[] = [],
  ) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;
    this.diverged = readDiverged(decorations);

    this.dom = document.createElement('div');
    this.dom.className = 'pmd-transclusion';

    // The glyph caps the rail head. Absolutely positioned so it takes NO
    // vertical space in the flow; hover-revealed with the rail (see CSS).
    this.glyphBtn = document.createElement('button');
    this.glyphBtn.type = 'button';
    this.glyphBtn.className = 'pmd-transclusion-glyph-btn';
    this.glyphBtn.setAttribute('contenteditable', 'false');
    this.glyphBtn.title = 'Linked copy — source & actions';
    this.glyphBtn.setAttribute('aria-label', 'Linked copy actions');
    this.glyphIcon = railGlyph();
    this.glyphBtn.appendChild(this.glyphIcon);
    this.glyphBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    this.glyphBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleMenu();
    });

    // The editable body: PM renders the transcluded children here, flush — no
    // header pushes them down, so they sit inline like any other content.
    this.contentDOM = document.createElement('div');
    this.contentDOM.className = 'pmd-transclusion-body';

    this.dom.appendChild(this.glyphBtn);
    this.dom.appendChild(this.contentDOM);
    this.refreshEditedState();
    this.refreshStatusAttr();
  }

  /** The source file's name (with extension) from the ref, falling back to the
   *  file part of the breadcrumb label. In-doc copies show "This document". */
  private sourceFileName(): string {
    if (isInDocCopy(this.node)) return 'This document';
    const ref = String(this.node.attrs['source_ref'] || '');
    const base = ref.split('/').pop();
    if (base) return base;
    const label = String(this.node.attrs['source_label'] || '');
    return label.split(CRUMB_SEP)[0] || 'source';
  }

  /** The section/heading part of the breadcrumb label (after the file). An
   *  in-doc copy's label is just the section name (no file crumb). */
  private sectionLabel(): string {
    const label = String(this.node.attrs['source_label'] || '');
    if (isInDocCopy(this.node)) return label;
    const parts = label.split(CRUMB_SEP);
    return parts.length > 1 ? parts.slice(1).join(CRUMB_SEP) : '';
  }

  /** The one-line sync/status shown in the menu. */
  private statusLine(): string {
    if (this.busy) return 'Refreshing…';
    if (this.transient === 'unreachable') return 'Source not found · showing cached';
    if (this.transient === 'web') return 'Refresh on the desktop app';
    if (this.diverged) return 'Source has new content · Refresh to update';
    const lr = Number(this.node.attrs['last_refreshed'] ?? 0);
    return lr > 0 ? `Synced ${formatSyncedDate(lr)}` : 'Not yet refreshed';
  }

  private refreshEditedState(): void {
    const edited = isZoneEdited(this.node);
    this.dom.classList.toggle('pmd-transclusion-edited', edited);
    this.glyphBtn.classList.toggle('is-edited', edited);
    // Colorblind-safe: the glyph SHAPE carries the state too — an intact chain
    // when synced, a broken chain when the zone differs from its source — so it
    // never rests on the teal-vs-amber tint alone.
    this.glyphIcon.classList.toggle('pmd-icon-link', !edited);
    this.glyphIcon.classList.toggle('pmd-icon-link-broken', edited);
    // Divergence is an ORTHOGONAL badge (the source moved on, whatever the local
    // edit state): a distinct dot on the glyph carries it (shape + colour, so
    // it's colourblind-safe), and it enriches the tooltip/aria name.
    this.glyphBtn.classList.toggle('is-diverged', this.diverged);
    const state = this.diverged
      ? edited
        ? ' (edited · source updated)'
        : ' (source updated)'
      : edited
        ? ' (edited)'
        : '';
    this.glyphBtn.title = this.diverged
      ? `Linked copy${state} — source has new content; Refresh to update`
      : `Linked copy${state} — source & actions`;
    this.glyphBtn.setAttribute('aria-label', `Linked copy actions${state}`);
  }

  /** Reflect the transient/busy state on the wrapper (drives the glyph tint). */
  private refreshStatusAttr(): void {
    const state = this.busy
      ? 'busy'
      : this.transient === 'unreachable'
        ? 'unreachable'
        : this.transient === 'web'
          ? 'web'
          : 'ok';
    this.dom.setAttribute('data-status', state);
  }

  private toggleMenu(): void {
    if (this.menuEl) {
      this.closeMenu();
      return;
    }
    const menu = document.createElement('div');
    menu.className = 'pmd-transclusion-menu';
    menu.setAttribute('contenteditable', 'false');

    // Info header — the source detail that used to sit inline in the doc.
    const info = document.createElement('div');
    info.className = 'pmd-transclusion-menu-info';

    const fileRow = document.createElement('div');
    fileRow.className = 'pmd-transclusion-menu-file';
    fileRow.appendChild(icon('link'));
    const fileText = document.createElement('span');
    fileText.textContent = this.sourceFileName();
    fileRow.appendChild(fileText);
    info.appendChild(fileRow);

    const section = this.sectionLabel();
    if (section) {
      const secRow = document.createElement('div');
      secRow.className = 'pmd-transclusion-menu-section';
      secRow.textContent = section;
      info.appendChild(secRow);
    }

    const meta = document.createElement('div');
    meta.className = 'pmd-transclusion-menu-meta';
    const synced = document.createElement('span');
    synced.textContent = this.statusLine();
    meta.appendChild(synced);
    if (isZoneEdited(this.node)) {
      const edited = document.createElement('span');
      edited.className = 'pmd-transclusion-menu-edited';
      edited.textContent = 'Edited';
      edited.title = 'This zone differs from the source. Refresh to reset.';
      meta.appendChild(edited);
    }
    info.appendChild(meta);
    menu.appendChild(info);

    const sep = document.createElement('div');
    sep.className = 'pmd-transclusion-menu-sep';
    menu.appendChild(sep);

    const inDoc = isInDocCopy(this.node);
    menu.appendChild(
      inDoc
        ? // In-doc copy: no file to open — jump to the source section instead.
          this.menuItem('bookmark', 'Go to source section', () => {
            this.closeMenu();
            this.onGoToInDocSource();
          })
        : this.menuItem('open', 'Open source file', () => {
            this.closeMenu();
            this.onOpenSource();
          }),
    );
    menu.appendChild(
      this.menuItem('reset', 'Refresh from source', () => {
        this.closeMenu();
        this.onRefresh();
      }),
    );
    menu.appendChild(
      this.menuItem('search', 'Check for updates', () => {
        this.closeMenu();
        this.onCheckUpdates();
      }),
    );
    // Re-pick re-points to a different FILE — cross-file only for now.
    if (!inDoc) {
      menu.appendChild(
        this.menuItem('search', 'Re-pick source…', () => {
          this.closeMenu();
          void this.onRePick();
        }),
      );
    }
    menu.appendChild(
      this.menuItem('edit', 'Unlink', () => {
        this.closeMenu();
        this.onDetach();
      }),
    );
    menu.appendChild(
      this.menuItem('trash', 'Delete', () => {
        this.closeMenu();
        this.onDelete();
      }),
    );

    this.dom.appendChild(menu);
    this.menuEl = menu;
    this.dom.classList.add('pmd-transclusion-menu-open');
    setTimeout(() => {
      document.addEventListener('mousedown', this.onOutsidePointer, true);
      document.addEventListener('keydown', this.onMenuKey, true);
    }, 0);
  }

  private onOutsidePointer = (e: Event): void => {
    if (this.menuEl && !this.menuEl.contains(e.target as Node) && e.target !== this.glyphBtn) {
      this.closeMenu();
    }
  };

  private onMenuKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.closeMenu();
    }
  };

  private closeMenu(): void {
    if (!this.menuEl) return;
    this.menuEl.remove();
    this.menuEl = null;
    this.dom.classList.remove('pmd-transclusion-menu-open');
    document.removeEventListener('mousedown', this.onOutsidePointer, true);
    document.removeEventListener('keydown', this.onMenuKey, true);
  }

  private menuItem(iconName: IconName, label: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pmd-transclusion-menu-item';
    btn.appendChild(icon(iconName));
    const span = document.createElement('span');
    span.textContent = label;
    btn.appendChild(span);
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  /** Jump to the in-doc section this copy was pulled from. */
  private onGoToInDocSource(): void {
    jumpToSelfRefSource(this.view, String(this.node.attrs['source_heading_id'] ?? ''));
  }

  /** Check every linked copy's source for changes now (updates the badges). */
  private onCheckUpdates(): void {
    void checkLiveZoneSources(this.view).then((s) => {
      const msg = !s.desktop
        ? 'Linked copies from a file check for updates on the desktop app.'
        : s.diverged > 0
          ? `${s.diverged} linked ${s.diverged === 1 ? 'copy has' : 'copies have'} a changed source — Refresh to update.`
          : 'Linked copies are up to date with their sources.';
      showToast(msg);
    });
  }

  private onRefresh(): void {
    if (this.busy) return; // ignore re-entrant clicks while a refresh is in flight
    const pos = this.getPos();
    if (pos == null) return;
    // In-doc copies resolve from the live doc, so they refresh everywhere; only
    // cross-file copies need the desktop file layer.
    if (!isInDocCopy(this.node) && !transclusionSupported()) {
      this.transient = 'web';
      this.refreshStatusAttr();
      showToast(refreshFailMessage('not-desktop'));
      return;
    }
    this.busy = true;
    this.transient = null;
    this.refreshStatusAttr();
    void refreshZoneAtPos(this.view, pos).then((outcome) => {
      this.busy = false;
      if (outcome.ok) {
        this.transient = null;
        // The dispatch replaced the node → a fresh NodeView renders the update.
      } else if (outcome.reason === 'cancelled' || outcome.reason === 'ambiguous') {
        // 'ambiguous' = the zone moved or was re-picked/detached while this
        // refresh was in flight; the zone itself is fine, so don't flag it
        // unreachable (that would stick). No error chrome.
        this.transient = null;
      } else if (outcome.reason === 'source-empty') {
        // The source was reachable but that heading is now empty — we kept the
        // cache. The zone is healthy, so no "unreachable" chrome; just tell why.
        this.transient = null;
        showToast(refreshFailMessage('source-empty'));
      } else {
        this.transient = outcome.reason === 'not-desktop' ? 'web' : 'unreachable';
        showToast(refreshFailMessage(outcome.reason));
      }
      this.refreshStatusAttr();
    });
  }

  private onDetach(): void {
    const pos = this.getPos();
    if (pos == null) return;
    detachZoneAtPos(this.view, pos);
  }

  private onDelete(): void {
    const pos = this.getPos();
    if (pos == null) return;
    deleteZoneAtPos(this.view, pos);
  }

  private async onRePick(): Promise<void> {
    const pos = this.getPos();
    if (pos == null) return;
    if (!transclusionSupported()) {
      // Re-pick needs the picker + file reads, both desktop-only.
      showToast(refreshFailMessage('not-desktop'));
      return;
    }
    // Re-picking replaces the zone's content, so confirm first when it's edited —
    // symmetric with Refresh (which prompts before discarding local edits).
    if (isZoneEdited(this.node)) {
      const ok = await showConfirm({
        title: 'Discard your edits?',
        message: 'Re-picking the source replaces your local edits to this live zone.',
        confirmLabel: 'Re-pick',
        cancelLabel: 'Keep edits',
      });
      if (!ok) return;
    }
    // The zone may have moved while the dialog was open; re-read its position.
    const livePos = this.getPos();
    if (livePos == null) return;
    rePickZoneAtPos(this.view, livePos);
  }

  private onOpenSource(): void {
    const pos = this.getPos();
    if (pos == null) return;
    if (!transclusionSupported()) {
      // Opening the linked source needs the desktop file layer.
      showToast(refreshFailMessage('not-desktop'));
      return;
    }
    openZoneSourceAtPos(this.view, pos);
  }

  update(node: PMNode, decorations: readonly Decoration[] = []): boolean {
    if (node.type !== this.node.type) return false;
    const lastRefreshedChanged = node.attrs['last_refreshed'] !== this.node.attrs['last_refreshed'];
    this.node = node;
    this.diverged = readDiverged(decorations);
    // Clear a stale transient error once a refresh has landed.
    if (lastRefreshedChanged) this.transient = null;
    // Close the menu on an attr change so it can't show stale source detail.
    this.closeMenu();
    this.refreshEditedState();
    this.refreshStatusAttr();
    // Return true so PM diffs the children into contentDOM itself.
    return true;
  }

  selectNode(): void {
    this.dom.classList.add('ProseMirror-selectednode');
  }

  deselectNode(): void {
    this.dom.classList.remove('ProseMirror-selectednode');
  }

  /** Keep events on our own chrome (glyph button / menu) away from PM; events
   *  inside the editable body fall through so edits work normally. */
  stopEvent(e: Event): boolean {
    const t = e.target as HTMLElement | null;
    return !!t?.closest?.('.pmd-transclusion-glyph-btn, .pmd-transclusion-menu');
  }

  /** Ignore mutations in our chrome; let PM handle the editable content. */
  ignoreMutation(m: MutationRecord | { type: 'selection'; target: Node }): boolean {
    if (m.type === 'selection') return false;
    return !this.contentDOM.contains((m as MutationRecord).target);
  }

  destroy(): void {
    this.closeMenu();
  }
}

/** NodeView factory map — merged into the editor's `nodeViews`. */
export const transclusionNodeViews = {
  transclusion_ref: (
    node: PMNode,
    view: EditorView,
    getPos: () => number | undefined,
    decorations: readonly Decoration[],
  ): NodeView => new TransclusionView(node, view, getPos, decorations),
};
