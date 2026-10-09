/**
 * @fileoverview Card hover actions: while the mouse is over a card, a small
 * column of icon buttons floats beside it — **Summarize** (AI summary),
 * **Find flaws** (AI weaknesses an opponent would attack) and **Read aloud**
 * (text-to-speech). AI answers open in a small panel next to the card.
 *
 * A ProseMirror plugin whose view owns two `document.body`-level elements
 * (the button column and the answer panel), so nothing is added to the
 * document's DOM and the doc, undo and autosave never see them. The host
 * (`react/singleton.ts`) registers it through the host-plugin seam, so it
 * survives every plugin-stack rebuild the engine does on its own.
 *
 * - Mouse only: the column follows `pointermove` with `pointerType ===
 *   'mouse'`, so touch screens (which have no hover) never get it.
 * - It sits just right of the card when the editor has room there, otherwise
 *   inside the card's top-right corner, and hides a moment after the pointer
 *   leaves both the card and the column (long enough to travel onto it).
 * - Read aloud uses the browser's `speechSynthesis`. It reads the tag, then
 *   the card's highlighted text — what a debater reads in round — or the whole
 *   body when nothing is highlighted. Clicking it again (on any card) stops.
 * - The AI calls are injected (`runAi`; `card-ai-client.ts` in production),
 *   so this file has no dependency on the LLM client or settings.
 *
 * @module editor/card-hover-actions
 */

import { Plugin, PluginKey } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import type { EditorView } from 'prosemirror-view';
import type { CardAiAction } from './card-ai-client.js';

export const cardHoverActionsKey = new PluginKey('cardHoverActions');

export interface CardHoverActionsOptions {
  /** Runs an AI action on a card's text and resolves the answer. */
  runAi: (action: CardAiAction, content: string, tag: string) => Promise<string>;
}

/** The parts of a card the actions read, as plain text. */
export interface CardParts {
  tag: string;
  cite: string;
  body: string;
  /** Highlighted body text, runs joined with spaces; `''` when none. */
  highlighted: string;
}

/** Tag, cite, body and highlighted text of a `card` node. */
export function cardParts(card: PMNode): CardParts {
  let tag = '';
  const cites: string[] = [];
  const body: string[] = [];
  const runs: string[] = [];
  let inRun = false;
  card.forEach((child) => {
    const name = child.type.name;
    if (name === 'tag') {
      tag = child.textContent;
    } else if (name === 'cite_paragraph') {
      cites.push(child.textContent);
    } else if (name === 'card_body') {
      body.push(child.textContent);
      child.descendants((node) => {
        if (!node.isText) return true;
        const lit = node.marks.some((m) => m.type.name === 'highlight');
        if (lit) {
          if (inRun) runs[runs.length - 1] += node.text ?? '';
          else runs.push(node.text ?? '');
        }
        inRun = lit;
        return false;
      });
      inRun = false;
    }
  });
  return {
    tag: tag.trim(),
    cite: cites.join('\n').trim(),
    body: body.join('\n').trim(),
    highlighted: runs.map((r) => r.trim()).filter(Boolean).join(' '),
  };
}

/** The card as the model reads it: tag, cite, then the card text. */
export function cardAnalysisText(parts: CardParts): string {
  return [parts.tag, parts.cite, parts.body].filter(Boolean).join('\n\n');
}

/** What Read aloud speaks: the tag, then the highlighted text (or the whole body). */
export function cardSpeechText(parts: CardParts): string {
  const text = parts.highlighted || parts.body;
  return [parts.tag, text].filter(Boolean).join('. ').replace(/\s+/g, ' ').trim();
}

/** The `card` node containing `pos`, or null. */
export function cardAt(doc: PMNode, pos: number): PMNode | null {
  if (pos < 0 || pos > doc.content.size) return null;
  const $pos = doc.resolve(pos);
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type.name === 'card') return $pos.node(d);
  }
  return null;
}

