/**
 * CardMirror mount singleton.
 *
 * `src/editor/index.ts` is not a component — it's ~10k lines of
 * side-effecting module code that assumes it owns the whole page: a
 * single `#editor`/`#ribbon` DOM tree, a single module-level
 * `EditorView`, one-time boot wiring (autosave, undo, nav panel,
 * journal recovery). It can be imported (and therefore booted) at
 * most ONCE per page load — a second `import()` just returns the
 * cached module without re-running its top-level code.
 *
 * So rather than mounting a fresh CardMirror instance per React
 * component instance (impossible), this module owns ONE persistent
 * container `<div>`, created and booted lazily on first use, and
 * hands it out to whichever `<CardMirrorEditor>` currently wants to
 * be the live one. That component physically re-parents the same
 * container node into itself on claim (plain `appendChild` — moving
 * an attached DOM node, not cloning it, so the live `EditorView`
 * and all its state survive the move) and, if a *different* document
 * was already loaded, swaps content in via a real transaction so
 * undo/autosave/etc. see it as a normal edit.
 *
 * Only one `<CardMirrorEditor>` can be "live" at a time; callers that
 * lose the claim render `ReadOnlyPreview` instead (see index.tsx).
 *
 * ## Why the change reporter is fussy
 *
 * The host app treats `onChange` as "the user edited this document" and
 * writes the result straight to its own storage (D1, via
 * `/api/doc/documents/:id`). But the engine replaces its whole editor state
 * on its own initiative too — its boot sequence, crash-recovery, the
 * ribbon's New/Open, a joined collaboration session — and those
 * replacements land on the same `EditorView` this module has handed the
 * host's document to. Reported as edits, a replacement by the engine's
 * blank starter doc doesn't just blank the pane: it overwrites the stored
 * file with nothing, which is the "opened a file and it disappeared" report
 * this module's guards exist to prevent.
 *
 * So only a transaction that changed the doc counts as an edit; a
 * whole-state replacement never does, and when one drops a BLANK doc over
 * the host's non-empty document it is undone here
 * (`restoreIfEngineBlankedTheDoc`) so the file doesn't vanish from the pane.
 * `change-reporter.ts` owns that discrimination and documents how it is
 * made.
 */

import { EditorState } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import type { EditorView } from 'prosemirror-view';
import { RIBBON_HTML } from './ribbon-template.js';
import { changeReporterKey, createChangeReporterPlugin, LOAD_META } from './change-reporter.js';
import { docToHtml, isBlankDoc, parseHtml } from './html-bridge.js';
import { setHostPluginsProvider } from '../editor/host-plugins.js';
import { postNotice } from '../editor/status-notices.js';

export interface Binding {
  key: string;
  onChange?: (html: string) => void;
}

let container: HTMLDivElement | null = null;
let bootPromise: Promise<void> | null = null;
let currentBinding: Binding | null = null;
let onChangePluginInstalled = false;

type EngineModule = typeof import('../editor/index.js');
type BridgeModule = typeof import('./html-bridge.js');
let engineModule: EngineModule | null = null;
let bridgeModule: BridgeModule | null = null;

/** Synchronous access to the engine/bridge modules, once loaded (always
 *  true by the time a `CardMirrorEditor` imperative-handle method could
 *  run, since mounting already awaited `claim()`). Avoids every handle
 *  method needing to be async just to re-`import()` an already-loaded
 *  module. */
export function getEngineModule(): EngineModule | null {
  return engineModule;
}
export function getBridgeModule(): BridgeModule | null {
  return bridgeModule;
}

/** Poll for the boot sequence's `mountView` call to land (see the
 *  module doc on `index.ts` in ribbon-template.ts — there's no
 *  exported "ready" hook to await instead). */
