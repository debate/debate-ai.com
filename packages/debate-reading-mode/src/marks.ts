/**
 * Highlighting and underlining the reader toggles on a selection, the way a
 * debater cuts a card: the docs' auto-highlighter and auto-underliner modes,
 * and the AI that marks a passage for them.
 *
 * `toggleMark` is the one call behind both modes: select text and it is
 * marked; select text that is already marked (all of it) and the mark comes
 * off just that part. "Marked" counts the page's own marks too, so the reader
 * can take a word out of an authored highlight:
 * - **highlight**: the reader's `<mark class="reader-highlight">`
 *   (`./highlights`) or an authored `<mark class="debate-hl">` (the docs'
 *   `==text==`, which is highlighted *and* underlined).
 * - **underline**: the reader's `<u class="reader-underline">`, an authored
 *   `<mark class="debate-hl">`, or a plain `<u>` (card underlining).
 * - **short-highlight**: the reader's `<mark class="reader-highlight-short">`,
 *   a secondary, minimal highlight (the few words of a long highlight a
 *   debater would read in a short version of the card). The page has no
 *   authored short highlights, so only the reader's count.
 * - **emphasis**: the reader's `<strong class="reader-emphasis">`, words
 *   singled out for stress: boxed, bold, tinted and underlined by the host.
 *   Like short highlights, only the reader's count.
 *
 * An authored `debate-hl` mark is never unwrapped for one kind: the part
 * taken out is split into its own copy of the mark carrying
 * `debate-hl--no-highlight` or `debate-hl--no-underline`, so it keeps the
 * other kind (each host's CSS drops the style). Taking out both kinds removes
 * the mark. Re-marking that text puts the authored style back.
 *
 * `removeAllMarks` takes every mark off, authored ones included, and
 * `clearMarks` puts the page's own back. Both also drop the summary tags
 * (`./summary-tags`) that sat on the highlights.
 *
 * `markPhrase` marks a quoted phrase where it occurs in the text, for marks an
 * AI picked (`autoCutPrompt` / `parseAutoCut`).
 */
import { HIGHLIGHT_CLASS } from './highlights';
import { removeAllSummaryTags } from './summary-tags';

/** What a mark does to the text. */
export type MarkKind = 'highlight' | 'underline' | 'short-highlight' | 'emphasis';

/** Every kind, in menu order: underlining, long and short highlighting, then emphasis. */
export const MARK_KINDS: readonly MarkKind[] = ['underline', 'highlight', 'short-highlight', 'emphasis'];

/** Class on the reader's own underlines; each host styles it. */
export const UNDERLINE_CLASS = 'reader-underline';
/** Class on the reader's short (secondary) highlights; each host styles it. */
export const SHORT_HIGHLIGHT_CLASS = 'reader-highlight-short';
/** Class on the reader's emphasized words; each host styles it. */
export const EMPHASIS_CLASS = 'reader-emphasis';
/** Class on the page's authored highlights (`==text==` in the docs). */
export const AUTHORED_CLASS = 'debate-hl';

/** Class on a plain `<u>` (card underlining) whose underline was removed; each host drops its style. */
export const UNDERLINE_OFF_CLASS = 'debate-u--no-underline';

/** The class an authored mark gets when `kind` is taken off part of it. */
export function authoredOffClass(kind: MarkKind): string {
  return `${AUTHORED_CLASS}--no-${kind}`;
}

const READER_CLASS: Record<MarkKind, string> = {
  highlight: HIGHLIGHT_CLASS,
  underline: UNDERLINE_CLASS,
  'short-highlight': SHORT_HIGHLIGHT_CLASS,
  emphasis: EMPHASIS_CLASS,
};
const READER_TAG: Record<MarkKind, string> = {
  highlight: 'mark',
  underline: 'u',
  'short-highlight': 'mark',
  emphasis: 'strong',
};
/** The kinds an authored `debate-hl` mark carries. */
const AUTHORED_KINDS: readonly MarkKind[] = ['highlight', 'underline'];
/** Selector for every mark the reader made. */
const READER_SELECTOR = MARK_KINDS.map((kind) => `.${READER_CLASS[kind]}`).join(', ');

