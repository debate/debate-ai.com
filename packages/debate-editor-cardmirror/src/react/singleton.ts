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
 */

import { EditorState, Plugin, PluginKey } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { RIBBON_HTML } from './ribbon-template.js';
import { htmlToDoc } from './html-bridge.js';

export interface Binding {
  key: string;
  onChange?: (html: string) => void;
}

let container: HTMLDivElement | null = null;
let bootPromise: Promise<void> | null = null;
let currentBinding: Binding | null = null;
let onChangePluginInstalled = false;
const onChangePluginKey = new PluginKey('debate-editor-cardmirror-onchange');

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

/** Claim the live singleton for `binding.key`, loading `html` into it
 *  when the key differs from whichever doc is currently mounted (a
 *  fresh claim, or a different pane taking over). Idempotent for
 *  repeat calls with the same key — content already tracks itself via
 *  the onChange plugin once bound, so re-claiming doesn't reset it. */
const lastEmittedByKey = new Map<string, string>();

export async function claim(binding: Binding, html: string): Promise<void> {
  await ensureBooted();
  const engine = engineModule;
  const view = engine?.getActiveView();
  if (!view) throw new Error('CardMirror view unavailable after boot');
  installOnChangePlugin(view);

  const isNewKey = currentBinding?.key !== binding.key;
  currentBinding = binding;

  if (isNewKey) {
    // Different document identity — full remount, fresh undo history
    // (matches the prior editor's contentKey-triggered reset).
    const doc = htmlToDoc(html);
    view.updateState(
      EditorState.create({ schema: doc.type.schema, doc, plugins: view.state.plugins }),
    );
    view.focus();
    return;
  }

  // Same document identity: only apply `html` if it's an EXTERNAL change
  // (didn't just come from our own onChange echoing back), so external
  // prop updates still land without resetting undo history on every
  // keystroke-triggered re-render.
  const docToHtml = bridgeModule!.docToHtml;
  if (html === lastEmittedByKey.get(binding.key)) return;
  if (html === docToHtml(view.state.doc)) return;
  const doc = htmlToDoc(html);
  const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content);
  view.dispatch(tr);
}

/** Release the claim if `key` currently holds it (a no-op otherwise —
 *  e.g. a pane that never became live, or already lost the claim to
 *  another pane). Leaves the last-loaded doc mounted; there is
 *  nothing meaningful to "unmount" a page-singleton engine to. */
export function release(key: string): void {
  if (currentBinding?.key === key) currentBinding = null;
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

let scheduled: ReturnType<typeof setTimeout> | null = null;
function scheduleOnChange(view: EditorView): void {
  if (scheduled) clearTimeout(scheduled);
  scheduled = setTimeout(() => {
    scheduled = null;
    if (!currentBinding || !bridgeModule) return;
    const html = bridgeModule.docToHtml(view.state.doc);
    lastEmittedByKey.set(currentBinding.key, html);
    currentBinding.onChange?.(html);
  }, 400);
}

/** Append a plugin that reports doc changes to whichever binding is
 *  currently live, via `state.reconfigure` (preserves every other
 *  plugin's existing state — history, collab, etc. — so this never
 *  resets undo). Idempotent: only installs once per view lifetime,
 *  so repeated `claim()` calls don't stack duplicate plugins. */
function installOnChangePlugin(view: EditorView): EditorView {
  if (onChangePluginInstalled) return view;
  onChangePluginInstalled = true;
  const plugin = new Plugin({
    key: onChangePluginKey,
    view: () => ({
      update(v: EditorView, prevState: EditorState) {
        if (!v.state.doc.eq(prevState.doc)) scheduleOnChange(v);
      },
    }),
  });
  view.updateState(view.state.reconfigure({ plugins: [...view.state.plugins, plugin] }));
  return view;
}
