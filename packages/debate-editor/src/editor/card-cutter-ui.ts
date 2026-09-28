/**
 * Card-cutter launch sheet — the configuration flow.
 *
 * Asks only what the user knows up front: how long the read should be
 * (read-time) and what they're using the card for (intent). Then,
 * when enabled, runs the describe-then-generate clarifying step: the
 * engine proposes ≤3 candidate cuts (descriptions, not generations)
 * and the user picks one before anything is cut.
 *
 * Reuses the app's `pmd-route-overlay` / `pmd-route-dialog` chrome.
 */

import type { EditorView } from 'prosemirror-view';
import { settings } from './settings.js';
import { AiWorkingBox } from './ai/ai-working-box.js';
import { aiInFlightText } from './comments-ui.js';
import { showToast } from './toast.js';
import {
  cutFocusedCard,
  proposeFocusedOmissions,
  setSectionOmitted,
  previewOmissionSection,
  refineHighlightFocusedCard,
  addHighlightFocusedCard,
  hasCardSubSelection,
  ensureEngine,
  addCutterFlag,
  pendingCutterFlags,
  removeCutterFlag,
  clearCutterFlags,
  focusedPlainCard,
  resolveCardById,
  jumpToCard,
  cardLabel,
  cardReadStats,
  cardStatusOf,
  selectionBulkTargets,
  bulkCutCards,
  type BulkTargets,
  type BulkCutSummary,
  type CutFlag,
  type CutSession,
  type FocusedCard,
  type OmissionSection,
} from './card-cutter-port.js';
import { showConfirm } from './confirm-dialog.js';
import { isAnyOverlayOpen } from './overlay-stack.js';

const READ_TIME_PRESETS = [8, 12, 20, 30];

/** Which read-length chip the cut panel opens with, from the setting.
 *  0 (the default) = Efficient / no cap → null. Any other value snaps
 *  to the nearest preset — the setting predates this UI as a free
 *  number field, so a legacy 15 must land on a real chip (12) rather
 *  than leaving the panel pressed on nothing. Exported for tests. */
export function defaultReadTimeSec(): number | null {
  const raw = settings.get('cardCutterReadTimeSec');
  if (!raw || raw <= 0) return null;
  let best = READ_TIME_PRESETS[0]!;
  for (const p of READ_TIME_PRESETS) {
    if (Math.abs(p - raw) < Math.abs(best - raw)) best = p;
  }
  return best;
}