let nextId = 0;

/** The closest element that marks `node` as `kind`, or null. */
function markingAncestor(node: Node, kind: MarkKind, root: Element): Element | null {
  for (let el = node.parentElement; el && el !== root.parentElement; el = el.parentElement) {
    if (el.classList.contains(READER_CLASS[kind])) return el;
    if (el.classList.contains(AUTHORED_CLASS)) {
      if (AUTHORED_KINDS.includes(kind) && !el.classList.contains(authoredOffClass(kind))) return el;
      continue;
    }
    if (kind === 'underline' && el.tagName === 'U' && !el.classList.contains(UNDERLINE_OFF_CLASS)) return el;
    if (el === root) break;
  }
  return null;
}

/** The authored mark around `node` with `kind` taken off, or null. */
function authoredWithKindOff(node: Node, kind: MarkKind, root: Element): Element | null {
  if (!AUTHORED_KINDS.includes(kind)) return null;
  const el = node.parentElement?.closest(`mark.${AUTHORED_CLASS}`);
  return el && root.contains(el) && el.classList.contains(authoredOffClass(kind)) ? el : null;
}

/** The non-blank text nodes `range` touches, split so each lies wholly inside it. */
function splitTextNodesIn(range: Range, root: Element): Text[] {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const touched: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    if (text.data.trim() && range.intersectsNode(text)) touched.push(text);
  }
  const { startContainer, startOffset, endContainer, endOffset } = range;
  const out: Text[] = [];
  for (const node of touched) {
    let target = node;
    // Trim the end first so the start offset still points into `target`.
    if (node === endContainer && endOffset < node.length) target.splitText(endOffset);
    if (node === startContainer && startOffset > 0) target = target.splitText(startOffset);
    if (target.data.trim()) out.push(target);
  }
  return out;
}

/**
 * Splits `el` so that `node` (somewhere inside it) sits in its own shallow
 * copy of `el`, with whatever came before and after left in copies of their
 * own. Returns the copy holding `node`.
 */
function isolate(node: Text, el: Element): Element {
  const doc = el.ownerDocument;
  const parent = el.parentNode!;
  const tail = doc.createRange();
  tail.setStartAfter(node);
  tail.setEnd(el, el.childNodes.length);
  const tailContent = tail.extractContents();
  const middle = doc.createRange();
  middle.setStartBefore(node);
  middle.setEnd(el, el.childNodes.length);
  const middleContent = middle.extractContents();

  const isolated = el.cloneNode(false) as Element;
  isolated.appendChild(middleContent);
  parent.insertBefore(isolated, el.nextSibling);
  if (tailContent.textContent) {
    const after = el.cloneNode(false) as Element;
    after.appendChild(tailContent);
    parent.insertBefore(after, isolated.nextSibling);
  }
  if (!el.textContent) el.remove();
  return isolated;
}

/** Replaces `el` with its children. */
function unwrap(el: Element): void {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  el.remove();
}

function unmarkNode(node: Text, kind: MarkKind, root: Element): void {
  const el = markingAncestor(node, kind, root);
  if (!el) return;
  const isolated = isolate(node, el);
  if (isolated.classList.contains(AUTHORED_CLASS)) {
    isolated.classList.add(authoredOffClass(kind));
    const other: MarkKind = kind === 'highlight' ? 'underline' : 'highlight';
    if (isolated.classList.contains(authoredOffClass(other))) unwrap(isolated);
  } else {
    unwrap(isolated);
  }
}

function markNode(node: Text, kind: MarkKind, root: Element, id: string): void {
  const authored = authoredWithKindOff(node, kind, root);
  if (authored) {
    const isolated = isolate(node, authored);
    isolated.classList.remove(authoredOffClass(kind));
    return;
  }
  const el = root.ownerDocument.createElement(READER_TAG[kind]);
  el.className = READER_CLASS[kind];
  el.dataset.highlightId = id;
  node.replaceWith(el);
  el.appendChild(node);
}

/** What `toggleMark` did. */
export type ToggleResult = 'added' | 'removed' | null;

