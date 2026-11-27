/**
 * @fileoverview The read-aloud player: a dismissable modal opened from the
 * gear button under a card's hover **Read aloud** button
 * (`card-hover-actions.ts`).
 *
 * - **Play** this card, play from this card to the end, or play the whole
 *   document from the top, and Stop.
 * - **Keep reading the next files**: when the whole document has been read,
 *   go on to the next file (the host opens it on `READ_NEXT_FILE_EVENT`) and
 *   keep going, file after file.
 * - **Voice and speed**, three times: for the tag, for the author and year,
 *   and for the highlighted text (`ReadVoicePart`). These are the same settings as
 *   Settings → Sound & speech, stored by `card-tts-client.ts`, so a change in
 *   either place shows in the other and reaches a card that is playing.
 *
 * Plain DOM, like the hover column, so it needs no React root. One player at
 * a time; opening it again replaces the open one. Escape, the × button or a
 * click on the backdrop closes it without stopping the read.
 *
 * @module editor/read-aloud-player
 */

import {
  MAX_READ_SPEED,
  MIN_READ_SPEED,
  READ_SPEED_CHANGE_EVENT,
  READ_VOICE_CHANGE_EVENT,
  READ_VOICE_ENGINES,
  READ_VOICE_OPTIONS,
  READ_VOICE_PARTS,
  readContinueFiles,
  readStoredSpeed,
  readStoredVoiceId,
  storeContinueFiles,
  storeReadSpeed,
  storeVoiceId,
  type ReadVoicePart,
} from './card-tts-client.js';

/** What the player's buttons do; supplied by the card hover actions. */
export interface ReadAloudPlayerActions {
  /** Reads the card the player was opened from; null when it has none. */
  playCard: (() => void) | null;
  /** Reads from that card to the end of the document; null when it has none. */
  playFromCard: (() => void) | null;
  /** Reads every card in the document, from the top. */
  playDocument: () => void;
  /** Stops whatever is being read. */
  stop: () => void;
}

const STYLE_ID = 'pmd-read-player-style';

const STYLES = `
.pmd-read-player-backdrop{position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;
  padding:16px;background:rgba(0,0,0,.35)}
.pmd-read-player{position:relative;width:min(440px,100%);max-height:calc(100vh - 32px);overflow:auto;
  background:var(--pmd-c-bg,#fff);color:var(--pmd-c-text,#18181b);border:1px solid var(--pmd-c-border,#d4d4d8);
  border-radius:12px;box-shadow:0 12px 32px var(--pmd-c-shadow-deep,rgba(0,0,0,.25));font:13px/1.5 system-ui,sans-serif;
  padding:16px;outline:none}
.pmd-read-player h2{margin:0 28px 4px 0;font-size:15px;font-weight:600}
.pmd-read-player h3{margin:0 0 2px;font-size:13px;font-weight:600}
.pmd-read-player p{margin:0 0 8px;color:var(--pmd-c-text-muted,#52525b);font-size:12px}
.pmd-read-player .pmd-read-player-close{position:absolute;top:10px;right:10px;width:28px;height:28px;border:0;border-radius:6px;
  background:transparent;color:var(--pmd-c-text-muted,#52525b);cursor:pointer;font-size:18px;line-height:1}
.pmd-read-player .pmd-read-player-close:hover{background:var(--pmd-c-hover,#f4f4f5)}
.pmd-read-player section{padding:12px 0 0;margin-top:12px;border-top:1px solid var(--pmd-c-border-soft,#e4e4e7)}
.pmd-read-player .pmd-read-player-buttons{display:flex;flex-wrap:wrap;gap:6px}
.pmd-read-player button.pmd-read-player-btn{border:1px solid var(--pmd-c-border,#d4d4d8);border-radius:6px;padding:5px 10px;
  background:var(--pmd-c-bg,#fff);color:inherit;font:inherit;cursor:pointer}
.pmd-read-player button.pmd-read-player-btn:hover{background:var(--pmd-c-hover,#f4f4f5)}
.pmd-read-player button.pmd-read-player-btn[data-primary]{background:var(--pmd-c-accent,#2563eb);border-color:var(--pmd-c-accent,#2563eb);color:#fff}
.pmd-read-player label{display:flex;align-items:center;gap:8px;font-size:12px}
.pmd-read-player .pmd-read-player-row{display:grid;grid-template-columns:52px 1fr;align-items:center;gap:6px 8px;margin-top:6px}
.pmd-read-player select{width:100%;padding:4px 6px;border:1px solid var(--pmd-c-border,#d4d4d8);border-radius:6px;
  background:var(--pmd-c-bg,#fff);color:inherit;font:inherit}
.pmd-read-player input[type=range]{width:100%;accent-color:var(--pmd-c-accent,#2563eb)}
.pmd-read-player .pmd-read-player-continue{margin-top:10px}
`;

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLES;
  document.head.appendChild(style);
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function actionButton(label: string, run: () => void, primary = false): HTMLButtonElement {
  const b = el('button', 'pmd-read-player-btn', label);
  b.type = 'button';
  if (primary) b.setAttribute('data-primary', '');
  b.addEventListener('click', run);
  return b;
}