export async function openCutLaunchSheet(view: EditorView, targetCardId?: string): Promise<void> {
  if (!(await ensureEngine())) {
    showToast('Card-cutter engine not loaded.');
    return;
  }
  // A selection spanning several cards → the bulk flow. (Skipped when a
  // narrowed target came in — that IS the bulk single-card route.)
  if (!targetCardId) {
    const multi = selectionBulkTargets(view);
    if (multi) {
      if (multi.actionable.length === 0) {
        showToast(
          multi.alreadyCut > 0
            ? `All ${multi.alreadyCut} cuttable card${multi.alreadyCut === 1 ? '' : 's'} in this selection ${multi.alreadyCut === 1 ? 'is' : 'are'} already cut.`
            : 'No cuttable cards in this selection.',
        );
        return;
      }
      if (multi.actionable.length >= 2) {
        await runBulkCut(view, multi);
        return;
      }
      // Exactly one card actually needs cutting — the ordinary panel,
      // aimed at THAT card (not whichever card holds the cursor).
      await openCutLaunchSheet(view, multi.actionable[0]!.cardId);
      return;
    }
  }
  // The card this panel is FOR — captured now (by id when the bulk
  // classifier chose it, from the cursor otherwise), so the cut targets
  // it even if the cursor wanders meanwhile.
  const target = targetCardId ? resolveCardById(view, targetCardId) : focusedPlainCard(view);
  if (!target) {
    showToast(
      targetCardId
        ? 'That card is no longer in the document.'
        : 'Put the cursor in a card with body text first.',
    );
    return;
  }
  const status = cardStatusOf(target);
  if (status.hasHighlight) {
    // Already cut. A sub-selection means "add highlight here"; otherwise
    // offer the shorten / tighten / add sheet.
    if (hasCardSubSelection(view)) {
      void addHighlightFocusedCard(view);
    } else {
      openHighlightDownSheet(view, target);
    }
    return;
  }
  const highlightOnly = status.hasUnderline; // underlined → highlight only
  // Hoisted onGo can't see the null-guard narrowing; capture the id.
  const targetId = target.cardId;

  // NON-MODAL panel: the doc stays interactive so the user can select
  // chunks of the card and annotate them (U = play up / green, D =
  // play down / red) while the panel is open. Escape cancels, the Cut
  // button (or ⌘↩) fires.
  const dialog = document.createElement('div');
  dialog.className = 'pmd-cardcutter-panel';

  const header = document.createElement('div');
  header.className = 'pmd-route-header';
  header.textContent = highlightOnly ? 'Highlight card' : 'Cut card';
  dialog.appendChild(header);
  dialog.appendChild(cardIdentityRow(view, target));

  // Dashed purple box around the card the panel will act on — the
  // "about to work here" counterpart to the solid working box. Tracks
  // the card's live position, so annotating or editing keeps it aligned.
  const targetBox = new AiWorkingBox('target');
  targetBox.show(view, { from: target.cardFrom, to: target.cardTo });
  const retrackBox = (): void => {
    const live = target.cardId ? resolveCardById(view, target.cardId) : null;
    if (live) targetBox.setRange({ from: live.cardFrom, to: live.cardTo });
  };

  const close = (discardFlags: boolean): void => {
    if (discardFlags) clearCutterFlags(view);
    targetBox.hide();
    dialog.remove();
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('keyup', retrackBox, true);
    document.removeEventListener('mouseup', retrackBox, true);
  };
  const inPanelInput = (t: EventTarget | null): boolean =>
    t instanceof HTMLElement && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT');
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(true);
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      void onGo();
      return;
    }
    // Annotation hotkeys — single keys, so they must never fire while
    // typing intent text or with a modifier chord held.
    if (e.metaKey || e.ctrlKey || e.altKey || inPanelInput(e.target)) return;
    const k = e.key.toLowerCase();
    if (k !== 'u' && k !== 'd') return;
    e.preventDefault();
    e.stopPropagation();
    const flag = addCutterFlag(view, k === 'u' ? 'up' : 'down');
    if (!flag) {
      showToast(`Select text in the card, then press ${k.toUpperCase()}.`);
      return;
    }
    appendFlagRow(flag);
  };

  // ── Read length (optional cap; the setting picks the opening chip) ──
  // null = no cap (cut as efficiently as possible). A time chip caps
  // the read via the secondary de-highlight; it never pads up to it.
  let readTimeSec: number | null = defaultReadTimeSec();
  const rtSection = document.createElement('div');
  rtSection.className = 'pmd-cardcutter-section';
  rtSection.appendChild(label('Read length'));
  const rtRow = document.createElement('div');
  rtRow.className = 'pmd-cardcutter-chips';
  const wpm = firstReaderWpm();
  const press = (active: HTMLButtonElement): void =>
    rtRow.querySelectorAll('.pmd-cardcutter-chip').forEach((c) =>
      c.setAttribute('aria-pressed', String(c === active)),
    );
  const noCap = document.createElement('button');
  noCap.type = 'button';
  noCap.className = 'pmd-cardcutter-chip';
  noCap.textContent = 'Efficient (no limit)';
  noCap.setAttribute('aria-pressed', String(readTimeSec === null));
  noCap.addEventListener('click', () => {
    readTimeSec = null;
    press(noCap);
  });
  rtRow.appendChild(noCap);
  const chipFor = (sec: number): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pmd-cardcutter-chip';
    b.textContent = `≤ ${sec}s · ~${Math.round((sec * wpm) / 60)}w`;
    b.setAttribute('aria-pressed', String(readTimeSec === sec));
    b.addEventListener('click', () => {
      readTimeSec = sec;
      press(b);
    });
    return b;
  };
  for (const sec of READ_TIME_PRESETS) rtRow.appendChild(chipFor(sec));
  rtSection.appendChild(rtRow);
  dialog.appendChild(rtSection);

  // ── Intent (free-form) ──
  // Purpose is the #1 selection lever, and canned categories flatten
  // it — a prose line ("2AC answer to the courts CP", "impact card,
  // play up escalation") goes straight to the engine as this cut's
  // stated purpose. Optional: blank = infer from the file context.
  const intentSection = document.createElement('div');
  intentSection.className = 'pmd-cardcutter-section';
  intentSection.appendChild(label('What’s this cut for? (optional)'));
  const intentInput = document.createElement('textarea');
  intentInput.className = 'pmd-cardcutter-intent';
  intentInput.rows = 2;
  intentInput.placeholder =
    'e.g. “2AC answer to the courts counterplan — the delay warrant matters most”';
  intentSection.appendChild(intentInput);
  dialog.appendChild(intentSection);

  // ── Annotations (select in the card → U / D) ──
  // The doc stays live under this panel: select a chunk, press U to
  // tint it green (play up) or D to tint it red (play down). Each
  // annotation is listed here with a ✕; the engine receives them as
  // this cut's play-up / play-down directives.
  const flagSection = document.createElement('div');
  flagSection.className = 'pmd-cardcutter-section';
  flagSection.appendChild(label('Play up / play down (optional)'));
  const flagHint = document.createElement('div');
  flagHint.className = 'pmd-cardcutter-flag-hint';
  flagHint.innerHTML =
    'Select text in the card, then press <kbd>U</kbd> to play up (green) or <kbd>D</kbd> to play down (red).';
  flagSection.appendChild(flagHint);
  const flagList = document.createElement('div');
  flagSection.appendChild(flagList);
  const appendFlagRow = (f: CutFlag): void => {
    flagList.appendChild(flagRow(view, f));
  };
  // Stale flags from an earlier panel in this doc (e.g. it was closed
  // by a failed cut) are still pending — show them.
  for (const f of pendingCutterFlags()) appendFlagRow(f);
  dialog.appendChild(flagSection);

  // ── Buttons ──
  const buttons = document.createElement('div');
  buttons.className = 'pmd-text-prompt-buttons';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'pmd-route-cancel';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => close(true));
  buttons.appendChild(cancel);
  const go = document.createElement('button');
  go.type = 'button';
  go.className = 'pmd-text-prompt-ok';
  go.textContent = highlightOnly ? 'Highlight' : 'Cut';
  go.dataset['label'] = go.textContent;
  go.title = '⌘↩';
  go.addEventListener('click', () => {
    void onGo();
  });
  buttons.appendChild(go);
  dialog.appendChild(buttons);

  document.addEventListener('keydown', onKey, true);
  // Re-anchor after anything that can move the card (typing above it,
  // a selection change that scrolls). Cheap: one id lookup.
  document.addEventListener('keyup', retrackBox, true);
  document.addEventListener('mouseup', retrackBox, true);
  document.body.appendChild(dialog);

  async function onGo(): Promise<void> {
    // Keep the flags — cutFocusedCard consumes and clears them (and
    // their tints) itself.
    const intent = intentInput.value.trim();
    close(false);
    const session = await cutFocusedCard(view, {
      // By identity: the panel outlives its opening moment, and the cut
      // must land on the boxed card, not wherever the cursor ended up.
      ...(targetId ? { cardId: targetId } : {}),
      ...(intent ? { intent } : {}),
      ...(readTimeSec ? { readTimeSec } : {}),
    });
    if (!session) return;
    // Cap missed → the manual trim checklist first (its Done chains into
    // the review loop). Otherwise straight to review: accept, or point
    // at what to change and go around again.
    if (readTimeSec && session.shortfall) {
      showToast(aiInFlightText('finding optional sections'));
      const sections = await proposeFocusedOmissions(session);
      if (sections.length > 0) {
        openTrimChecklist(view, session, sections, readTimeSec);
        return;
      }
      showToast(`Couldn't reach ≤${readTimeSec}s without dropping a warrant.`);
    }
    if (session.focused.cardId) openPostCutReview(view, session.focused.cardId);
  }
}