/**
 * Toggles `kind` on the text `range` covers inside `root`: when all of it is
 * already marked, the mark comes off exactly that text; otherwise the
 * unmarked parts are marked. Returns null when the range holds no text in
 * `root`.
 */
export function toggleMark(range: Range, root: HTMLElement, kind: MarkKind): ToggleResult {
  if (range.collapsed || !root.contains(range.commonAncestorContainer)) return null;
  const nodes = splitTextNodesIn(range, root);
  if (nodes.length === 0) return null;
  const allMarked = nodes.every((node) => markingAncestor(node, kind, root));
  if (allMarked) {
    for (const node of nodes) unmarkNode(node, kind, root);
    root.normalize();
    return 'removed';
  }
  const id = `${kind[0]}${Date.now().toString(36)}-${nextId++}`;
  for (const node of nodes) if (!markingAncestor(node, kind, root)) markNode(node, kind, root, id);
  return 'added';
}

/** `range`'s ends as character offsets into `root`'s text. */
function textOffsets(root: HTMLElement, range: Range): [number, number] {
  const before = (container: Node, offset: number) => {
    const pre = root.ownerDocument.createRange();
    pre.setStart(root, 0);
    pre.setEnd(container, offset);
    return pre.toString().length;
  };
  return [before(range.startContainer, range.startOffset), before(range.endContainer, range.endOffset)];
}

/** A range over `root`'s text from character `start` to `end`. */
function rangeAtOffsets(root: HTMLElement, start: number, end: number): Range {
  const range = root.ownerDocument.createRange();
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let seen = 0;
  let started = false;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = (node as Text).length;
    if (!started && start < seen + length) {
      range.setStart(node, start - seen);
      started = true;
    }
    if (started && end <= seen + length) {
      range.setEnd(node, end - seen);
      return range;
    }
    seen += length;
  }
  range.selectNodeContents(root);
  if (started) return range;
  range.collapse(false);
  return range;
}

/**
 * `toggleMark` for several kinds at once (both auto modes on). Marking moves
 * nodes, so the selection is kept as text offsets and rebuilt for each kind.
 * Returns what happened to each kind.
 */
export function toggleMarks(range: Range, root: HTMLElement, kinds: MarkKind[]): ToggleResult[] {
  if (range.collapsed || !root.contains(range.commonAncestorContainer)) return kinds.map(() => null);
  const [start, end] = textOffsets(root, range);
  return kinds.map((kind) => toggleMark(rangeAtOffsets(root, start, end), root, kind));
}

/** Collapses whitespace and straightens quotes, lower-cased, for matching an AI's quote. */
function normalizeChar(ch: string): string {
  if (/\s/.test(ch)) return ' ';
  if (/[‘’‛′]/.test(ch)) return "'";
  if (/[“”‟″]/.test(ch)) return '"';
  if (/[–—]/.test(ch)) return '-';
  return ch.toLowerCase();
}

function normalizeText(text: string): string {
  let out = '';
  for (const ch of text) {
    const c = normalizeChar(ch);
    if (c === ' ' && (out === '' || out.endsWith(' '))) continue;
    out += c;
  }
  return out.trim();
}

/**
 * Marks the first occurrence of `phrase` in `root` that isn't marked as
 * `kind` yet (whitespace, quotes and case are ignored when matching). Returns
 * whether it found one.
 */
export function markPhrase(root: HTMLElement, phrase: string, kind: MarkKind): boolean {
  const needle = normalizeText(phrase);
  if (!needle) return false;

  // The normalized text of `root`, and where each of its characters came from.
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let haystack = '';
  const origin: { node: Text; offset: number }[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    for (let i = 0; i < text.data.length; i++) {
      const c = normalizeChar(text.data[i]);
      if (c === ' ' && (haystack === '' || haystack.endsWith(' '))) continue;
      haystack += c;
      origin.push({ node: text, offset: i });
    }
  }

  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + 1)) {
    const start = origin[at];
    const end = origin[at + needle.length - 1];
    const range = root.ownerDocument.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset + 1);
    const nodes = splitTextNodesIn(range, root);
    if (nodes.length === 0 || nodes.every((node) => markingAncestor(node, kind, root))) continue;
    const id = `${kind[0]}${Date.now().toString(36)}-${nextId++}`;
    for (const node of nodes) if (!markingAncestor(node, kind, root)) markNode(node, kind, root, id);
    return true;
  }
  return false;
}

