/**
 * URLs → links (2026-09-21).
 *
 * Three pieces, one detector:
 *   - `findUrls(text)`: the detection rule. An `http://` or `https://`
 *     address, or a `www.` address (linked as https), running to the
 *     next whitespace, angle bracket or quote (straight or curly). The
 *     host must contain a dot (or a port, or be localhost). Trailing
 *     sentence punctuation (`. , ; : ! ?`) is left outside the link,
 *     and so is a closing bracket with no opening partner inside the
 *     address — `(see https://x.org/a)` links `https://x.org/a`, while
 *     `https://en.wikipedia.org/wiki/Foo_(bar)` keeps its parenthesis.
 *     Text that already carries a link mark is never re-linked.
 *   - `autolinkPlugin()` + `autolinkEnterPlugin()`: with the
 *     `autoLinkUrls` setting on (OFF by default), the address just
 *     finished — the word before the caret — gets the link mark when a
 *     space is typed or Enter is pressed after it. One transaction with
 *     the space, so a single Undo takes the link back with the space;
 *     Enter's link is its own step, and Enter then proceeds. Two plugins
 *     because they need opposite places in the stack: the space hook
 *     goes AFTER the autocorrect rules (a claimed space wins), while the
 *     Enter hook must sit BEFORE the Enter keymaps, which claim the key
 *     — placed later it never ran (dev-build find, 2026-09-21). Pastes
 *     are not touched; Link URLs covers what is already written.
 *   - `linkUrls()`: the command. The classic scope — the selection when
 *     there is one, else the whole document — and every unlinked
 *     address in it gets the mark; a partially selected address is
 *     linked whole.
 * Clicking a link does nothing (the caret lands as on any text); Mod+click
 * opens it — `linkModClickPlugin`, beside the link context menu.
 */
import { Plugin, type Command, type EditorState, type Transaction } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import { schema } from '../schema/index.js';
import { settings } from './settings.js';
import { showToast } from './toast.js';
import { openLinkExternally } from './link-context-menu-plugin.js';
import { REPEAT_IGNORE_META } from './repeat-last-action.js';

export interface UrlMatch {
  /** Offsets into the text the match was found in; `end` exclusive. */
  start: number;
  end: number;
  href: string;
}

const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"'“”‘’]+/gi;
const TRAILING_PUNCT = /[.,;:!?]$/;
const CLOSERS: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

/** Trim trailing punctuation and unbalanced closing brackets. */
function trimTail(raw: string): string {
  let s = raw;
  for (;;) {
    if (TRAILING_PUNCT.test(s)) {
      s = s.slice(0, -1);
      continue;
    }
    const last = s[s.length - 1] ?? '';
    const opener = CLOSERS[last];
    if (opener) {
      const opens = s.split(opener).length - 1;
      const closes = s.split(last).length - 1;
      if (closes > opens) {
        s = s.slice(0, -1);
        continue;
      }
    }
    return s;
  }
}

/** The address must have a plausible host: a dot, a port, or localhost. */
function plausibleHost(s: string): boolean {
  const afterScheme = s.replace(/^(?:https?:\/\/|www\.)/i, '');
  const host = afterScheme.split(/[/?#]/, 1)[0] ?? '';
  if (!host) return false;
  if (/^www\./i.test(s)) return host.length > 0 && !/^\W/.test(host);
  return host.includes('.') || host.includes(':') || /^localhost$/i.test(host);
}

/** Every address in `text`, in order, with its href. */
export function findUrls(text: string): UrlMatch[] {
  const out: UrlMatch[] = [];
  URL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = URL_RE.exec(text))) {
    const raw = trimTail(m[0]);
    if (raw.length < 5 || !plausibleHost(raw)) continue;
    const href = /^www\./i.test(raw) ? `https://${raw}` : raw;
    out.push({ start: m.index, end: m.index + raw.length, href });
  }
  return out;
}

const linkType = () => schema.marks['link']!;

/** The text of a textblock with atoms as one space each, so string
 *  offsets equal document offsets inside the block. */
const blockText = (node: PMNode): string => node.textBetween(0, node.content.size, '', ' ');

/** Add link marks for every unlinked address whose text intersects
 *  [from, to]; returns how many were added. Pure: works on any
 *  transaction. */