/** One bulk pass may run per pane at a time (panes hold different
 *  docs; two runs over one doc would fight over leases and Escape). */
const bulkRunning = new Set<EditorView>();

function bulkSummaryMessage(s: BulkCutSummary): string {
  const parts: string[] = [];
  if (s.cut) parts.push(`cut ${s.cut} card${s.cut === 1 ? '' : 's'}`);
  if (s.finished) parts.push(`finished ${s.finished}`);
  if (s.skipped) parts.push(`${s.skipped} skipped`);
  if (s.failed) parts.push(`${s.failed} failed`);
  if (s.shortfalls) parts.push(`${s.shortfalls} over the length cap`);
  if (s.halted) parts.push('stopped after repeated failures');
  if (s.stopped) parts.push('stopped');
  if (parts.length === 0) return 'Bulk cut: nothing to do.';
  const line = parts.join(' · ');
  return `${line.charAt(0).toUpperCase()}${line.slice(1)} — each card is its own undo step.`;
}

/** Confirm, then run the bulk queue with a floating progress chip.
 *  Bulk asks nothing per card: default read length from settings, no
 *  intent, no flags, no per-card review panels — skipped cards and
 *  missed caps are counted into the summary toast instead. */
async function runBulkCut(view: EditorView, multi: BulkTargets): Promise<void> {
  if (bulkRunning.has(view)) {
    showToast('A bulk cut is already running in this pane.');
    return;
  }
  const n = multi.actionable.length;
  const toCut = multi.actionable.filter((a) => a.kind === 'cut').length;
  const toFinish = n - toCut;
  const breakdown: string[] = [];
  if (toCut) breakdown.push(`${toCut} to cut`);
  if (toFinish) breakdown.push(`${toFinish} partially cut to finish`);
  if (multi.alreadyCut) breakdown.push(`${multi.alreadyCut} already cut (left alone)`);
  const ok = await showConfirm({
    title: `Cut ${n} cards with AI?`,
    message:
      `Your selection spans ${breakdown.join(', ')}.\n\n` +
      `Each card is a full AI cut (several model calls) against your API key, run one ` +
      `at a time with your default settings — no per-card questions. Each card is its ` +
      `own undo step, and Escape or Stop ends the run after the current card.`,
    confirmLabel: `Cut ${n} cards`,
    cancelLabel: 'Cancel',
  });
  if (!ok) return;

  bulkRunning.add(view);
  let stopRequested = false;

  // Floating progress chip: count + Stop. Detail lives in the per-card
  // pill (stage · card i of n · Esc to stop), which tracks each card.
  const chip = document.createElement('div');
  chip.className = 'pmd-cardcutter-panel pmd-cardcutter-bulkchip';
  const textCol = document.createElement('div');
  const header = document.createElement('div');
  header.className = 'pmd-route-header';
  header.textContent = `Cutting ${n} cards`;
  textCol.appendChild(header);
  const statusLine = document.createElement('div');
  statusLine.className = 'pmd-cardcutter-stats';
  statusLine.textContent = `Card 1 of ${n}`;
  textCol.appendChild(statusLine);
  chip.appendChild(textCol);
  const stopBtn = document.createElement('button');
  stopBtn.type = 'button';
  stopBtn.className = 'pmd-route-cancel';
  stopBtn.textContent = 'Stop';
  stopBtn.title = 'Esc';
  const requestStop = (): void => {
    stopRequested = true;
    stopBtn.disabled = true;
    statusLine.textContent = 'Stopping after this card…';
  };
  stopBtn.addEventListener('click', requestStop);
  chip.appendChild(stopBtn);

  // Escape = Stop, but only when this pane's business: not while a
  // modal is up, not while typing in an input, and only when the
  // keystroke lands in this pane or on the chip itself.
  const inInput = (t: EventTarget | null): boolean =>
    t instanceof HTMLElement && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT');
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape' || isAnyOverlayOpen() || inInput(e.target)) return;
    const t = e.target instanceof Node ? e.target : null;
    if (t && !view.dom.contains(t) && !chip.contains(t) && t !== document.body) return;
    e.preventDefault();
    e.stopPropagation();
    requestStop();
  };
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(chip);

  try {
    const summary = await bulkCutCards(view, multi.actionable, {
      readTimeSec: defaultReadTimeSec(),
      shouldStop: () => stopRequested,
      onProgress: (done, total) => {
        if (!stopRequested) statusLine.textContent = `Card ${Math.min(done + 1, total)} of ${total}`;
      },
    });
    showToast(bulkSummaryMessage(summary), { durationMs: 6000 });
  } finally {
    document.removeEventListener('keydown', onKey, true);
    chip.remove();
    bulkRunning.delete(view);
  }
}

