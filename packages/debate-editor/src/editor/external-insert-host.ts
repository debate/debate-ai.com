/**
 * Renderer-side handler for the Fast Debate Paste integration's
 * `POST /insert` requests (see the FDP integration spec in
 * `reference-docs/`).
 *
 * Wire:
 *   - Main process receives the HTTP `POST /insert` payload, picks
 *     the focused window's `webContents`, and sends an
 *     `external:insert-text` IPC with `{ requestId, text, role,
 *     newParagraph, omitted }`.
 *   - This module subscribes via the preload bridge, applies the
 *     insert against the focused window's live `EditorView` (or
 *     returns the right error if no editable doc is available /
 *     the doc is in read mode), and sends an
 *     `external:insert-result` IPC back with
 *     `{ requestId, ok, error?, docTitle? }`.
 *
 * Insertion itself goes through `buildExternalInsertTransaction`
 * (`./external-insert.ts`) so the renderer-side primitive is
 * shared with future F2 use and tested in isolation. We do NOT
 * route through `applyPlainPasteFromText` / `buildPlainTextSlice` /
 * PM's contextual fitting — the FDP spec is explicit on that
 * because that's the path the historical stray-tags bug came from.
 */

import type { EditorView } from 'prosemirror-view';
import {
  buildExternalInsertTransaction,
  buildExternalRichInsertTransaction,
  EXTERNAL_INSERT_HTML_MAX_BYTES,
  type ExternalInsertRole,
} from './external-insert.js';

interface InsertRequest {
  requestId: string;
  text: string;
  role: ExternalInsertRole;
  newParagraph: boolean;
  omitted: boolean;
  /** Doc-targeted insert: the pane uid to land in (from GET /docs).
   *  Absent = the legacy path — this window's focused view. */
  target?: string;
  /** Cite-emphasis substrings (role `cite`) — see ExternalInsertOpts. */
  citeTokens?: string[];
  /** Rich payload: CardMirror-native (or arbitrary) HTML. When present
   *  and it parses to usable content, it supersedes `text`/`role`/
   *  `citeTokens`; unusable html falls back to the text path — the
   *  same rendering an older CardMirror (which never reads this
   *  field) produces. */
  html?: string;
}

interface InsertResult {
  requestId: string;
  ok: boolean;
  error?: 'no-target-doc' | 'doc-readonly' | 'bad-request' | 'internal' | 'target-not-found';
  docTitle?: string;
}

/** Preload-exposed API surface this module reads. Defined here as
 *  a structural type so the renderer build doesn't take a
 *  build-time dependency on the desktop preload. */
interface ExternalInsertBridge {
  onExternalInsertRequest(handler: (req: InsertRequest) => void): () => void;
  sendExternalInsertResult(result: InsertResult): void;
}

export interface ExternalInsertHostOpts {
  /** Resolve the focused window's live editor view, or null when
   *  the focused surface isn't an editable doc (home screen,
   *  settings dialog, recovery sidebar, …). */
  getFocusedView: () => EditorView | null;
  /** Resolve a pane uid (from a doc-targeted insert) to its live view
   *  in THIS window — three-pane aware, focused or not. Absent on
   *  hosts without pane registries; targeted requests then fail with
   *  `target-not-found`. */
  resolveViewForUid?: (uid: string) => EditorView | null;
  /** The doc's user-facing label for the ack — filename if the
   *  doc has been saved, otherwise the synthesized title. May
   *  return null when no doc is open. */
  getFocusedDocTitle: () => string | null;
}

/** Mount the external-insert handler. Returns an unsubscribe
 *  function for tests / shutdown — boot-mode callers can ignore. */
export function installExternalInsertHost(opts: ExternalInsertHostOpts): () => void {
  const bridge = pickBridge();
  if (!bridge) return () => {};

  const unsubscribe = bridge.onExternalInsertRequest((req) => {
    const result = handle(req, opts);
    bridge.sendExternalInsertResult(result);
  });
  return unsubscribe;
}

function handle(req: InsertRequest, opts: ExternalInsertHostOpts): InsertResult {
  const requestId = req.requestId;
  try {
    if (
      typeof req.text !== 'string' ||
      typeof req.requestId !== 'string' ||
      typeof req.newParagraph !== 'boolean'
    ) {
      return { requestId, ok: false, error: 'bad-request' };
    }
    let view: EditorView | null;
    if (typeof req.target === 'string' && req.target) {
      // Doc-targeted: land in the addressed pane, focused or not.
      // A miss is target-not-found (doc closed since /docs listed it,
      // or main mis-routed) — never a silent fallback to a doc the
      // caller didn't name.
      view = opts.resolveViewForUid?.(req.target) ?? null;
      if (!view) return { requestId, ok: false, error: 'target-not-found' };
    } else {
      view = opts.getFocusedView();
    }
    if (!view || !view.editable) {
      // §4.5 splits these: no live editor view → no-target-doc;
      // view present but read mode has flipped `editable` false
      // (the read-mode plugin's gate) → doc-readonly.
      if (!view) return { requestId, ok: false, error: 'no-target-doc' };
      return { requestId, ok: false, error: 'doc-readonly' };
    }
    // Rich path first: valid html that parses to content wins; anything
    // else falls through to the text path (identical to how an older
    // CardMirror, which never reads `html`, renders this payload).
    if (
      typeof req.html === 'string' &&
      req.html.length > 0 &&
      req.html.length <= EXTERNAL_INSERT_HTML_MAX_BYTES
    ) {
      const richTr = buildExternalRichInsertTransaction(view.state, {
        html: req.html,
        newParagraph: req.newParagraph,
      });
      if (richTr) {
        view.dispatch(richTr.scrollIntoView());
        const richResult: InsertResult = { requestId, ok: true };
        if (!(typeof req.target === 'string' && req.target)) {
          const docTitle = opts.getFocusedDocTitle();
          if (docTitle) richResult.docTitle = docTitle;
        }
        return richResult;
      }
    }
    // citeTokens off the wire: keep only a well-formed string array.
    const citeTokens = Array.isArray(req.citeTokens)
      ? req.citeTokens.filter((t): t is string => typeof t === 'string' && t.length > 0)
      : undefined;
    const tr = buildExternalInsertTransaction(view.state, {
      text: req.text,
      role: req.role,
      newParagraph: req.newParagraph,
      ...(citeTokens && citeTokens.length > 0 ? { citeTokens } : {}),
    });
    if (!tr) {
      // schema didn't carry the body type we asked for — should never
      // happen on our schema; defensive rail only.
      return { requestId, ok: false, error: 'internal' };
    }
    view.dispatch(tr.scrollIntoView());
    const result: InsertResult = { requestId, ok: true };
    if (typeof req.target === 'string' && req.target) {
      // Targeted acks skip the focused-doc title (wrong doc); main
      // fills the addressed doc's name from its directory.
    } else {
      const docTitle = opts.getFocusedDocTitle();
      if (docTitle) result.docTitle = docTitle;
    }
    return result;
  } catch {
    return { requestId, ok: false, error: 'internal' };
  }
}

function pickBridge(): ExternalInsertBridge | null {
  const w = window as unknown as { electronAPI?: ExternalInsertBridge };
  const api = w.electronAPI;
  if (!api) return null;
  if (typeof api.onExternalInsertRequest !== 'function') return null;
  if (typeof api.sendExternalInsertResult !== 'function') return null;
  return api;
}
