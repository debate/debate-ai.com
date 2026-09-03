/**
 * Quick Card — Add dialog.
 *
 * Promise-based modal (like `openSaveAs`): resolves with the chosen
 * name + tags, or `null` if cancelled. Shown after the user invokes
 * "Add quick card" on a non-empty selection. The name field is
 * pre-filled with the smallest enclosing heading (computed by the
 * caller); tags are entered as chips with suggestions drawn from the
 * existing tag universe.
 *
 * Validation (the duplicate-name-only-if-tags-differ rule) is supplied
 * by the caller via `validate`; a non-null return is shown inline and
 * keeps the dialog open.
 */

import { normalizeTag, type QuickCard } from './quick-cards-store.js';
import { setIcon } from './icons';
import { pushOverlay, popOverlay, isTopOverlay } from './overlay-stack.js';

export interface QuickCardAddResult {
  name: string;
  /** Display-cased tags, de-duplicated by normalized form. */
  tags: string[];
}

export interface QuickCardAddOptions {
  /** Pre-fill for the name field (smallest enclosing heading text). */
  initialName: string;
  /** Distinct existing tags (display casing) for suggestions. */
  existingTags: string[];
  /** Return the conflicting card (same name + identical tag-set) that
   *  the uniqueness rule forbids, or null if the name+tags are free. */
  findConflict?: (name: string, tags: string[]) => QuickCard | null;
  /** Invoked when the user clicks "Open it" on a conflict; the dialog
   *  closes (resolving null) first. */
  onOpenConflict?: (card: QuickCard) => void;
}

export function openQuickCardAdd(
  opts: QuickCardAddOptions,
): Promise<QuickCardAddResult | null> {
  return new Promise((resolve) => {
    new QuickCardAddModal(opts, resolve);
  });
}

class QuickCardAddModal {
  private readonly overlay: HTMLDivElement;
  private readonly dialog: HTMLDivElement;
  private nameInput!: HTMLInputElement;
  private tagInput!: HTMLInputElement;
  private chipsEl!: HTMLDivElement;
  private suggestionsEl!: HTMLDivElement;
  private errorEl!: HTMLDivElement;
  private settled = false;
  /** Committed tags, ordered; deduped by normalized form. */
  private tags: string[] = [];

