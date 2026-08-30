/**
 * Reformat Every Cite (AI) — the whole-document sweep built on top of
 * the single-selection cite creator (`cite-creator.ts`).
 *
 * Every `cite_paragraph` in the doc is fed to the same prompt, the same
 * parser and the same transaction builder the `aiCreateCite` command
 * uses, one paragraph at a time. Nothing about the per-cite behaviour is
 * re-implemented here; this module is the *driver*:
 *
 *   - **Confirm first.** One model request per cite means real money and
 *     real minutes, so the pass never starts without an explicit OK that
 *     states the request count.
 *   - **Sequential, one lease at a time.** A lease per in-flight cite
 *     (never all of them at once): a whole-doc lease would lock the user
 *     out of typing for the entire run, and holding N leases would make
 *     every keystroke run N region-diffs in `coordinatorBlocks`.
 *   - **Re-scan between cites instead of caching positions.** The pass
 *     walks forward with a document cursor and asks the *live* doc for
 *     the next cite each iteration. That survives user edits elsewhere,
 *     the length change of the cite we just rewrote, and the case where
 *     a rewritten paragraph loses its `cite_mark` and gets demoted out
 *     of `cite_paragraph` by the classifier — all of which would
 *     invalidate a precomputed position list or an ordinal index.
 *   - **One transaction per cite.** Partial progress survives a failure
 *     mid-pass, and a bad cite can be undone on its own. The flip side
 *     (N undo steps) is called out in the confirm text.
 *   - **Escape stops it.** The pass checks a cancel flag between cites;
 *     the request already in flight still lands.
 *   - **One pass per pane.** Per-cite leases leave nothing for a second
 *     invocation over the same document to collide with, so re-entrance
 *     is refused explicitly (`runningPasses`) rather than by the
 *     coordinator. Another pane is another document, and runs freely.
 */

import type { EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { settings } from '../settings.js';
import { aiFailureNotice, aiGateToast, callLlm, LlmError, activeApiKey } from './llm.js';
import { AiActivity } from './ai-activity.js';
import { claimRegion } from './edit-coordinator.js';
import { showConfirm } from '../confirm-dialog.js';
import { isAnyOverlayOpen } from '../overlay-stack.js';
import { getElectronHost } from '../host/index.js';
import { showToast } from '../toast.js';
import { postNotice } from '../status-notices.js';
import {
  DEFAULT_AI_CITE_PROMPT,
  CITE_TOKENS_MARKED_META,
  buildCiteTransaction,
  parseCiteResponse,
  resolveCitePrompt,
} from './cite-creator.js';

/** One cite paragraph to reformat. `from`/`to` bound its INLINE content
 *  (not the node), so the range handed to the cite builder is exactly
 *  what a user selection over the paragraph's text would be — no
 *  adjacent content, hence no own-paragraph split on apply. */
export interface CiteTarget {
  /** Position of the `cite_paragraph` node itself. */
  pos: number;
  from: number;
  to: number;
  /** The paragraph's text, trimmed. Empty for a blank cite line. */
  text: string;
}

function targetFor(node: PMNode, pos: number): CiteTarget {
  return {
    pos,
    from: pos + 1,
    to: pos + node.nodeSize - 1,
    text: node.textContent.trim(),
  };
}

/** Every non-empty `cite_paragraph` in the doc, in document order. Used
 *  for the up-front count in the confirm prompt; the pass itself
 *  re-scans as it goes (see `nextCiteParagraph`). */
export function collectCiteParagraphs(doc: PMNode): CiteTarget[] {
  const out: CiteTarget[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== 'cite_paragraph') return true;
    const t = targetFor(node, pos);
    if (t.text) out.push(t);
    // Cite paragraphs are textblocks — nothing inside to visit.
    return false;
  });
  return out;
}

/** The first `cite_paragraph` at or after `cursor`, read from the LIVE
 *  doc. The pass advances `cursor` past each paragraph it handles, and a
 *  handled paragraph always starts strictly before the new cursor, so
 *  this never returns the same paragraph twice — including when the
 *  rewritten cite is longer or shorter than the original. */
export function nextCiteParagraph(doc: PMNode, cursor: number): CiteTarget | null {
  let found: CiteTarget | null = null;
  doc.descendants((node, pos) => {
    if (found) return false;
    if (node.type.name !== 'cite_paragraph') return true;
    if (pos >= cursor) found = targetFor(node, pos);
    return false;
  });
  return found;
}

/** Outcome tallies, so the summary toast can be honest about what
 *  happened across a long run. Exported for the tests. */
export interface ReformatAllCitesSummary {
  /** Cites rewritten in the doc. */
  done: number;
  /** Cites whose request or apply failed (each logged to the console). */
  failed: number;
  /** Cites skipped because another AI edit held the range. */
  skipped: number;
  /** Rewritten cites whose author/date token found no home, so the
   *  paragraph carries no `cite_mark` and reads as body text. */
  unstyled: number;
  /** Whether the user stopped the pass with Escape. */
  cancelled: boolean;
  /** Whether the pass gave up after `FAILURE_STREAK_LIMIT` failures in a
   *  row — a dead key or an exhausted quota fails identically on every
   *  remaining cite, so grinding through hundreds of them helps nobody. */
  halted: boolean;
  /** Whether cites appeared after the confirm (pasted in mid-run) and
   *  were left alone: the pass makes at most the number of requests the
   *  user authorized. */
  cappedOut: boolean;
}