export function linkUrlsInRange(tr: Transaction, from: number, to: number): number {
  const link = linkType();
  const doc = tr.doc;
  const jobs: { from: number; to: number; href: string }[] = [];
  doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isTextblock) return true;
    const base = pos + 1;
    for (const u of findUrls(blockText(node))) {
      const a = base + u.start;
      const b = base + u.end;
      if (b <= from || a >= to) continue;
      if (doc.rangeHasMark(a, b, link)) continue;
      jobs.push({ from: a, to: b, href: u.href });
    }
    return false;
  });
  for (const j of jobs) tr.addMark(j.from, j.to, link.create({ href: j.href }));
  return jobs.length;
}

/** The address that ends right before `pos` (trailing punctuation
 *  allowed after it), as a document range, or null. */
function addressBefore(state: EditorState, pos: number): { from: number; to: number; href: string } | null {
  const $pos = state.doc.resolve(pos);
  const parent = $pos.parent;
  if (!parent.isTextblock) return null;
  const before = blockText(parent).slice(0, $pos.parentOffset);
  const wordStart = Math.max(before.lastIndexOf(' '), before.lastIndexOf(' ')) + 1;
  const word = before.slice(wordStart);
  const matches = findUrls(word);
  const last = matches[matches.length - 1];
  if (!last) return null;
  // Only the sentence punctuation the trimmer removed may follow it.
  if (!/^[.,;:!?)\]}]*$/.test(word.slice(last.end))) return null;
  const blockStart = pos - $pos.parentOffset;
  const from = blockStart + wordStart + last.start;
  const to = blockStart + wordStart + last.end;
  if (state.doc.rangeHasMark(from, to, linkType())) return null;
  return { from, to, href: last.href };
}

/** Link the address you just finished typing on the space after it.
 *  Gated on the `autoLinkUrls` setting (off by default). Stack position:
 *  after the autocorrect rules. */
export function autolinkPlugin(): Plugin {
  return new Plugin({
    props: {
      handleTextInput(view, from, to, text) {
        if (text !== ' ' || !settings.get('autoLinkUrls')) return false;
        const hit = addressBefore(view.state, from);
        if (!hit) return false;
        view.dispatch(
          view.state.tr
            .addMark(hit.from, hit.to, linkType().create({ href: hit.href }))
            .insertText(text, from, to)
            .scrollIntoView(),
        );
        return true;
      },
    },
  });
}

/** Link the address before the caret when Enter is pressed, then let
 *  Enter proceed. Stack position: BEFORE every Enter keymap (right after
 *  the Repeat recorder), since the keymaps claim the key. The link
 *  transaction tells the recorder to look through it, so Repeat still
 *  records the Enter it accompanies. */
export function autolinkEnterPlugin(): Plugin {
  return new Plugin({
    props: {
      handleKeyDown(view, event) {
        if (event.key !== 'Enter' || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return false;
        if (!settings.get('autoLinkUrls')) return false;
        const sel = view.state.selection;
        if (!sel.empty) return false;
        const hit = addressBefore(view.state, sel.from);
        if (!hit) return false;
        view.dispatch(
          view.state.tr.addMark(hit.from, hit.to, linkType().create({ href: hit.href })).setMeta(REPEAT_IGNORE_META, true),
        );
        return false; // Enter itself proceeds through the keymaps
      },
    },
  });
}

/** Link URLs — the selection when there is one, else the whole document. */
export function linkUrls(): Command {
  return (state, dispatch) => {
    const sel = state.selection;
    const from = sel.empty ? 0 : sel.from;
    const to = sel.empty ? state.doc.content.size : sel.to;
    const tr = state.tr;
    const n = linkUrlsInRange(tr, from, to);
    if (n === 0) {
      showToast('No unlinked URLs found.');
      return false;
    }
    if (dispatch) {
      dispatch(tr);
      showToast(`Linked ${n} URL${n === 1 ? '' : 's'}.`);
    }
    return true;
  };
}

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform ?? '');

/** Whether a click asks to OPEN a link: Cmd on macOS, Ctrl elsewhere. */
export function isLinkOpenClick(e: MouseEvent): boolean {
  return e.button === 0 && (isMac ? e.metaKey : e.ctrlKey) && !e.altKey && !e.shiftKey;
}

/** A plain click on a link only places the caret; Mod+click opens it. */
export const linkModClickPlugin: Plugin = new Plugin({
  props: {
    handleDOMEvents: {
      click(view, event) {
        if (!isLinkOpenClick(event)) return false;
        const target = event.target as HTMLElement | null;
        const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null;
        if (!anchor || !view.dom.contains(anchor)) return false;
        const href = anchor.getAttribute('href') ?? '';
        if (!href) return false;
        event.preventDefault();
        openLinkExternally(href);
        return true;
      },
    },
  },
});
