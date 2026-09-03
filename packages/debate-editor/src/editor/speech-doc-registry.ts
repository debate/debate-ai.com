/**
 * Speech-doc registry.
 *
 * Tracks which open doc is currently designated as the "speech doc"
 * — the destination for `sendToSpeech` (\` / Alt-\`). Verbatim's
 * equivalent is a single global `ActiveSpeechDoc` string (filename);
 * we key off a per-doc uid instead because every CardMirror doc
 * already carries a stable uid for journal recovery.
 *
 * Two layers:
 *
 *   1. `speechUid` — the source of truth. In Electron, this lives
 *      in the main process; the renderer mirrors it and forwards
 *      every mutation back via the host bridge. In the browser, the
 *      renderer is the only authority.
 *
 *   2. `views: Map<uid, EditorView>` — a local cache of doc views
 *      that live in THIS renderer. Used to resolve "is the speech
 *      doc in this window?" and to expose the view to callers that
 *      want to dispatch a transaction. A speech uid with no matching
 *      entry here means the speech doc lives in another window
 *      (Electron multi-window) — `sendToSpeech` routes through main
 *      instead of dispatching locally.
 */

import type { EditorView } from 'prosemirror-view';
import type { Host } from './host/types.js';

export interface RegisterViewOptions {
  /** Fires on the destination side after a speech-doc slice has
   *  landed in this view (whether from a same-window send or an
   *  incoming cross-window slice). Hosts use it to refresh nav-
   *  panel collapse state for newly arrived headings. */
  onSliceLanded?: () => void;
}

export interface SpeechDocResolver {
  /** The uid currently designated as the speech doc, or `null` when
   *  no doc has been marked. May reference a uid that lives in
   *  another window. */
  getSpeechUid(): string | null;
  /** True iff `uid` is currently designated as the speech doc. */
  isSpeechByUid(uid: string): boolean;
  /** The view for `uid` if it's mounted in THIS renderer, else
   *  `null`. */
  viewForUid(uid: string): EditorView | null;
  /** Every (uid, view) registered in THIS renderer — i.e., every open
   *  editor across panes/stacks. Used by whole-workspace reconfigures
   *  (e.g., rebuilding keymaps after a plugin registers commands). */
  allViews(): { uid: string; view: EditorView }[];
  /** The uid for `view` if it's registered in this renderer, else
   *  `null`. Used by the send module to look up the uid of a
   *  destination view so it can fire `notifySliceLanded`. */
  uidForView(view: EditorView): string | null;
  /** Convenience: the view for the current speech uid IF it lives
   *  in this renderer, else `null`. Returns `null` when no speech
   *  is set OR the speech doc is in another window. */
  getSpeechView(): EditorView | null;
  /** Designate `uid` as the speech doc. `null` clears. */
  setSpeechByUid(uid: string | null): void;
  /** Legacy view-keyed setter. Resolves to a uid via the registered-
   *  view map; warns and no-ops if the view was never registered. */
  setSpeech(view: EditorView | null): void;
  /** Register a doc's (uid, view) so lookups can resolve it.
   *  Idempotent. In Electron mode this ALSO reports the doc to the
   *  main process. The optional `onSliceLanded` callback is fired
   *  on the destination side whenever a speech-doc slice lands in
   *  this view. */
  registerView(uid: string, view: EditorView, opts?: RegisterViewOptions): void;
  /** Remove a doc's registration. Idempotent. In Electron mode this
   *  ALSO reports the unregistration to the main process. */
  unregisterView(uid: string): void;
  /** Fire the `onSliceLanded` callback registered for `uid`, if any.
   *  Called by the send module after `insertSpeechSlice` dispatches —
   *  same call point regardless of whether the slice came from a
   *  same-window send or a cross-window IPC. */
  notifySliceLanded(uid: string): void;
  /** Subscribe to changes. Fires whenever the speech uid changes or
   *  the local view cache changes. */
  subscribe(fn: () => void): () => void;
}

interface ViewEntry {
  view: EditorView;
  onSliceLanded?: () => void;
}

class DefaultSpeechDocResolver implements SpeechDocResolver {
  protected speechUid: string | null = null;
  protected views = new Map<string, ViewEntry>();
  protected viewToUid = new WeakMap<EditorView, string>();
  protected listeners = new Set<() => void>();

