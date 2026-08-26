/**
 * Repair Paragraph Integrity — the floating input bar that drives the
 * workflow in `repair-paragraph-plugin.ts`.
 *
 * Opened on a card (cursor inside it, or it selected). The user types a phrase
 * that should begin a paragraph; the plugin highlights every occurrence in the
 * card's body in green. When EXACTLY ONE remains, the bar flashes green and a
 * check appears — pressing Enter then splits the paragraph before the phrase
 * and clears the box for the next one. Escape exits.
 */

import type { EditorView } from 'prosemirror-view';
import type { ResolvedPos } from 'prosemirror-model';
import { undo } from 'prosemirror-history';
import {
  repairParagraphKey,
  getRepairParagraphState,
  splitAtSingleMatch,
  exitRepairParagraph,
  designatedCount,
} from './repair-paragraph-plugin.js';
import { isAnyOverlayOpen } from './overlay-stack.js';
import { quickCardSearchUI } from './quick-card-search-ui.js';

/** The [before, after] range of the nearest enclosing card / analytic_unit
 *  for `$pos`, or null if the cursor isn't inside one. */
function enclosingCardRange($pos: ResolvedPos): { from: number; to: number } | null {
  for (let d = $pos.depth; d >= 1; d--) {
    const name = $pos.node(d).type.name;
    if (name === 'card' || name === 'analytic_unit') {
      return { from: $pos.before(d), to: $pos.after(d) };
    }
  }
  return null;
}

export class RepairParagraphBar {
  private static readonly DEFAULT_HINT =
    'Narrow to one match, then Enter to break before it — Ctrl-Enter also indents it. Esc to exit.';
  private static readonly ONE_MATCH_HINT =
    'One match — Enter to break before it, or Ctrl-Enter to break and indent.';
  private readonly getView: () => EditorView | null;
  private readonly root: HTMLDivElement;
  private readonly input: HTMLInputElement;
  private readonly hint: HTMLDivElement;
  private open_ = false;
  /** Match count from the last query, to fire the flash only on the
   *  transition INTO the exactly-one state (not every keystroke). */
  private lastCount = -1;
  /** This session's actions, newest last, so Mod-Z can reverse the most recent
   *  one. `split` changed the doc only; `designate` added a designation only
   *  (Ctrl-Enter on an already-broken paragraph); `split-designate` did both. */
  private actionStack: Array<'split' | 'split-designate' | 'designate'> = [];

  constructor(getView: () => EditorView | null) {
    this.getView = getView;

    this.root = document.createElement('div');
    this.root.className = 'pmd-repair-para-bar';
    this.root.hidden = true;

    const title = document.createElement('div');
    title.className = 'pmd-repair-para-title';
    title.textContent = 'Repair Paragraph Integrity';

    const field = document.createElement('div');
    field.className = 'pmd-repair-para-field';

    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.className = 'pmd-repair-para-input';
    this.input.placeholder = 'Type a phrase that starts a paragraph…';
    this.input.spellcheck = false;
    this.input.autocomplete = 'off';

    const check = document.createElement('span');
    check.className = 'pmd-repair-para-check';
    check.setAttribute('aria-hidden', 'true');
    check.textContent = '✓';

    field.append(this.input, check);

    this.hint = document.createElement('div');
    this.hint.className = 'pmd-repair-para-hint';
    this.hint.textContent = RepairParagraphBar.DEFAULT_HINT;

    this.root.append(title, field, this.hint);
    document.body.appendChild(this.root);

    this.wireEvents();
  }