/**
 * The trim panel's header: a title/total row, with the card identity on
 * its OWN line beneath.
 *
 * The identity row is a block-level component — everywhere else it is
 * appended straight to a dialog and spans the full width, which is what
 * its internal `margin-left: auto` jump button and ellipsizing label
 * assume. Making it a flex sibling of the title (as this header once
 * did) put three items in one row inside a 24rem panel: the identity
 * label and the read-time total both set `white-space: nowrap` and so
 * refused to shrink, leaving the title as the only compressible item.
 * The title collapsed into a three-line column while everything else
 * overflowed past the panel's right edge.
 *
 * Exported for tests so that structure stays pinned.
 */
export function buildTrimHead(
  titleText: string,
  identity: HTMLElement,
): { head: HTMLElement; total: HTMLElement } {
  const head = document.createElement('div');
  head.className = 'pmd-cardcutter-trim-head';
  const top = document.createElement('div');
  top.className = 'pmd-cardcutter-trim-head-top';
  const title = document.createElement('div');
  title.className = 'pmd-cardcutter-trim-title';
  title.textContent = titleText;
  const total = document.createElement('div');
  total.className = 'pmd-cardcutter-trim-total';
  top.append(title, total);
  head.append(top, identity);
  return { head, total };
}

/** Apply-then-refine checklist: a floating panel listing the optional
 *  sections of a just-applied cut. Each row's count is engine-exact;
 *  unchecking removes that section's highlights live on the card. */
function openTrimChecklist(
  view: EditorView,
  session: CutSession,
  sections: OmissionSection[],
  capSec?: number | null,
): void {
  const wpm = firstReaderWpm();
  const secsFor = (words: number): number => Math.max(1, Math.round((words / wpm) * 60));

  const panel = document.createElement('div');
  panel.className = 'pmd-cardcutter-trim';

  // Cutting several cards in a row stacks these panels; name the card.
  const { head, total } = buildTrimHead(
    capSec ? `Couldn't hit ≤${capSec}s — trim more?` : 'Trim the read (optional)',
    cardIdentityRow(view, session.focused),
  );
  panel.appendChild(head);

  let readWords = session.readWords;
  const renderTotal = (): void => {
    total.textContent = `Read now: ${readWords}w · ~${secsFor(readWords)}s`;
  };
  renderTotal();

  const list = document.createElement('div');
  list.className = 'pmd-cardcutter-trim-list';
  for (const sec of sections) {
    const row = document.createElement('label');
    row.className = 'pmd-cardcutter-trim-row';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = true; // checked = kept
    cb.addEventListener('change', () => {
      const omit = !cb.checked;
      setSectionOmitted(view, session, sec, omit);
      readWords += omit ? -sec.words : sec.words;
      row.classList.toggle('pmd-cardcutter-trim-omitted', omit);
      renderTotal();
    });
    row.appendChild(cb);
    const box = document.createElement('span');
    box.className = 'pmd-cardcutter-trim-text';
    const lab = document.createElement('strong');
    lab.textContent = sec.label;
    const det = document.createElement('span');
    det.className = 'pmd-cardcutter-trim-detail';
    det.textContent = sec.description;
    box.appendChild(lab);
    box.appendChild(det);
    row.appendChild(box);
    const save = document.createElement('span');
    save.className = 'pmd-cardcutter-trim-save';
    save.textContent = `−${sec.words}w · ~${secsFor(sec.words)}s`;
    row.appendChild(save);
    // Hover preview: box the highlighted words this row would affect.
    row.addEventListener('mouseenter', () => previewOmissionSection(view, session, sec));
    row.addEventListener('mouseleave', () => previewOmissionSection(view, session, null));
    list.appendChild(row);
  }
  panel.appendChild(list);

  const foot = document.createElement('div');
  foot.className = 'pmd-cardcutter-trim-foot';
  const done = document.createElement('button');
  done.type = 'button';
  done.className = 'pmd-text-prompt-ok';
  done.textContent = 'Done';
  const close = (): void => {
    previewOmissionSection(view, session, null);
    panel.remove();
    document.removeEventListener('keydown', onKey);
    // The cut is applied and trimmed — same review loop as the cap-met
    // path: accept it, or point at what to change.
    if (session.focused.cardId) openPostCutReview(view, session.focused.cardId);
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close();
  };
  done.addEventListener('click', close);
  foot.appendChild(done);
  panel.appendChild(foot);

  document.addEventListener('keydown', onKey);
  document.body.appendChild(panel);
}