  getSpeechUid(): string | null {
    return this.speechUid;
  }

  isSpeechByUid(uid: string): boolean {
    return this.speechUid === uid;
  }

  viewForUid(uid: string): EditorView | null {
    return this.views.get(uid)?.view ?? null;
  }

  allViews(): { uid: string; view: EditorView }[] {
    return [...this.views.entries()].map(([uid, entry]) => ({ uid, view: entry.view }));
  }

  uidForView(view: EditorView): string | null {
    return this.viewToUid.get(view) ?? null;
  }

  getSpeechView(): EditorView | null {
    if (!this.speechUid) return null;
    return this.views.get(this.speechUid)?.view ?? null;
  }

  setSpeechByUid(uid: string | null): void {
    if (this.speechUid === uid) return;
    this.speechUid = uid;
    this.fire();
  }

  setSpeech(view: EditorView | null): void {
    if (view === null) {
      this.setSpeechByUid(null);
      return;
    }
    const uid = this.viewToUid.get(view);
    if (!uid) {
      console.warn(
        'speech-doc-registry: setSpeech called with an unregistered view',
      );
      return;
    }
    this.setSpeechByUid(uid);
  }

  registerView(uid: string, view: EditorView, opts?: RegisterViewOptions): void {
    const existing = this.views.get(uid);
    if (
      existing &&
      existing.view === view &&
      existing.onSliceLanded === opts?.onSliceLanded
    ) {
      return;
    }
    this.views.set(uid, { view, onSliceLanded: opts?.onSliceLanded });
    this.viewToUid.set(view, uid);
    this.fire();
  }

  unregisterView(uid: string): void {
    if (!this.views.has(uid)) return;
    this.views.delete(uid);
    this.fire();
  }

  notifySliceLanded(uid: string): void {
    const entry = this.views.get(uid);
    if (!entry?.onSliceLanded) return;
    try {
      entry.onSliceLanded();
    } catch (err) {
      console.error('onSliceLanded error', err);
    }
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  protected fire(): void {
    for (const fn of this.listeners) {
      try {
        fn();
      } catch (err) {
        console.error('speech-doc listener error', err);
      }
    }
  }
}

/** Browser resolver — shares the speech-doc DESIGNATION across same-origin tabs
 *  via `localStorage` (persisted so a newly-opened tab learns it) + the `storage`
 *  event (live cross-tab sync). The view map stays per-tab; a designated uid with
 *  no local view means the speech doc lives in ANOTHER tab, and `sendToSpeech`
 *  routes the slice there over a BroadcastChannel (see `speech-doc-send.ts`). */
const SPEECH_UID_KEY = 'pmd-speech-uid';

class WebSpeechDocResolver extends DefaultSpeechDocResolver {
  constructor() {
    super();
    try {
      const stored = localStorage.getItem(SPEECH_UID_KEY);
      this.speechUid = stored && stored.length > 0 ? stored : null;
    } catch {
      /* storage unavailable — designation stays per-tab */
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key !== SPEECH_UID_KEY) return;
        const next = e.newValue && e.newValue.length > 0 ? e.newValue : null;
        if (this.speechUid !== next) {
          this.speechUid = next;
          this.fire();
        }
      });
    }
  }

  override setSpeechByUid(uid: string | null): void {
    if (this.speechUid !== uid) {
      this.speechUid = uid;
      this.fire();
    }
    try {
      if (uid) localStorage.setItem(SPEECH_UID_KEY, uid);
      else localStorage.removeItem(SPEECH_UID_KEY);
    } catch {
      /* best-effort — cross-tab sync just won't persist */
    }
  }
}

let resolver: SpeechDocResolver = new DefaultSpeechDocResolver();

export function getSpeechDocResolver(): SpeechDocResolver {
  return resolver;
}

/** Install the host-appropriate resolver. Call once at boot after the host is
 *  established. This build is web-only, so it always installs the cross-tab
 *  (localStorage-shared) resolver regardless of `host.kind`. */
export function installSpeechDocResolver(_host: Host): void {
  resolver = new WebSpeechDocResolver();
}