/** Consecutive failures that end a pass. Two is within the noise of a
 *  flaky connection (each request has already burned its own internal
 *  retry); three in a row means the run is not going to recover. */
const FAILURE_STREAK_LIMIT = 3;

function summaryMessage(s: ReformatAllCitesSummary, total: number): string {
  const parts = [`Reformatted ${s.done} of ${total} cite${total === 1 ? '' : 's'}`];
  if (s.failed) parts.push(`${s.failed} failed`);
  if (s.skipped) parts.push(`${s.skipped} skipped (busy)`);
  if (s.unstyled) parts.push(`${s.unstyled} left unstyled — F8 the author/date`);
  if (s.halted) parts.push('stopped after repeated failures');
  if (s.cappedOut) parts.push('cites added during the run were left alone');
  if (s.cancelled) parts.push('stopped');
  return parts.join(' · ') + '.';
}

/** Is this keystroke the running pane's business? True when the event —
 *  or, failing that, wherever focus currently sits — is inside this
 *  view's editor DOM. */
function ownsKey(view: EditorView, target: EventTarget | null): boolean {
  const within = (n: unknown): boolean => n instanceof Node && view.dom.contains(n);
  return within(target) || within(document.activeElement);
}

/** Escape-to-stop, installed only while a pass runs. Stands down while a
 *  modal is open so it can't swallow a dialog's own Escape.
 *
 *  Scoping: a lone pass answers to any Escape, wherever focus is — the
 *  reach it has always had. Once a second pane is also running, each
 *  pass takes only the keystrokes belonging to its own pane, so stopping
 *  one never stops the other. (Both handlers sit on `window`, and
 *  `stopPropagation` does not stop listeners on the same node, so
 *  without this check a single Escape would cancel every pass at once.) */
/** The stop-key hint, host-aware: on web a single Escape doesn't
 *  reliably stop the pass (field-tested repeatedly, 2026-08-18 —
 *  cause undiagnosed; the user-accepted behavior is a double tap),
 *  so the UI says what actually works there. */
function escStopHint(): string {
  return getElectronHost() ? 'Esc to stop' : 'double-tap Esc to stop';
}