const CARDMIRROR_BOOT_TIMEOUT_MS = 30000;
async function waitForView(getActiveView: () => EditorView | null): Promise<EditorView> {
  const start = Date.now();
  for (;;) {
    const view = getActiveView();
    if (view) return view;
    const elapsed = Date.now() - start;
    if (elapsed > CARDMIRROR_BOOT_TIMEOUT_MS) {
      throw new Error(`CardMirror engine did not finish booting within ${Math.round(
        CARDMIRROR_BOOT_TIMEOUT_MS / 1000,
      )}s (waited ${Math.round(elapsed / 1000)}s)`);
    }
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
}

async function boot(): Promise<void> {
  const el = document.createElement('div');
  el.className = 'dec-cardmirror-root';
  el.innerHTML = RIBBON_HTML;
  // Detached-but-attached: parked on <body> (hidden) until a React
  // component claims it. getElementById needs it IN the document
  // before the dynamic import below runs its module-scope lookups.
  el.style.position = 'fixed';
  el.style.left = '-99999px';
  el.style.top = '0';
  el.style.width = '1024px';
  el.style.height = '768px';
  document.body.appendChild(el);
  container = el;

  engineModule = await import('../editor/index.js');
  bridgeModule = await import('./html-bridge.js');
  await waitForView(engineModule.getActiveView);
  installUnloadFlush();
}

/** Ensure the singleton is created and booted; safe to call
 *  repeatedly (idempotent — returns the same in-flight/completed
 *  promise). Must only run client-side. */
export function ensureBooted(): Promise<void> {
  if (!bootPromise) bootPromise = boot();
  return bootPromise;
}

export function getContainer(): HTMLDivElement {
  if (!container) throw new Error('CardMirror container requested before ensureBooted() resolved');
  return container;
}

// ─── Per-key load/emit bookkeeping ────────────────────────────────
// `loadedHtmlByKey` is the exact string the host last handed us for a key;
// `emittedByKey` is a bounded ring of the strings we last reported for it.
// A `content` prop matching either is our own echo — including a STALE echo,
// which is why this is a set and not a single slot: the host's state update
// round-trips through React, so an older emission can arrive as a prop after
// a newer one has already been reported, and re-applying it would throw away
// whatever the user typed in between.
const loadedHtmlByKey = new Map<string, string>();
const emittedByKey = new Map<string, string[]>();
/** Keys whose stored content this module could not parse. Nothing is ever
 *  reported for them: the host's copy is the only intact one left, so it must
 *  not be overwritten with what we managed to mount instead. */
const unreadableKeys = new Set<string>();
const EMIT_HISTORY = 8;

function rememberEmitted(key: string, html: string): void {
  const list = emittedByKey.get(key) ?? [];
  list.push(html);
  if (list.length > EMIT_HISTORY) list.shift();
  emittedByKey.set(key, list);
}

function isOwnEcho(key: string, html: string): boolean {
  if (loadedHtmlByKey.get(key) === html) return true;
  return (emittedByKey.get(key) ?? []).includes(html);
}

/** True while this module is replacing the doc itself, so the reporter can
 *  tell its own load apart from one the engine started. Set and cleared
 *  synchronously around the state write — ProseMirror runs plugin view
 *  updates synchronously inside `updateState`/`dispatch`. */
let applyingLoad = false;

export interface ClaimOptions {
  /** Report the loaded content back through `binding.onChange` once it has
   *  mounted. Off by default — a load is not an edit, and reporting one is
   *  how a document that failed to load, or an engine-mounted blank, used to
   *  overwrite the host's stored copy. The imperative handle's explicit
   *  loads (`setHTML`, `importDocx`, `importCmir`) DO pass it: there the host
   *  asked for the new content and expects to be told what it now has. */
  report?: boolean;
}

/** Claim the live singleton for `binding.key`, loading `html` into it
 *  when the key differs from whichever doc is currently mounted (a
 *  fresh claim, or a different pane taking over). Idempotent for
 *  repeat calls with the same key — content already tracks itself via
 *  the onChange plugin once bound, so re-claiming doesn't reset it. */
export async function claim(
  binding: Binding,
  html: string,
  opts: ClaimOptions = {},
): Promise<void> {
  await ensureBooted();
  const engine = engineModule;
  const view = engine?.getActiveView();
  if (!view) throw new Error('CardMirror view unavailable after boot');
  installOnChangePlugin(view);

  const isNewKey = currentBinding?.key !== binding.key;
  // Whatever is still pending belongs to the doc that is live RIGHT NOW.
  // Reporting it after the swap would file one document's edits under
  // another's id; dropping it would lose them. Flush first, then swap.
  if (isNewKey) flushPendingChange();
  currentBinding = binding;

  if (isNewKey) {
    // Different document identity — full remount, fresh undo history
    // (matches the prior editor's contentKey-triggered reset).
    const parsed = parseHtml(html);
    if (!parsed.ok) {
      // The stored content didn't survive parsing. Mount what we have, but
      // never report this key again: the host's copy is the only intact one
      // and an edit-shaped report would replace it with this wreckage.
      markUnreadable(binding.key);
    }
    if (parsed.ok) unreadableKeys.delete(binding.key);
    loadedHtmlByKey.set(binding.key, html);
    applyLoad(view, () => {
      view.updateState(
        EditorState.create({
          schema: parsed.doc.type.schema,
          doc: parsed.doc,
          plugins: view.state.plugins,
        }),
      );
    });
    view.focus();
    if (opts.report && parsed.ok) reportNow(view, binding.key);
    return;
  }

  // Same document identity: only apply `html` if it's an EXTERNAL change
  // (didn't just come from our own onChange echoing back), so external
  // prop updates still land without resetting undo history on every
  // keystroke-triggered re-render.
  if (isOwnEcho(binding.key, html)) return;
  if (html === docToHtml(view.state.doc)) return;
  const parsed = parseHtml(html);
  if (!parsed.ok) {
    // An unreadable external update over a document that is currently fine:
    // keep what's on screen rather than blanking it, and stop reporting so
    // the mounted copy can't be written back over the stored one.
    markUnreadable(binding.key);
    return;
  }
  // Readable content for a key that previously failed to load clears the
  // block: this IS the document again, so edits may be saved again.
  unreadableKeys.delete(binding.key);
  loadedHtmlByKey.set(binding.key, html);
  applyLoad(view, () => {
    const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, parsed.doc.content);
    tr.setMeta(changeReporterKey, LOAD_META);
    view.dispatch(tr);
  });
  if (opts.report) reportNow(view, binding.key);
}