  constructor(
    private readonly opts: QuickCardAddOptions,
    private readonly settle: (r: QuickCardAddResult | null) => void,
  ) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'pmd-qc-add-overlay';
    this.dialog = document.createElement('div');
    this.dialog.className = 'pmd-qc-add-dialog';
    this.overlay.appendChild(this.dialog);
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.cancel();
    });
    this.overlayToken = pushOverlay();
    document.addEventListener('keydown', this.handleKey, true);

    this.render();
    document.body.appendChild(this.overlay);

    requestAnimationFrame(() => {
      this.nameInput.focus();
      this.nameInput.select();
    });
  }

  private overlayToken: symbol | null = null;

  private handleKey = (e: KeyboardEvent): void => {
    if (this.settled) return;
    if (e.key === 'Escape') {
      // Only the topmost overlay reacts, so a stacked dialog doesn't
      // collapse the whole stack on one Escape.
      if (this.overlayToken && !isTopOverlay(this.overlayToken)) return;
      e.preventDefault();
      e.stopPropagation();
      this.cancel();
    }
  };

  private render(): void {
    const header = document.createElement('header');
    header.className = 'pmd-qc-add-header';
    const title = document.createElement('h2');
    title.textContent = 'Add Quick Card';
    header.appendChild(title);
    this.dialog.appendChild(header);

    const form = document.createElement('form');
    form.className = 'pmd-qc-add-body';
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.confirm();
    });

    // Name
    const nameField = document.createElement('label');
    nameField.className = 'pmd-qc-add-field';
    const nameLabel = document.createElement('span');
    nameLabel.className = 'pmd-qc-add-field-label';
    nameLabel.textContent = 'Name';
    nameField.appendChild(nameLabel);
    this.nameInput = document.createElement('input');
    this.nameInput.type = 'text';
    this.nameInput.className = 'pmd-qc-add-input';
    this.nameInput.value = this.opts.initialName;
    this.nameInput.spellcheck = false;
    this.nameInput.autocomplete = 'off';
    // Enter in the name field saves (fast path: pre-filled name → Enter).
    // Tab moves to tags for those who want to add them.
    nameField.appendChild(this.nameInput);
    form.appendChild(nameField);

    // Tags
    const tagsField = document.createElement('div');
    tagsField.className = 'pmd-qc-add-field';
    const tagsLabel = document.createElement('span');
    tagsLabel.className = 'pmd-qc-add-field-label';
    tagsLabel.textContent = 'Tags';
    tagsField.appendChild(tagsLabel);

    this.chipsEl = document.createElement('div');
    this.chipsEl.className = 'pmd-qc-add-chips';
    tagsField.appendChild(this.chipsEl);

    this.tagInput = document.createElement('input');
    this.tagInput.type = 'text';
    this.tagInput.className = 'pmd-qc-add-input pmd-qc-add-tag-input';
    this.tagInput.placeholder = 'Add a tag…';
    this.tagInput.spellcheck = false;
    this.tagInput.autocomplete = 'off';
    this.tagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        // Commit the typed tag; if empty, fall through to save.
        if (this.tagInput.value.trim()) {
          e.preventDefault();
          this.commitTag(this.tagInput.value);
        }
        // empty + Enter → let the form submit (save)
        else if (e.key === ',') {
          e.preventDefault();
        }
      } else if (e.key === 'Backspace' && !this.tagInput.value && this.tags.length) {
        this.tags.pop();
        this.renderChips();
        this.renderSuggestions();
      }
    });
    this.tagInput.addEventListener('input', () => this.renderSuggestions());
    tagsField.appendChild(this.tagInput);

    const hint = document.createElement('div');
    hint.className = 'pmd-qc-add-hint';
    hint.textContent = 'Press Enter or comma to add each tag.';
    tagsField.appendChild(hint);

    this.suggestionsEl = document.createElement('div');
    this.suggestionsEl.className = 'pmd-qc-add-suggestions';
    tagsField.appendChild(this.suggestionsEl);

    form.appendChild(tagsField);

    // Inline error
    this.errorEl = document.createElement('div');
    this.errorEl.className = 'pmd-qc-add-error';
    this.errorEl.hidden = true;
    form.appendChild(this.errorEl);

    // Footer
    const footer = document.createElement('footer');
    footer.className = 'pmd-qc-add-footer';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'pmd-qc-add-btn';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => this.cancel());
    footer.appendChild(cancel);
    const save = document.createElement('button');
    save.type = 'submit';
    save.className = 'pmd-qc-add-btn pmd-qc-add-btn-primary';
    save.textContent = 'Save';
    footer.appendChild(save);
    form.appendChild(footer);

    this.dialog.appendChild(form);

    this.renderChips();
    this.renderSuggestions();
  }

  private commitTag(raw: string): void {
    const display = raw.trim().replace(/,+$/, '').trim();
    if (!display) return;
    const norm = normalizeTag(display);
    if (!this.tags.some((t) => normalizeTag(t) === norm)) {
      this.tags.push(display);
    }
    this.tagInput.value = '';
    this.renderChips();
    this.renderSuggestions();
  }

  private removeTag(index: number): void {
    this.tags.splice(index, 1);
    this.renderChips();
    this.renderSuggestions();
    this.tagInput.focus();
  }

  private renderChips(): void {
    this.chipsEl.innerHTML = '';
    this.chipsEl.hidden = this.tags.length === 0;
    this.tags.forEach((tag, i) => {
      const chip = document.createElement('span');
      chip.className = 'pmd-qc-add-chip';
      const label = document.createElement('span');
      label.textContent = tag;
      chip.appendChild(label);
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'pmd-qc-add-chip-x';
      setIcon(x, 'close');
      x.setAttribute('aria-label', `Remove tag ${tag}`);
      x.addEventListener('click', () => this.removeTag(i));
      chip.appendChild(x);
      this.chipsEl.appendChild(chip);
    });
  }

  private renderSuggestions(): void {
    const q = normalizeTag(this.tagInput.value);
    const taken = new Set(this.tags.map((t) => normalizeTag(t)));
    const matches = this.opts.existingTags
      .filter((t) => !taken.has(normalizeTag(t)))
      .filter((t) => (q ? normalizeTag(t).includes(q) : true))
      .slice(0, 12);
    this.suggestionsEl.innerHTML = '';
    this.suggestionsEl.hidden = matches.length === 0;
    for (const tag of matches) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pmd-qc-add-suggestion';
      btn.textContent = tag;
      btn.addEventListener('click', () => {
        this.commitTag(tag);
        this.tagInput.focus();
      });
      this.suggestionsEl.appendChild(btn);
    }
  }

  private confirm(): void {
    // Fold a half-typed tag in the input into the set before saving.
    if (this.tagInput.value.trim()) this.commitTag(this.tagInput.value);
    const name = this.nameInput.value.trim();
    if (!name) {
      this.showError('Give the quick card a name.');
      this.nameInput.focus();
      return;
    }
    const conflict = this.opts.findConflict?.(name, this.tags) ?? null;
    if (conflict) {
      this.showConflict(name, conflict);
      return;
    }
    this.finish({ name, tags: this.tags });
  }

  private showError(msg: string): void {
    this.errorEl.textContent = msg;
    this.errorEl.hidden = false;
  }

  /** A duplicate (same name + identical tags) blocks the save, but we
   *  offer to jump straight to it in the Manage overlay. */
  private showConflict(name: string, card: QuickCard): void {
    this.errorEl.innerHTML = '';
    this.errorEl.hidden = false;
    const msg = document.createElement('span');
    msg.textContent = this.tags.length
      ? `A quick card named “${name}” with those tags already exists. `
      : `A quick card named “${name}” (no tags) already exists — add a tag to keep both. `;
    this.errorEl.appendChild(msg);
    if (this.opts.onOpenConflict) {
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'pmd-qc-add-conflict-open';
      open.textContent = 'Open it';
      open.addEventListener('click', () => {
        const cb = this.opts.onOpenConflict!;
        this.finish(null);
        cb(card);
      });
      this.errorEl.appendChild(open);
    }
  }

  private cancel(): void {
    this.finish(null);
  }

  private finish(result: QuickCardAddResult | null): void {
    if (this.settled) return;
    this.settled = true;
    document.removeEventListener('keydown', this.handleKey, true);
    if (this.overlayToken) popOverlay(this.overlayToken);
    this.overlay.remove();
    this.settle(result);
  }
}