/** Refine the read — a compose-then-run dialog. Drop redundancy,
 *  skeletonize, and a target length are all OPTIONAL, composable
 *  settings; free-text guidance steers them, and can run on its own. */
function openHighlightDownSheet(view: EditorView, target: FocusedCard): void {
  // NON-MODAL, matching the cut panel: refining is an iterative act —
  // the user needs to read the live card, and to point at parts of it
  // with U / D, while deciding what to ask for. A modal overlay made
  // both impossible (it dimmed the card and swallowed every keystroke).
  const dialog = document.createElement('div');
  dialog.className = 'pmd-cardcutter-panel';

  const header = document.createElement('div');
  header.className = 'pmd-route-header';
  header.textContent = 'Refine highlighting';
  dialog.appendChild(header);
  dialog.appendChild(cardIdentityRow(view, target));

  // Same dashed "this is what I'll act on" box as the cut panel.
  const targetBox = new AiWorkingBox('target');
  targetBox.show(view, { from: target.cardFrom, to: target.cardTo });
  const retrackBox = (): void => {
    const live = target.cardId ? resolveCardById(view, target.cardId) : null;
    if (live) targetBox.setRange({ from: live.cardFrom, to: live.cardTo });
  };

  const close = (discardFlags = true): void => {
    if (discardFlags) clearCutterFlags(view);
    targetBox.hide();
    dialog.remove();
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('keyup', retrackBox, true);
    document.removeEventListener('mouseup', retrackBox, true);
  };
  const inPanelInput = (t: EventTarget | null): boolean =>
    t instanceof HTMLElement && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT');
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      run();
      return;
    }
    // U / D annotate the live card, exactly as in the cut panel — so a
    // refine can be steered by pointing as well as by typing.
    if (e.metaKey || e.ctrlKey || e.altKey || inPanelInput(e.target)) return;
    const k = e.key.toLowerCase();
    if (k !== 'u' && k !== 'd') return;
    e.preventDefault();
    e.stopPropagation();
    const flag = addCutterFlag(view, k === 'u' ? 'up' : 'down');
    if (!flag) {
      showToast(`Select text in the card, then press ${k.toUpperCase()}.`);
      return;
    }
    appendFlagRow(flag);
  };

  // ── Composable settings (all optional) ──
  let dropRedundancy = false;
  let skeletonize = false;
  // Adding is allowed BY DEFAULT: instructions like "bring back the
  // impact" and U-flags should just work. The engine's guided pass is
  // the only machinery that can add, and it only runs alongside the
  // subtractive toggles when adding is permitted — so the old opt-IN
  // silently inerted additive requests. Strictly-subtractive is the
  // special intent, so IT is the thing the user must say.
  let removeOnly = false;
  const toggleSection = document.createElement('div');
  toggleSection.className = 'pmd-cardcutter-section pmd-cardcutter-chips';
  const toggleChip = (text: string, onToggle: (on: boolean) => void): void => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pmd-cardcutter-chip';
    b.textContent = text;
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => {
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(on));
      onToggle(on);
    });
    toggleSection.appendChild(b);
  };
  toggleChip('Drop redundancy', (on) => (dropRedundancy = on));
  toggleChip('Skeletonize', (on) => (skeletonize = on));
  toggleChip('Remove only \u2014 never add', (on) => (removeOnly = on));
  dialog.appendChild(toggleSection);

  // ── Target length (optional; None by default) ──
  let chosenSec: number | null = null;
  const section = document.createElement('div');
  section.className = 'pmd-cardcutter-section';
  section.appendChild(label('Target length (optional)'));
  const row = document.createElement('div');
  row.className = 'pmd-cardcutter-chips';
  const wpm = firstReaderWpm();
  const pressTarget = (active: HTMLButtonElement): void =>
    row.querySelectorAll('.pmd-cardcutter-chip').forEach((c) =>
      c.setAttribute('aria-pressed', String(c === active)),
    );
  const noneChip = document.createElement('button');
  noneChip.type = 'button';
  noneChip.className = 'pmd-cardcutter-chip';
  noneChip.textContent = 'None';
  noneChip.setAttribute('aria-pressed', 'true');
  noneChip.addEventListener('click', () => {
    chosenSec = null;
    pressTarget(noneChip);
  });
  row.appendChild(noneChip);
  for (const sec of READ_TIME_PRESETS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pmd-cardcutter-chip';
    b.textContent = `${sec}s · ~${Math.round((sec * wpm) / 60)}w`;
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => {
      chosenSec = sec;
      pressTarget(b);
    });
    row.appendChild(b);
  }
  section.appendChild(row);
  dialog.appendChild(section);

  // ── Free-text guidance (optional; can run on its own) ──
  const fbSection = document.createElement('div');
  fbSection.className = 'pmd-cardcutter-section';
  fbSection.appendChild(label('Guidance (optional)'));
  const feedbackEl = document.createElement('textarea');
  feedbackEl.className = 'pmd-cardcutter-feedback';
  feedbackEl.rows = 2;
  feedbackEl.placeholder = 'e.g. keep the strongest impact phrasing; drop the China comparison';
  fbSection.appendChild(feedbackEl);
  dialog.appendChild(fbSection);

  // ── Point at parts of the card (U / D) ──
  const flagSection = document.createElement('div');
  flagSection.className = 'pmd-cardcutter-section';
  flagSection.appendChild(label('Play up / play down (optional)'));
  const flagHint = document.createElement('div');
  flagHint.className = 'pmd-cardcutter-flag-hint';
  flagHint.innerHTML =
    'Select text in the card, then press <kbd>U</kbd> to play up (green) or <kbd>D</kbd> to play down (red).';
  flagSection.appendChild(flagHint);
  const flagList = document.createElement('div');
  flagSection.appendChild(flagList);
  const appendFlagRow = (f: CutFlag): void => {
    flagList.appendChild(flagRow(view, f));
  };
  for (const f of pendingCutterFlags()) appendFlagRow(f);
  dialog.appendChild(flagSection);

  const buttons = document.createElement('div');
  buttons.className = 'pmd-text-prompt-buttons';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'pmd-route-cancel';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => close());
  buttons.appendChild(cancel);
  const go = document.createElement('button');
  go.type = 'button';
  go.className = 'pmd-text-prompt-ok';
  go.textContent = 'Refine';
  go.title = '⌘↩';
  go.addEventListener('click', run);
  buttons.appendChild(go);
  dialog.appendChild(buttons);

  function run(): void {
    const feedback = feedbackEl.value.trim();
    const flags = pendingCutterFlags();
    if (!dropRedundancy && !skeletonize && chosenSec === null && !feedback && flags.length === 0) {
      showToast('Pick a target or a setting, point at some text, or type guidance.');
      return;
    }
    // Keep the flags — refine consumes and clears them (and their tints).
    close(false);
    void refineHighlightFocusedCard(view, {
      ...(dropRedundancy ? { dropRedundancy: true } : {}),
      ...(skeletonize ? { skeletonize: true } : {}),
      ...(chosenSec !== null ? { readTimeSec: chosenSec } : {}),
      ...(feedback ? { feedback } : {}),
      ...(removeOnly ? {} : { allowAdd: true }),
      // Act on the card this sheet was opened for, not wherever the
      // cursor drifted while it was open (or while a sheet stacked
      // above it was being answered).
      ...(target.cardId ? { cardId: target.cardId } : {}),
    });
  }

  document.addEventListener('keydown', onKey, true);
  document.addEventListener('keyup', retrackBox, true);
  document.addEventListener('mouseup', retrackBox, true);
  document.body.appendChild(dialog);
}