/** Report the mounted document to the live binding right now — the explicit
 *  `report` path, where the host asked for this content and is waiting to be
 *  told what the document became. */
function reportNow(view: EditorView, key: string): void {
  if (currentBinding?.key !== key || unreadableKeys.has(key)) return;
  const html = docToHtml(view.state.doc);
  rememberEmitted(key, html);
  currentBinding.onChange?.(html);
}

function markUnreadable(key: string): void {
  if (unreadableKeys.has(key)) return;
  unreadableKeys.add(key);
  // A durable notice, not just a toast: this one has to outlive a glance.
  // What it means is that the copy on screen is NOT this document — so
  // nothing typed here will be saved, because saving it would replace the
  // stored file with the wreckage of a failed load.
  postNotice({
    severity: 'error',
    title: "Couldn't read this document's saved content",
    body:
      "The stored copy didn't parse, so it hasn't been loaded — and nothing typed here " +
      'will be saved over it. The file on the server is untouched; reopen it, or restore ' +
      'it from a backup, rather than retyping into this pane.',
    key: `cardmirror-unreadable:${key}`,
  });
}

function applyLoad(view: EditorView, write: () => void): void {
  const wasApplying = applyingLoad;
  applyingLoad = true;
  try {
    write();
  } finally {
    applyingLoad = wasApplying;
  }
  // The mounted doc is now the reference for "what the host's content looks
  // like once loaded" — used to restore it if the engine drops a blank
  // starter over it (see the reporter below).
  liveDocSnapshot = view.state.doc;
  // And tell the engine, whose own `currentDoc` is the fallback content for
  // any remount it does on its own. Left unset it still holds the blank
  // starter from boot, and the next such remount blanks the host's document.
  engineModule?.adoptEmbeddedDoc(view.state.doc);
}

/** The doc this module last loaded (or last saw a user edit produce) for the
 *  live key. Restored over an engine-initiated blank so a loaded file can't
 *  silently vanish from the pane. */
let liveDocSnapshot: PMNode | null = null;

/** Release the claim if `key` currently holds it (a no-op otherwise —
 *  e.g. a pane that never became live, or already lost the claim to
 *  another pane). Leaves the last-loaded doc mounted; there is
 *  nothing meaningful to "unmount" a page-singleton engine to. */
export function release(key: string): void {
  if (currentBinding?.key !== key) return;
  // Edits made in the last debounce window are still the user's work even
  // though the pane is going away — report them before the binding goes.
  flushPendingChange();
  currentBinding = null;
}

export function isLiveKey(key: string): boolean {
  return currentBinding?.key === key;
}

/** Append (i.e. move) the singleton container into `host`. */
export function attachTo(host: HTMLElement): void {
  const el = getContainer();
  el.style.position = '';
  el.style.left = '';
  el.style.top = '';
  el.style.width = '100%';
  el.style.height = '100%';
  host.appendChild(el);
}

// ─── Change reporting ─────────────────────────────────────────────

const ONCHANGE_DEBOUNCE_MS = 400;
let scheduled: ReturnType<typeof setTimeout> | null = null;
let scheduledView: EditorView | null = null;

function scheduleOnChange(view: EditorView): void {
  scheduledView = view;
  if (scheduled) clearTimeout(scheduled);
  scheduled = setTimeout(() => {
    scheduled = null;
    emitPendingChange();
  }, ONCHANGE_DEBOUNCE_MS);
}