  private wireEvents(): void {
    this.input.addEventListener('input', () => this.applyQuery());
    this.input.addEventListener('keydown', (e) => {
      // Escape is owned by the document-level handler (onDocKeyDown) so it
      // exits the workflow even when focus has left the bar.
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        // Ctrl/Cmd-Enter also marks the new paragraph to be indented when the
        // workflow is exited.
        this.confirm(e.ctrlKey || e.metaKey);
      }
    });
  }

  /** Document-level Escape so the workflow can be exited even when the bar's
   *  input isn't focused (e.g. the cursor is back in the card). Capture phase
   *  so it runs before the editor; checked here (before anything pops itself in
   *  the bubble phase) it defers to whatever is layered over the workflow and
   *  owns Escape first — an overlay-stack modal, or the command bar (which isn't
   *  on the stack). */
  private onDocKeyDown = (e: KeyboardEvent): void => {
    if (!this.open_) return;
    // Defer to anything layered over the workflow that owns these keys first.
    if (isAnyOverlayOpen() || quickCardSearchUI.isOpen()) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.close();
      return;
    }
    // Mod-Z undoes the last break / indent mark made in this workflow (the bar's
    // empty input would otherwise just swallow it). Consume it whenever the
    // workflow is open so it can't fall through to the editor's global undo.
    if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      this.undoLast();
    }
  };

  /** Reverse the most recent workflow action: a split (via the editor's undo
   *  history) and/or its deferred-indent designation. No-op once the session's
   *  actions are exhausted — it never reaches back into pre-workflow history. */
  private undoLast(): void {
    const action = this.actionStack.pop();
    if (!action) return;
    const view = this.getView();
    if (!view) return;
    // 'split-designate' and 'designate' each added one designation — drop it.
    if (action !== 'split') {
      view.dispatch(view.state.tr.setMeta(repairParagraphKey, { type: 'popDesignation' }));
    }
    // 'split' and 'split-designate' changed the doc — reverse that split.
    if (action !== 'designate') {
      undo(view.state, view.dispatch);
    }
    this.input.value = '';
    this.root.classList.remove('pmd-repair-ok');
    this.lastCount = -1;
    const marked = designatedCount(view.state);
    const markedNote = marked > 0 ? ` (${marked} still marked to indent on exit)` : '';
    this.hint.textContent =
      (action === 'designate' ? 'Removed the last indent mark.' : 'Undid the last paragraph break.') +
      `${markedNote} Type the next phrase, or Esc to exit.`;
    this.input.focus();
  }

  open(): void {
    const view = this.getView();
    if (!view) return;
    const range = enclosingCardRange(view.state.selection.$from);
    if (!range) {
      // Not in a card — nothing to operate on. Briefly surface why.
      this.flashMessage('Put the cursor in a card first.');
      return;
    }

    view.dispatch(view.state.tr.setMeta(repairParagraphKey, { type: 'open', cardRange: range }));

    this.open_ = true;
    this.actionStack = [];
    document.addEventListener('keydown', this.onDocKeyDown, true);
    this.lastCount = -1;
    this.input.value = '';
    this.root.classList.remove('pmd-repair-ok');
    this.root.hidden = false;
    this.hint.textContent = RepairParagraphBar.DEFAULT_HINT;
    this.input.focus();
    this.pulse();
    this.applyQuery();
  }

  close(): void {
    if (!this.open_) return;
    this.open_ = false;
    document.removeEventListener('keydown', this.onDocKeyDown, true);
    this.root.hidden = true;
    this.root.classList.remove('pmd-repair-ok');
    const view = this.getView();
    if (view) {
      // Commit any deferred indents (Ctrl-Enter designations), then close.
      exitRepairParagraph(view);
      view.focus();
    }
  }

  /** Push the current input value into the plugin, then reflect the resulting
   *  match count in the bar (check + flash on reaching exactly one). */
  private applyQuery(): void {
    const view = this.getView();
    if (!view) return;
    view.dispatch(
      view.state.tr.setMeta(repairParagraphKey, { type: 'setQuery', query: this.input.value }),
    );
    const count = getRepairParagraphState(view.state).matches.length;
    const single = count === 1;
    this.root.classList.toggle('pmd-repair-ok', single);
    if (single && this.lastCount !== 1) {
      this.pulse();
      this.scrollSingleMatchIntoView(view);
    }
    if (this.input.value.trim().length === 0) {
      this.hint.textContent = RepairParagraphBar.DEFAULT_HINT;
    } else if (count === 0) {
      this.hint.textContent = 'No match in this card.';
    } else if (count === 1) {
      this.hint.textContent = RepairParagraphBar.ONE_MATCH_HINT;
    } else {
      this.hint.textContent = `${count} matches — keep typing to narrow to one.`;
    }
    this.lastCount = count;
  }

  private confirm(designate: boolean): void {
    const view = this.getView();
    if (!view) return;
    if (getRepairParagraphState(view.state).matches.length !== 1) return;
    const result = splitAtSingleMatch(view, designate);
    if (!result) return; // plain Enter on a phrase already starting a line → no-op
    // Record the action so Mod-Z can reverse it (newest last).
    this.actionStack.push(
      result === 'designated' ? 'designate' : designate ? 'split-designate' : 'split',
    );
    // The action cleared the query; reset the box for the next phrase.
    this.input.value = '';
    this.root.classList.remove('pmd-repair-ok');
    this.lastCount = 0;
    const marked = designatedCount(view.state);
    const markedNote =
      marked > 0
        ? ` (${marked} paragraph${marked === 1 ? '' : 's'} marked to indent on exit)`
        : '';
    if (result === 'designated') {
      this.hint.textContent = `Marked for indent — it already starts a line.${markedNote} Esc to apply and exit.`;
    } else if (designate) {
      this.hint.textContent = `Paragraph break added and marked for indent.${markedNote} Esc to apply and exit.`;
    } else {
      this.hint.textContent = `Paragraph break added.${markedNote} Type the next phrase, or Esc to exit.`;
    }
    this.input.focus();
  }

  private scrollSingleMatchIntoView(view: EditorView): void {
    const s = getRepairParagraphState(view.state);
    if (s.matches.length !== 1) return;
    try {
      const dom = view.domAtPos(s.matches[0]!.from).node;
      const el = dom.nodeType === Node.ELEMENT_NODE ? (dom as HTMLElement) : dom.parentElement;
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } catch {
      /* off-screen scroll is best-effort */
    }
  }

  /** One-shot green pulse, mirroring the command bar's entrance flash. */
  private pulse(): void {
    this.root.classList.remove('pmd-repair-para-pulse');
    // Force reflow so re-adding the class restarts the animation.
    void this.root.offsetWidth;
    this.root.classList.add('pmd-repair-para-pulse');
    this.root.addEventListener(
      'animationend',
      () => this.root.classList.remove('pmd-repair-para-pulse'),
      { once: true },
    );
  }

  /** Transient toast when the workflow can't start (no card at cursor). */
  private flashMessage(text: string): void {
    this.hint.textContent = text;
    this.root.hidden = false;
    this.root.classList.add('pmd-repair-para-error');
    window.setTimeout(() => {
      if (!this.open_) {
        this.root.hidden = true;
        this.root.classList.remove('pmd-repair-para-error');
      }
    }, 1600);
  }
}