// ── Post-cut review registry: cursor-driven multiplexing ──
// Several cuts can be under review at once (one panel each). Only ONE
// panel shows: the one whose card currently contains the cursor, or —
// while the cursor is elsewhere — the one that contained it last. That
// panel alone owns the keyboard, and U/D are consumed only when a
// non-empty selection sits inside ITS card; everywhere else the keys
// type (or pass through) normally.
interface ReviewHandle {
  view: EditorView;
  setVisible(v: boolean): void;
}
const openReviews = new Map<string, ReviewHandle>();
let activeReviewCardId: string | null = null;

function setActiveReview(cardId: string | null): void {
  activeReviewCardId = cardId;
  for (const [id, h] of openReviews) h.setVisible(id === cardId);
}

/** Selection moved: a cursor inside some open review's card makes that
 *  review active. A cursor outside every reviewed card changes nothing
 *  — "last contained" keeps the panel from flickering away while the
 *  user works nearby. */
function updateActiveReviewFromSelection(): void {
  for (const [id, h] of openReviews) {
    const live = resolveCardById(h.view, id);
    if (!live) continue;
    const { from, to } = h.view.state.selection;
    const touches =
      (from >= live.cardFrom && from <= live.cardTo) ||
      (to >= live.cardFrom && to <= live.cardTo);
    if (touches) {
      if (activeReviewCardId !== id) setActiveReview(id);
      return;
    }
  }
}

let reviewSelectionListener: (() => void) | null = null;
function ensureReviewSelectionListener(): void {
  if (reviewSelectionListener) return;
  // selectionchange fires on the DOM selection; ProseMirror mirrors it
  // into EditorState a beat later, so defer the read one tick.
  reviewSelectionListener = () => setTimeout(updateActiveReviewFromSelection, 0);
  document.addEventListener('selectionchange', reviewSelectionListener);
}
function dropReviewSelectionListenerIfIdle(): void {
  if (openReviews.size > 0 || !reviewSelectionListener) return;
  document.removeEventListener('selectionchange', reviewSelectionListener);
  reviewSelectionListener = null;
}