/** A voice picker (grouped by engine) and a speed slider for one part of the card. */
function partControls(part: ReadVoicePart): { section: HTMLElement; refresh: () => void } {
  const info = READ_VOICE_PARTS.find((p) => p.id === part)!;
  const section = el('section');
  section.dataset['part'] = part;
  section.append(el('h3', undefined, info.label), el('p', undefined, info.description));

  const voiceRow = el('div', 'pmd-read-player-row');
  const voiceLabel = el('label', undefined, 'Voice');
  const select = el('select');
  select.id = `pmd-read-player-${part}-voice`;
  voiceLabel.htmlFor = select.id;
  for (const engine of READ_VOICE_ENGINES) {
    const group = el('optgroup');
    group.label = engine.label;
    for (const option of READ_VOICE_OPTIONS.filter((o) => o.engine === engine.id)) {
      const opt = el('option', undefined, option.label.replace(/^[^·]+·\s*/, ''));
      opt.value = option.id;
      group.appendChild(opt);
    }
    select.appendChild(group);
  }
  select.addEventListener('change', () => storeVoiceId(select.value, part));
  voiceRow.append(voiceLabel, select);

  const speedRow = el('div', 'pmd-read-player-row');
  const speedLabel = el('label');
  const range = el('input');
  range.type = 'range';
  range.id = `pmd-read-player-${part}-speed`;
  range.min = String(MIN_READ_SPEED);
  range.max = String(MAX_READ_SPEED);
  range.step = '0.1';
  range.setAttribute('aria-label', `${info.label} speed`);
  speedLabel.htmlFor = range.id;
  range.addEventListener('input', () => storeReadSpeed(Number(range.value), part));
  speedRow.append(speedLabel, range);

  section.append(voiceRow, speedRow);
  const refresh = () => {
    select.value = readStoredVoiceId(part);
    const speed = readStoredSpeed(part);
    range.value = String(speed);
    speedLabel.textContent = `${speed.toFixed(1)}x`;
  };
  refresh();
  return { section, refresh };
}

let openPlayer: { close: () => void } | null = null;

/** Whether the read-aloud player is open. */
export function isReadAloudPlayerOpen(): boolean {
  return openPlayer !== null;
}

/** Closes the read-aloud player, if open. */
export function closeReadAloudPlayer(): void {
  openPlayer?.close();
}

/** Opens the read-aloud player (see the module doc); returns its root element. */
export function openReadAloudPlayer(actions: ReadAloudPlayerActions): HTMLElement {
  closeReadAloudPlayer();
  ensureStyles();
  const backdrop = el('div', 'pmd-read-player-backdrop');
  const dialog = el('div', 'pmd-read-player');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'pmd-read-player-title');
  dialog.tabIndex = -1;

  const title = el('h2', undefined, 'Read aloud');
  title.id = 'pmd-read-player-title';
  const close = el('button', 'pmd-read-player-close', '×');
  close.type = 'button';
  close.title = 'Close';
  close.setAttribute('aria-label', 'Close');

  const play = el('section');
  play.dataset['part'] = 'play';
  play.append(el('h3', undefined, 'Play'));
  const buttons = el('div', 'pmd-read-player-buttons');
  buttons.appendChild(actionButton('Play whole document', actions.playDocument, true));
  if (actions.playFromCard) buttons.appendChild(actionButton('Play from this card', actions.playFromCard));
  if (actions.playCard) buttons.appendChild(actionButton('Play this card', actions.playCard));
  buttons.appendChild(actionButton('Stop', actions.stop));
  const continueLabel = el('label', 'pmd-read-player-continue');
  const continueBox = el('input');
  continueBox.type = 'checkbox';
  continueBox.id = 'pmd-read-player-continue';
  continueBox.checked = readContinueFiles();
  continueBox.addEventListener('change', () => storeContinueFiles(continueBox.checked));
  continueLabel.append(continueBox, document.createTextNode('Keep reading the next files after this one'));
  play.append(buttons, continueLabel);
  // The first section sits right under the title: no rule above it.
  play.style.borderTop = '0';
  play.style.marginTop = '4px';

  const sections = READ_VOICE_PARTS.map((p) => partControls(p.id));
  dialog.append(close, title, el('p', undefined, 'Voices and speeds are shared with Settings → Sound & speech.'), play, ...sections.map((c) => c.section));
  backdrop.appendChild(dialog);

  const refresh = () => {
    for (const controls of sections) controls.refresh();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    // Escape closes the player; it shouldn't also stop the read behind it.
    e.stopPropagation();
    e.preventDefault();
    player.close();
  };
  const player = {
    close: () => {
      window.removeEventListener(READ_VOICE_CHANGE_EVENT, refresh);
      window.removeEventListener(READ_SPEED_CHANGE_EVENT, refresh);
      document.removeEventListener('keydown', onKeyDown, true);
      backdrop.remove();
      if (openPlayer === player) openPlayer = null;
    },
  };
  close.addEventListener('click', player.close);
  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop) player.close();
  });
  window.addEventListener(READ_VOICE_CHANGE_EVENT, refresh);
  window.addEventListener(READ_SPEED_CHANGE_EVENT, refresh);
  document.addEventListener('keydown', onKeyDown, true);
  document.body.appendChild(backdrop);
  openPlayer = player;
  dialog.focus?.();
  return dialog;
}
