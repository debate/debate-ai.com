/**
 * Modal editor for the AI cite-creator prompt.
 *
 * The prompt is long enough that the inline settings text input
 * doesn't fit. This dialog opens on demand with a full-size
 * textarea pre-populated with the current prompt (or the default
 * when the setting is empty). Save persists the value; "Restore
 * default" clears the override.
 */

import { settings } from '../settings.js';
import { DEFAULT_AI_CITE_PROMPT } from './cite-creator.js';
import { setIcon } from '../icons';
import { pushOverlay, popOverlay, isTopOverlay } from '../overlay-stack.js';

export function openCitePromptEditor(): void {
  if (document.querySelector('.pmd-prompt-overlay')) return;
  const overlayToken = pushOverlay();

  const overlay = document.createElement('div');
  overlay.className = 'pmd-prompt-overlay';
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  const dialog = document.createElement('div');
  dialog.className = 'pmd-prompt-dialog';
  overlay.appendChild(dialog);

  const header = document.createElement('header');
  header.className = 'pmd-prompt-header';
  const title = document.createElement('h2');
  title.textContent = 'AI cite-creator prompt';
  header.appendChild(title);
  const close = (): void => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    popOverlay(overlayToken);
  };
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'pmd-prompt-close';
  setIcon(closeBtn, 'close');
  closeBtn.title = 'Close';
  closeBtn.addEventListener('click', close);
  header.appendChild(closeBtn);
  dialog.appendChild(header);

  const note = document.createElement('p');
  note.className = 'pmd-prompt-note';
  note.textContent =
    'This system prompt is sent to the AI before your selected citation text. ' +
    'Use `{DATE}` anywhere you want today\'s date substituted in (M-D-YYYY). ' +
    'The reply must use the delimited [[CITE]] … [[TOKENS]] … [[END]] block format at the bottom of the prompt — the editor splits on those exact markers to insert the cite and apply the F8 cite mark to each token, so leave that part intact unless you know what you\'re doing.';
  dialog.appendChild(note);

  const stored = settings.get('aiCitePrompt');
  const textarea = document.createElement('textarea');
  textarea.className = 'pmd-prompt-textarea';
  textarea.spellcheck = false;
  textarea.value = stored || DEFAULT_AI_CITE_PROMPT;
  textarea.rows = 24;
  dialog.appendChild(textarea);

  const footer = document.createElement('footer');
  footer.className = 'pmd-prompt-footer';

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'pmd-prompt-btn';
  resetBtn.textContent = 'Restore default';
  resetBtn.addEventListener('click', () => {
    textarea.value = DEFAULT_AI_CITE_PROMPT;
  });
  footer.appendChild(resetBtn);

  const spacer = document.createElement('span');
  spacer.style.flex = '1';
  footer.appendChild(spacer);

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'pmd-prompt-btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', close);
  footer.appendChild(cancelBtn);

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'pmd-prompt-btn pmd-prompt-btn-primary';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => {
    const v = textarea.value;
    // Treat verbatim-equal-to-default as "no override" so the
    // setting stays empty and inherits future prompt updates.
    settings.set('aiCitePrompt', v.trim() === DEFAULT_AI_CITE_PROMPT.trim() ? '' : v);
    close();
  });
  footer.appendChild(saveBtn);

  dialog.appendChild(footer);
  document.body.appendChild(overlay);

  const onKey = (e: KeyboardEvent): void => {
    // Only the topmost overlay reacts, so Escape from here doesn't also
    // close the Settings modal underneath.
    if (e.key === 'Escape' && isTopOverlay(overlayToken)) close();
  };
  document.addEventListener('keydown', onKey);

  requestAnimationFrame(() => textarea.focus());
}