function emitPendingChange(): void {
  const view = scheduledView;
  scheduledView = null;
  if (!view || !currentBinding) return;
  const key = currentBinding.key;
  if (unreadableKeys.has(key)) return;
  const html = docToHtml(view.state.doc);
  rememberEmitted(key, html);
  currentBinding.onChange?.(html);
}

/** Report any debounced edit NOW, under the binding that owns it. Called
 *  before the live binding changes (so edits can't be filed under the wrong
 *  document, or dropped when a pane closes) and when the page is being
 *  hidden or unloaded (so the last few hundred ms of typing still reach the
 *  host's storage). Safe to call at any time; a no-op with nothing pending. */
export function flushPendingChange(): void {
  if (!scheduled) return;
  clearTimeout(scheduled);
  scheduled = null;
  emitPendingChange();
}

let unloadFlushInstalled = false;
function installUnloadFlush(): void {
  if (unloadFlushInstalled || typeof window === 'undefined') return;
  unloadFlushInstalled = true;
  // `pagehide` covers navigation and bfcache; `visibilitychange` covers the
  // mobile "switched apps" case, which is often the last event a tab gets.
  window.addEventListener('pagehide', flushPendingChange);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPendingChange();
  });
}

/** Append a plugin that reports doc changes to whichever binding is
 *  currently live, via `state.reconfigure` (preserves every other
 *  plugin's existing state — history, collab, etc. — so this never
 *  resets undo). Idempotent: only installs once per view lifetime,
 *  so repeated `claim()` calls don't stack duplicate plugins.
 *
 *  Also registered as the engine's host-plugin provider, so every
 *  plugin-stack rebuild the engine does on its own (a collab session
 *  starting, a joined session doc mounting, keymap settings) keeps the
 *  reporter — without this, `onChange` went silent the moment a
 *  co-editing session started on the embedded doc. */
function installOnChangePlugin(view: EditorView): EditorView {
  if (onChangePluginInstalled) return view;
  onChangePluginInstalled = true;
  const plugin = createChangeReporterPlugin({
    isLoading: () => applyingLoad,
    onEdit: (v) => {
      liveDocSnapshot = v.state.doc;
      scheduleOnChange(v);
    },
    // (The engine keeps its own `currentDoc` in step with edits itself, in
    // `dispatchTransaction` — only state replacements bypass it.)
    // Not an edit: the engine replaced its editor state (boot, New, Open,
    // crash recovery, a joined session). Never reported — the host's
    // document is not what changed — but a BLANK replacement is undone,
    // since that one is the loaded file disappearing.
    onStateReplaced: restoreIfEngineBlankedTheDoc,
  });
  setHostPluginsProvider(() => [plugin]);
  view.updateState(view.state.reconfigure({ plugins: [...view.state.plugins, plugin] }));
  return view;
}

/** The engine replaced its editor state while a host document was mounted.
 *  If what landed is its blank starter and the host's document wasn't
 *  blank, put the host's document back: that swap is the "loaded file went
 *  blank" bug, and leaving it would also strand the pane on an empty doc
 *  the host never asked for. A replacement carrying real content (the
 *  ribbon's own Open, a joined collaboration session) is left alone.
 *
 *  Deferred out of the plugin's own `update`: mid-remount the engine's
 *  module-level `view` still points at the view being replaced, and its
 *  `dispatchTransaction` drops any transaction aimed at a view that isn't
 *  the current one (see its "Applying a mismatched transaction" guard). A
 *  restore dispatched from inside the update would be silently discarded,
 *  so it goes out on the next task, once the swap has settled. */
function restoreIfEngineBlankedTheDoc(view: EditorView): void {
  const snapshot = liveDocSnapshot;
  if (!currentBinding || !snapshot) return;
  if (!isBlankDoc(view.state.doc) || isBlankDoc(snapshot)) return;
  const bindingAtSchedule = currentBinding;
  setTimeout(() => {
    // Re-check everything: the pane may have closed, the user may have
    // started typing, or the engine may have mounted real content since.
    const live = engineModule?.getActiveView() ?? null;
    if (!live || currentBinding !== bindingAtSchedule) return;
    if (!isBlankDoc(live.state.doc) || liveDocSnapshot !== snapshot) return;
    console.warn(
      '[debate-editor] the engine replaced the mounted document with a blank one — restoring it',
    );
    applyLoad(live, () => {
      const tr = live.state.tr.replaceWith(0, live.state.doc.content.size, snapshot.content);
      tr.setMeta(changeReporterKey, LOAD_META);
      tr.setMeta('addToHistory', false);
      live.dispatch(tr);
    });
  }, 0);
}