/** Post-cut review — the iteration loop. The cut is already applied;
 *  this panel offers the verdict on it. Accept (the default, ⌘↩ with
 *  nothing typed or flagged) simply closes. Otherwise the user points
 *  at regions with U / D — imprecise by design, the same feathered
 *  gesture as pre-cut — and/or types feedback, and Adjust sends ONE
 *  surgical model pass: smallest change that addresses the notes,
 *  everything else left exactly as highlighted. Then the panel reopens
 *  with fresh numbers, and the loop continues until Accept. (Exact
 *  by-the-character mark edits aren't this flow's job — that's just
 *  editing, available the moment the panel closes.) */
function openPostCutReview(view: EditorView, cardId: string): void {
  const target = resolveCardById(view, cardId);
  if (!target) return; // card gone (undo, delete) — nothing to review
  const stats = cardReadStats(view, cardId);

  const dialog = document.createElement('div');
  dialog.className = 'pmd-cardcutter-panel';

  const header = document.createElement('div');
  header.className = 'pmd-route-header';
  header.textContent = 'Review cut';
  dialog.appendChild(header);
  dialog.appendChild(cardIdentityRow(view, target));
  if (stats) {
    const statsRow = document.createElement('div');
    statsRow.className = 'pmd-cardcutter-stats';
    statsRow.textContent = `Read: ${stats.words}w \u00b7 ~${stats.seconds}s`;
    dialog.appendChild(statsRow);
  }

  const targetBox = new AiWorkingBox('target');
  targetBox.show(view, { from: target.cardFrom, to: target.cardTo });
  const retrackBox = (): void => {
    const live = resolveCardById(view, cardId);
    if (live) targetBox.setRange({ from: live.cardFrom, to: live.cardTo });
  };

  const close = (discardFlags = true): void => {
    if (discardFlags) clearCutterFlags(view);
    targetBox.hide();
    dialog.remove();
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('keyup', retrackBox, true);
    document.removeEventListener('mouseup', retrackBox, true);
    openReviews.delete(cardId);
    if (activeReviewCardId === cardId) {
      // Surface the most recent remaining review (if any) so pending
      // reviews never sit invisible with no hint they exist.
      let nextId: string | null = null;
      for (const id of openReviews.keys()) nextId = id;
      setActiveReview(nextId);
    }
    dropReviewSelectionListenerIfIdle();
  };
  const inPanelInput = (t: EventTarget | null): boolean =>
    t instanceof HTMLElement && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT');
  const onKey = (e: KeyboardEvent): void => {
    // Only the ACTIVE (visible) review owns the keyboard — a hidden
    // panel reacting to Escape/⌘↩/U/D would act on a card the user
    // isn't looking at.
    if (activeReviewCardId !== cardId) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(); // accept-equivalent: the cut stays, notes are discarded
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      // Accept by default; with notes pending, ⌘↩ means "apply them".
      if (feedbackEl.value.trim() || pendingCutterFlags().length > 0) void adjust();
      else close();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey || inPanelInput(e.target)) return;
    const k = e.key.toLowerCase();
    if (k !== 'u' && k !== 'd') return;
    // Cursor-sensitive consumption: U/D flag ONLY a non-empty selection
    // inside this review's card. A collapsed cursor, or a selection
    // outside the card, leaves the keystroke alone — so typing "u"
    // into the document keeps working while a review is open.
    const live = resolveCardById(view, cardId);
    const sel = view.state.selection;
    if (!live || sel.empty || sel.to < live.cardFrom || sel.from > live.cardTo) return;
    e.preventDefault();
    e.stopPropagation();
    const flag = addCutterFlag(view, k === 'u' ? 'up' : 'down');
    if (!flag) {
      // Residual: a whitespace-only selection inside the card.
      showToast(`Select text in the card, then press ${k.toUpperCase()}.`);
      return;
    }
    appendFlagRow(flag);
  };

  // ── Notes: point (U / D) and/or type ──
  const flagSection = document.createElement('div');
  flagSection.className = 'pmd-cardcutter-section';
  flagSection.appendChild(label('Not right? Point at it (optional)'));
  const flagHint = document.createElement('div');
  flagHint.className = 'pmd-cardcutter-flag-hint';
  flagHint.innerHTML =
    'Select roughly where, then press <kbd>U</kbd> to highlight more there or <kbd>D</kbd> to highlight less. Rough is fine \u2014 the model picks the words.';
  flagSection.appendChild(flagHint);
  const flagList = document.createElement('div');
  flagSection.appendChild(flagList);
  const appendFlagRow = (f: CutFlag): void => {
    flagList.appendChild(flagRow(view, f));
  };
  for (const f of pendingCutterFlags()) appendFlagRow(f);
  dialog.appendChild(flagSection);

  const fbSection = document.createElement('div');
  fbSection.className = 'pmd-cardcutter-section';
  fbSection.appendChild(label('Feedback (optional)'));
  const feedbackEl = document.createElement('textarea');
  feedbackEl.className = 'pmd-cardcutter-feedback';
  feedbackEl.rows = 2;
  feedbackEl.placeholder = 'e.g. the warrant about delay got lost \u2014 bring it back';
  fbSection.appendChild(feedbackEl);
  dialog.appendChild(fbSection);

  const buttons = document.createElement('div');
  buttons.className = 'pmd-text-prompt-buttons';
  const adjustBtn = document.createElement('button');
  adjustBtn.type = 'button';
  adjustBtn.className = 'pmd-route-cancel';
  adjustBtn.textContent = 'Adjust';
  adjustBtn.addEventListener('click', () => void adjust());
  buttons.appendChild(adjustBtn);
  const accept = document.createElement('button');
  accept.type = 'button';
  accept.className = 'pmd-text-prompt-ok';
  accept.textContent = 'Accept';
  accept.title = '\u2318\u21a9';
  accept.addEventListener('click', () => close());
  buttons.appendChild(accept);
  dialog.appendChild(buttons);

  async function adjust(): Promise<void> {
    const feedback = feedbackEl.value.trim();
    if (!feedback && pendingCutterFlags().length === 0) {
      showToast('Point at a region (U / D) or type feedback \u2014 or Accept.');
      return;
    }
    // Scope the send to THIS card: with several reviews open, flags
    // pointed at another card's regions must not steer this refine.
    const liveNow = resolveCardById(view, cardId);
    if (liveNow) {
      for (const f of pendingCutterFlags()) {
        if (f.to < liveNow.cardFrom || f.from > liveNow.cardTo) removeCutterFlag(view, f);
      }
    }
    // Keep the flags — the refine consumes and clears them.
    close(false);
    const ok = await refineHighlightFocusedCard(view, {
      cardId,
      surgical: true,
      // Adding must be possible: an "up" note is a request to read MORE.
      allowAdd: true,
      ...(feedback ? { feedback } : {}),
    });
    // Round again with fresh numbers — Accept is always the exit. On
    // failure reopen too (the notes are gone, but the loop survives).
    if (ok || resolveCardById(view, cardId)) openPostCutReview(view, cardId);
  }

  document.addEventListener('keydown', onKey, true);
  document.addEventListener('keyup', retrackBox, true);
  document.addEventListener('mouseup', retrackBox, true);
  document.body.appendChild(dialog);

  // Register with the cursor-driven multiplexer. A fresh cut's review
  // takes the foreground (its card is where the user just was); any
  // panel it displaces comes back when the cursor re-enters its card.
  openReviews.set(cardId, {
    view,
    setVisible: (v) => {
      dialog.style.display = v ? '' : 'none';
      if (v) targetBox.show(view, { from: target.cardFrom, to: target.cardTo });
      else targetBox.hide();
      if (v) retrackBox();
    },
  });
  setActiveReview(cardId);
  ensureReviewSelectionListener();
}