const ICONS = {
  summary:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>',
  flaws:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.3 3.9L2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  speak:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5L6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>',
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>',
} as const;

const STYLE_ID = 'pmd-card-hover-actions-style';
const STYLES = `
.pmd-card-actions{position:fixed;z-index:60;display:none;flex-direction:column;gap:2px;padding:2px;
  background:var(--pmd-c-bg,#fff);border:1px solid var(--pmd-c-border,#d4d4d8);border-radius:8px;
  box-shadow:0 2px 8px var(--pmd-c-shadow-deep,rgba(0,0,0,.15))}
.pmd-card-actions[data-open]{display:flex}
.pmd-card-actions button{display:flex;align-items:center;justify-content:center;width:26px;height:26px;
  padding:0;border:0;border-radius:6px;background:transparent;color:var(--pmd-c-text-muted,#52525b);cursor:pointer}
.pmd-card-actions button:hover,.pmd-card-actions button:focus-visible{background:var(--pmd-c-hover,#f4f4f5);color:var(--pmd-c-accent,#2563eb);outline:none}
.pmd-card-actions button[aria-pressed="true"]{color:var(--pmd-c-accent,#2563eb)}
.pmd-card-actions svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.pmd-card-ai-panel{position:fixed;z-index:61;display:none;flex-direction:column;width:min(420px,calc(100vw - 32px));
  max-height:min(50vh,420px);background:var(--pmd-c-bg,#fff);color:var(--pmd-c-text,#18181b);
  border:1px solid var(--pmd-c-border,#d4d4d8);border-radius:10px;box-shadow:0 8px 24px var(--pmd-c-shadow-deep,rgba(0,0,0,.18));
  font:13px/1.5 system-ui,sans-serif}
.pmd-card-ai-panel[data-open]{display:flex}
.pmd-card-ai-panel header{display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid var(--pmd-c-border-soft,#e4e4e7)}
.pmd-card-ai-panel header strong{flex:1;font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pmd-card-ai-panel header button{border:0;background:transparent;color:var(--pmd-c-text-muted,#52525b);cursor:pointer;
  font:inherit;font-size:12px;padding:2px 6px;border-radius:4px}
.pmd-card-ai-panel header button:hover{background:var(--pmd-c-hover,#f4f4f5)}
.pmd-card-ai-panel .pmd-card-ai-body{padding:10px;overflow:auto;white-space:pre-wrap;word-break:break-word}
.pmd-card-ai-panel[data-state="loading"] .pmd-card-ai-body{color:var(--pmd-c-text-muted,#52525b);font-style:italic}
.pmd-card-ai-panel[data-state="error"] .pmd-card-ai-body{color:var(--pmd-c-error,#b91c1c)}
`;

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLES;
  document.head.appendChild(style);
}

const HIDE_DELAY_MS = 250;
const GAP = 6;

const TITLES: Record<CardAiAction, string> = { summary: 'Summary', flaws: 'Flaws' };

function speechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

class CardHoverActionsView {
  private readonly bar: HTMLDivElement;
  private readonly panel: HTMLDivElement;
  private readonly panelTitle: HTMLElement;
  private readonly panelBody: HTMLDivElement;
  private readonly speakBtn: HTMLButtonElement | null;
  private cardEl: HTMLElement | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private requestId = 0;
  private panelText = '';
  private speaking = false;