/** Each passage the reader marked (any kind), in reading order. */
export function markedPassages(root: HTMLElement): string[] {
  const byId = new Map<string, string[]>();
  root.querySelectorAll<HTMLElement>(READER_SELECTOR).forEach((el) => {
    // A mark inside another of the reader's marks is read once, as part of it.
    if (el.parentElement?.closest(READER_SELECTOR)) return;
    const id = el.dataset.highlightId ?? '';
    const parts = byId.get(id) ?? [];
    parts.push(el.textContent ?? '');
    byId.set(id, parts);
  });
  return Array.from(byId.values())
    .map((parts) => parts.join(' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/**
 * Back to the page's default highlighting: removes every mark the reader made
 * (any kind) and restores the authored marks they took parts out of.
 */
export function clearMarks(root: HTMLElement): void {
  removeAllSummaryTags(root);
  root.querySelectorAll(READER_SELECTOR).forEach(unwrap);
  root
    .querySelectorAll(`mark.${AUTHORED_CLASS}`)
    .forEach((el) => el.classList.remove(authoredOffClass('highlight'), authoredOffClass('underline')));
  root.querySelectorAll(`u.${UNDERLINE_OFF_CLASS}`).forEach((el) => el.classList.remove(UNDERLINE_OFF_CLASS));
  root.normalize();
}

/**
 * Takes every mark off the text, of every kind: the reader's own marks are
 * removed, and the page's authored highlights and underlines (`debate-hl`
 * marks, plain `<u>`) are switched off in place, so `clearMarks` brings them
 * back.
 */
export function removeAllMarks(root: HTMLElement): void {
  removeAllSummaryTags(root);
  root.querySelectorAll(READER_SELECTOR).forEach(unwrap);
  root
    .querySelectorAll(`mark.${AUTHORED_CLASS}`)
    .forEach((el) => el.classList.add(authoredOffClass('highlight'), authoredOffClass('underline')));
  root.querySelectorAll('u').forEach((el) => el.classList.add(UNDERLINE_OFF_CLASS));
  root.normalize();
}

/** The marks an AI chose for a passage: phrases quoted from it. */
export interface AutoCut {
  underline: string[];
  highlight: string[];
}

export const AUTO_CUT_SYSTEM_PROMPT = `You cut debate evidence the way a policy debater does.
Underline the warrants: the phrases that carry the argument. Highlight, within the underlining, the few words a debater reads aloud.
The highlighted words, read in order on their own, must form grammatical sentences.
Quote every phrase exactly as it appears in the text, word for word. Never paraphrase.
Reply with JSON only, no prose: {"underline": ["…"], "highlight": ["…"]}`;

/** The prompt asking for underlining and highlighting of `text`. */
export function autoCutPrompt(text: string): string {
  return `Cut this text. Underline about a third of it and highlight about a third of the underlining.\n\n${text}`;
}

/** A model's reply as phrase lists; tolerant of code fences and prose around the JSON. */
export function parseAutoCut(answer: string): AutoCut {
  const empty: AutoCut = { underline: [], highlight: [] };
  const start = answer.indexOf('{');
  const end = answer.lastIndexOf('}');
  if (start === -1 || end <= start) return empty;
  try {
    const parsed = JSON.parse(answer.slice(start, end + 1)) as Record<string, unknown>;
    const list = (value: unknown) =>
      Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '') : [];
    return { underline: list(parsed.underline), highlight: list(parsed.highlight) };
  } catch {
    return empty;
  }
}

/** Splits paragraphs (`\n\n`-separated) into chunks of at most `maxChars`, for one model call each. */
export function chunkPassages(text: string, maxChars = 6000): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const paragraph of text.split(/\n{2,}/)) {
    const piece = paragraph.trim();
    if (!piece) continue;
    if (current && current.length + piece.length + 2 > maxChars) {
      chunks.push(current);
      current = '';
    }
    current = current ? `${current}\n\n${piece}` : piece;
  }
  if (current) chunks.push(current);
  return chunks;
}