/** One annotation row: direction glyph, the quoted text, and a ✕ that
 *  removes both the row and its in-doc tint. Shared by the cut and
 *  refine panels — both point at text the same way. */
function flagRow(view: EditorView, f: CutFlag): HTMLElement {
  const row = document.createElement('div');
  row.className = 'pmd-cardcutter-flag';
  const dir = document.createElement('span');
  dir.className = `pmd-cardcutter-flag-dir is-${f.kind}`;
  dir.textContent = f.kind === 'up' ? '▲' : '▼';
  row.appendChild(dir);
  const quote = document.createElement('span');
  quote.className = 'pmd-cardcutter-flag-text';
  const t = f.text.length > 90 ? `${f.text.slice(0, 87)}…` : f.text;
  quote.textContent = `“${t}”`;
  row.appendChild(quote);
  const x = document.createElement('button');
  x.type = 'button';
  x.className = 'pmd-cardcutter-flag-remove';
  x.textContent = '✕';
  x.title = 'Remove this annotation';
  x.addEventListener('click', () => {
    removeCutterFlag(view, f);
    row.remove();
  });
  row.appendChild(x);
  return row;
}

/** "Card: <tag> — Jump to card". Every panel that can outlive the
 *  moment it was opened (or stack with another) shows one, so which
 *  card a set of controls belongs to is never a guess. The jump button
 *  moves the cursor and scrolls, leaving the panel open. */
function cardIdentityRow(view: EditorView, target: FocusedCard): HTMLElement {
  const row = document.createElement('div');
  row.className = 'pmd-cardcutter-card-id';
  const name = document.createElement('span');
  name.className = 'pmd-cardcutter-card-id-text';
  name.textContent = cardLabel(target);
  name.title = target.card.tag || '';
  row.appendChild(name);
  if (target.cardId) {
    const jump = document.createElement('button');
    jump.type = 'button';
    jump.className = 'pmd-cardcutter-card-id-jump';
    jump.textContent = 'Jump to card';
    jump.addEventListener('click', () => {
      if (!jumpToCard(view, target.cardId!)) {
        showToast('That card is no longer in the document.');
      }
    });
    row.appendChild(jump);
  }
  return row;
}

function label(text: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'pmd-cardcutter-label';
  el.textContent = text;
  return el;
}

function firstReaderWpm(): number {
  const r = settings.get('readers');
  return r[0]?.wpm && r[0].wpm > 0 ? r[0].wpm : 350;
}