function installCancelKey(view: EditorView, onCancel: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape' || isAnyOverlayOpen()) return;
    if (runningPasses.size > 1 && !ownsKey(view, e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    onCancel();
  };
  window.addEventListener('keydown', onKey, true);
  return () => window.removeEventListener('keydown', onKey, true);
}

// --------------------------- command ----------------------------

/** Panes with a pass in flight. Serves two purposes: refusing a second
 *  pass over a document already being swept, and telling `installCancelKey`
 *  whether Escape has to be scoped.
 *
 *  Per pane rather than app-wide because panes hold distinct documents —
 *  the shell focuses an already-open file instead of loading it into a
 *  second slot — so two passes in two panes are two different documents'
 *  cites, and refusing the second would be an arbitrary restriction. What
 *  must not happen is two passes over the SAME document, which would send
 *  (and bill) every cite twice; the single-selection AI commands get that
 *  from the coordinator, since each holds a lease over its selection for
 *  the whole request, but this pass leases one cite at a time by design
 *  and so has nothing to collide with. Windows need no coordination at
 *  all: each is its own renderer, hence its own copy of this module. */
const runningPasses = new Set<EditorView>();

/** Entry point — fires on the `reformatAllCites` ribbon command. The
 *  returned promise settles when the whole pass is done (the ribbon hook
 *  voids it; the tests await it). */
export async function runReformatAllCites(view: EditorView): Promise<void> {
  if (runningPasses.has(view)) {
    showToast('A cite reformat pass is already running in this document.');
    return;
  }
  runningPasses.add(view);
  try {
    if (!aiGateToast()) return;
    const apiKey = activeApiKey();
    const total = collectCiteParagraphs(view.state.doc).length;
    if (total === 0) {
      showToast('No cites in this document.');
      return;
    }

    const systemPrompt = resolveCitePrompt(
      settings.get('aiCitePrompt').trim() || DEFAULT_AI_CITE_PROMPT,
    );

    // The confirm is inside the guard: the dialog is the longest window
    // in which a second invocation could land, and two stacked confirms
    // would each start a pass.
    const ok = await showConfirm({
      title: 'Reformat every cite with AI?',
      message:
        `${total} cite${total === 1 ? '' : 's'} in this document will be sent to the AI ` +
        `one at a time and rewritten in place.\n\n` +
        `That is ${total} model request${total === 1 ? '' : 's'}, so it costs ${total} ` +
        `call${total === 1 ? '' : 's'} against your API key and can take a while. ` +
        `Each cite is its own undo step, and ${
          getElectronHost() ? 'Escape stops the pass' : 'double-tapping Escape stops the pass'
        }.`,
      confirmLabel: `Reformat ${total} cite${total === 1 ? '' : 's'}`,
      cancelLabel: 'Cancel',
    });
    if (!ok) return;
    await reformatAllCites(view, apiKey, systemPrompt, total);
  } finally {
    runningPasses.delete(view);
  }
}

async function reformatAllCites(
  view: EditorView,
  apiKey: string,
  systemPrompt: string,
  total: number,
): Promise<void> {
  const s: ReformatAllCitesSummary = {
    done: 0,
    failed: 0,
    skipped: 0,
    unstyled: 0,
    cancelled: false,
    halted: false,
    cappedOut: false,
  };
  let activity: AiActivity | null = null;
  const removeCancelKey = installCancelKey(view, () => {
    if (s.cancelled) return;
    s.cancelled = true;
    activity?.setStage('stopping after this cite');
  });
  let cursor = 0;
  // Ordinal for the progress readout. Bumped only for paragraphs the
  // pass actually takes on, so it stays in step with `total`, which
  // counts non-empty cites only. A blank `cite_paragraph` sitting ahead
  // of real ones must not burn a number, or the readout reads "Cite 3
  // of 2".
  let n = 0;
  // Failures since the last success — see FAILURE_STREAK_LIMIT.
  let streak = 0;

  try {
    while (!s.cancelled) {
      // Checked at the top so every failure path reaches it — two of
      // them `continue` out of the middle of the loop. A key, quota or
      // endpoint that is simply not working fails the same way on every
      // remaining cite; stop once that is clear rather than walking the
      // whole document to prove it.
      if (streak >= FAILURE_STREAK_LIMIT) {
        s.halted = true;
        break;
      }
      const target = nextCiteParagraph(view.state.doc, cursor);
      if (!target) break;
      // Advance past this paragraph BEFORE any await: a `continue` from
      // here must not re-find it. Corrected from the live lease once the
      // cite is done with, however it ended.
      cursor = target.to;
      if (!target.text) continue;
      // The confirm authorized exactly `total` requests. Cites pasted in
      // while the pass runs are none of its business — billing past the
      // number the user agreed to is worse than leaving them for a
      // second run, and the readout could otherwise say "Cite 9 of 7".
      if (n >= total) {
        s.cappedOut = true;
        break;
      }
      n++;

      const lease = claimRegion(view, { from: target.from, to: target.to }, { label: 'cite' });
      if (!lease) {
        s.skipped++;
        continue;
      }
      try {
        const range = { from: target.from, to: target.to };
        if (activity) activity.setRange(range);
        else {
          activity = new AiActivity(view, range, 'selection');
          activity.start();
        }
        activity.setStage(`reformatting cite ${n} of ${total} · ${escStopHint()}`);

        const reply = await callLlm({
          apiKey,
          system: systemPrompt,
          messages: [{ role: 'user', content: target.text }],
        });
        const parsed = parseCiteResponse(reply.text);
        // Apply at the lease's CURRENT bounds — user edits elsewhere in
        // the doc during the request have shifted them.
        const region = lease.region();
        if (!region) {
          console.warn(`[cite-all] cite ${n}: range no longer in the document`);
          s.failed++;
          streak++;
          continue;
        }
        // `buildCiteTransaction` rather than `applyCiteToSelection`: the
        // latter toasts per unstyled cite, which across a whole document
        // is a toast storm. Tally instead and report once at the end.
        const tr = buildCiteTransaction(view.state, region.from, region.to, parsed);
        if (!tr) {
          s.failed++;
          streak++;
          continue;
        }
        lease.apply(tr);
        if (parsed.tokens.length > 0 && tr.getMeta(CITE_TOKENS_MARKED_META) === 0) s.unstyled++;
        s.done++;
        streak = 0;
      } catch (e) {
        const msg = e instanceof LlmError ? e.message : e instanceof Error ? e.message : String(e);
        console.warn(`[cite-all] cite ${n} failed: ${msg}`);
        s.failed++;
        streak++;
        // Auth / model / config failures repeat on every remaining cite;
        // stop rather than burning the whole document down on them.
        if (e instanceof LlmError && (e.kind === 'auth' || e.kind === 'model')) {
          aiFailureNotice('Reformat cites', e);
          break;
        }
      } finally {
        // Re-read the cursor from the LIVE lease on EVERY exit path, not
        // just the rewrite: positions move while a request is in flight
        // (the user edits above the cite), so a failed cite would
        // otherwise leave the cursor pointing past cites that then never
        // got visited — silently under-reporting the run. Null means the
        // range is gone entirely, and there is no mapped position left to
        // trust; the stale cursor at least cannot re-send an earlier
        // cite. Must precede `release()`, which drops the lease.
        const end = lease.region();
        if (end) cursor = end.to;
        lease.release();
      }
    }
  } finally {
    removeCancelKey();
    activity?.stop();
  }

  // Chip entry too: the audit flagged this multi-clause summary as
  // un-toastable at any duration, and it's the record of what the run
  // did (and skipped) to the user's cites.
  postNotice({
    severity: s.failed || s.halted ? 'warning' : 'info',
    title: 'Reformat All Cites finished',
    body: summaryMessage(s, total),
  });
}