  constructor(private view: EditorView, private readonly options: CardHoverActionsOptions) {
    ensureStyles();
    this.bar = document.createElement('div');
    this.bar.className = 'pmd-card-actions';
    this.bar.setAttribute('role', 'toolbar');
    this.bar.setAttribute('aria-label', 'Card actions');
    this.bar.appendChild(this.button('summary', 'Summarize card (AI)', ICONS.summary, () => this.ask('summary')));
    this.bar.appendChild(this.button('flaws', 'Find flaws in card (AI)', ICONS.flaws, () => this.ask('flaws')));
    this.speakBtn = speechAvailable()
      ? this.button('speak', 'Read card aloud', ICONS.speak, () => this.toggleSpeak())
      : null;
    if (this.speakBtn) {
      this.speakBtn.setAttribute('aria-pressed', 'false');
      this.bar.appendChild(this.speakBtn);
    }
    this.bar.addEventListener('mouseenter', this.cancelHide);
    this.bar.addEventListener('mouseleave', this.scheduleHide);
    // Keep the editor's selection where it is when a button is pressed.
    this.bar.addEventListener('mousedown', (e) => e.preventDefault());

    this.panel = document.createElement('div');
    this.panel.className = 'pmd-card-ai-panel';
    this.panel.setAttribute('role', 'dialog');
    const header = document.createElement('header');
    this.panelTitle = document.createElement('strong');
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.textContent = 'Copy';
    copy.addEventListener('click', () => {
      if (this.panelText) void navigator.clipboard?.writeText(this.panelText).catch(() => {});
    });
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Close';
    close.setAttribute('aria-label', 'Close');
    close.addEventListener('click', () => this.closePanel());
    header.append(this.panelTitle, copy, close);
    this.panelBody = document.createElement('div');
    this.panelBody.className = 'pmd-card-ai-body';
    this.panel.append(header, this.panelBody);

    document.body.append(this.bar, this.panel);
    view.dom.addEventListener('pointermove', this.onPointerMove);
    view.dom.addEventListener('mouseleave', this.scheduleHide);
    window.addEventListener('scroll', this.onScroll, true);
    document.addEventListener('keydown', this.onKeyDown);
  }

  update(view: EditorView): void {
    this.view = view;
    // The hovered card may have been deleted or re-rendered by the edit.
    if (this.cardEl && !this.cardEl.isConnected) this.hideBar();
  }

  destroy(): void {
    this.requestId++;
    this.stopSpeaking();
    this.view.dom.removeEventListener('pointermove', this.onPointerMove);
    this.view.dom.removeEventListener('mouseleave', this.scheduleHide);
    window.removeEventListener('scroll', this.onScroll, true);
    document.removeEventListener('keydown', this.onKeyDown);
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.bar.remove();
    this.panel.remove();
  }

  private button(name: string, label: string, icon: string, run: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset['action'] = name;
    b.title = label;
    b.setAttribute('aria-label', label);
    b.innerHTML = icon;
    b.addEventListener('click', run);
    return b;
  }

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse') return;
    const target = e.target instanceof Element ? e.target : null;
    const card = target?.closest<HTMLElement>('.pmd-card') ?? null;
    if (!card || !this.view.dom.contains(card)) {
      this.scheduleHide();
      return;
    }
    this.cancelHide();
    if (card !== this.cardEl || !this.bar.hasAttribute('data-open')) this.showBar(card);
  };

  private readonly onScroll = (): void => {
    if (this.cardEl && this.bar.hasAttribute('data-open')) this.positionBar();
  };

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.panel.hasAttribute('data-open')) this.closePanel();
  };

  private readonly cancelHide = (): void => {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = null;
  };

  private readonly scheduleHide = (): void => {
    if (this.hideTimer) return;
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      this.hideBar();
    }, HIDE_DELAY_MS);
  };

  private showBar(card: HTMLElement): void {
    this.cardEl = card;
    this.bar.setAttribute('data-open', '');
    this.positionBar();
  }

  private hideBar(): void {
    this.bar.removeAttribute('data-open');
    this.cardEl = null;
  }

  /** Right of the card when the editor has room there, else inside its top-right corner. */
  private positionBar(): void {
    if (!this.cardEl) return;
    const rect = this.cardEl.getBoundingClientRect();
    const bounds = this.view.dom.getBoundingClientRect();
    const width = this.bar.offsetWidth || 32;
    const outside = rect.right + GAP;
    const left = outside + width <= window.innerWidth - GAP ? outside : rect.right - width - GAP;
    const top = Math.min(Math.max(rect.top, bounds.top, 0) + 2, rect.bottom - 30);
    this.bar.style.left = `${Math.round(left)}px`;
    this.bar.style.top = `${Math.round(top)}px`;
  }

  /** The hovered card's node, read fresh from the current doc. */
  private currentCard(): PMNode | null {
    if (!this.cardEl || !this.cardEl.isConnected) return null;
    try {
      return cardAt(this.view.state.doc, this.view.posAtDOM(this.cardEl, 0));
    } catch {
      return null;
    }
  }

  private ask(action: CardAiAction): void {
    const card = this.currentCard();
    if (!card) return;
    const parts = cardParts(card);
    const content = cardAnalysisText(parts);
    const id = ++this.requestId;
    this.openPanel(`${TITLES[action]}${parts.tag ? ` — ${parts.tag}` : ''}`);
    if (!content) {
      this.setPanel('error', 'This card has no text to analyze.');
      return;
    }
    this.setPanel('loading', action === 'summary' ? 'Summarizing…' : 'Looking for flaws…');
    this.options.runAi(action, content, parts.tag).then(
      (text) => {
        if (id === this.requestId) this.setPanel('done', text);
      },
      (err: unknown) => {
        if (id === this.requestId) this.setPanel('error', err instanceof Error ? err.message : 'AI request failed.');
      },
    );
  }

  private openPanel(title: string): void {
    this.panelTitle.textContent = title;
    this.panel.setAttribute('data-open', '');
    const anchor = (this.cardEl ?? this.bar).getBoundingClientRect();
    const barRect = this.bar.getBoundingClientRect();
    const width = this.panel.offsetWidth || 420;
    const height = this.panel.offsetHeight || 200;
    let left = barRect.left - width - GAP;
    if (left < GAP) left = Math.min(barRect.right + GAP, window.innerWidth - width - GAP);
    left = Math.max(GAP, left);
    const top = Math.max(GAP, Math.min(Math.max(anchor.top, GAP), window.innerHeight - height - GAP));
    this.panel.style.left = `${Math.round(left)}px`;
    this.panel.style.top = `${Math.round(top)}px`;
  }

  private setPanel(state: 'loading' | 'done' | 'error', text: string): void {
    this.panel.setAttribute('data-state', state);
    this.panelBody.textContent = text;
    this.panelText = state === 'done' ? text : '';
  }

  private closePanel(): void {
    this.requestId++;
    this.panel.removeAttribute('data-open');
  }

  private toggleSpeak(): void {
    if (this.speaking) {
      this.stopSpeaking();
      return;
    }
    const card = this.currentCard();
    if (!card) return;
    const text = cardSpeechText(cardParts(card));
    if (!text) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const done = () => {
      if (this.speaking) this.setSpeaking(false);
    };
    utterance.onend = done;
    utterance.onerror = done;
    this.setSpeaking(true);
    synth.speak(utterance);
  }

  private stopSpeaking(): void {
    if (!this.speaking) return;
    this.setSpeaking(false);
    if (speechAvailable()) window.speechSynthesis.cancel();
  }

  private setSpeaking(on: boolean): void {
    this.speaking = on;
    if (!this.speakBtn) return;
    this.speakBtn.setAttribute('aria-pressed', String(on));
    const label = on ? 'Stop reading' : 'Read card aloud';
    this.speakBtn.title = label;
    this.speakBtn.setAttribute('aria-label', label);
    this.speakBtn.innerHTML = on ? ICONS.stop : ICONS.speak;
  }
}

/** The card hover actions plugin (see the module doc). */
export function createCardHoverActionsPlugin(options: CardHoverActionsOptions): Plugin {
  return new Plugin({
    key: cardHoverActionsKey,
    view: (view) => new CardHoverActionsView(view, options),
  });
}
