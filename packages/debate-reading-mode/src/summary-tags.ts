/**
 * Summary tags: a short note, usually written by an AI and edited by the
 * reader, that sits on a passage the reader (or the page) highlighted.
 *
 * The tag is an annotation stored on the highlight elements themselves
 * (`mark.reader-highlight`, `mark.reader-highlight-short` and the page's own
 * `mark.debate-hl`), as `data-summary-tag` (the text) and
 * `data-summary-group` (an id shared by every highlight the one tag covers,
 * for a selection that spans several). That puts it where every other mark
 * lives, so the mark history's DOM-mutation records undo and redo it with the
 * rest, and splitting or unwrapping a highlight (`marks.ts`) carries it
 * along or drops it with the highlight.
 *
 * `syncSummaryTags` keeps the derived attributes in step after any change:
 * `data-summary-end` on the last highlight of each group (the host draws its
 * badge there) and a `title` of the summary on each.
 */

/** The summary text, on every highlight of the tag. */
export const SUMMARY_ATTR = 'data-summary-tag';
/** Shared by the highlights of one tag. */
export const SUMMARY_GROUP_ATTR = 'data-summary-group';
/** On the last highlight of each tag, where the host shows its badge. */
export const SUMMARY_END_ATTR = 'data-summary-end';

/** What a summary tag can sit on: long and short highlights, the page's own included. */
const HIGHLIGHT_SELECTOR =
  'mark.reader-highlight, mark.reader-highlight-short, mark.debate-hl:not(.debate-hl--no-highlight)';

/** Longest summary kept. */
export const SUMMARY_MAX_LENGTH = 300;
/** Most highlighted text sent to the model. */
const SUMMARY_SOURCE_LIMIT = 6000;

let nextGroup = 0;

function inOrder(elements: Iterable<HTMLElement>): HTMLElement[] {
  return Array.from(new Set(elements)).sort((a, b) =>
    a === b ? 0 : a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  );
}

/** Every highlight of the tag `group`, in reading order. */
export function summaryGroupElements(root: HTMLElement, group: string): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(`[${SUMMARY_GROUP_ATTR}]`)).filter(
    (el) => el.getAttribute(SUMMARY_GROUP_ATTR) === group,
  );
}

/** `elements` plus the rest of every tag any of them already carries, so a tag is never split. */
function withWholeGroups(root: HTMLElement, elements: HTMLElement[]): HTMLElement[] {
  const groups = new Set(elements.map((el) => el.getAttribute(SUMMARY_GROUP_ATTR)).filter((g): g is string => !!g));
  const all = new Set(elements);
  for (const group of groups) for (const el of summaryGroupElements(root, group)) all.add(el);
  return inOrder(all);
}

/** The highlights `range` touches inside `root`, in reading order (empty when none, or `range` is empty). */
export function summaryTargets(range: Range, root: HTMLElement): HTMLElement[] {
  if (range.collapsed || !root.contains(range.commonAncestorContainer)) return [];
  const hit = Array.from(root.querySelectorAll<HTMLElement>(HIGHLIGHT_SELECTOR)).filter((el) =>
    range.intersectsNode(el),
  );
  return hit.length ? withWholeGroups(root, hit) : [];
}

/** The highlight around `node` and the rest of its tag, for clicking a tagged highlight (empty if not tagged). */
export function summaryTargetsAt(node: Node, root: HTMLElement): HTMLElement[] {
  const start = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  const el = start?.closest<HTMLElement>(`[${SUMMARY_ATTR}]`);
  if (!el || !root.contains(el)) return [];
  const group = el.getAttribute(SUMMARY_GROUP_ATTR);
  return group ? summaryGroupElements(root, group) : [el];
}

/** The highlighted text of `elements`, each part once (a short highlight inside a long one is read as part of it). */
export function summarySourceText(elements: HTMLElement[]): string {
  const set = new Set(elements);
  const outer = elements.filter((el) => {
    for (let up = el.parentElement; up; up = up.parentElement) if (set.has(up)) return false;
    return true;
  });
  return outer
    .map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' … ');
}

/** The summary `elements` carry, or '' when none of them has one. */
export function getSummary(elements: HTMLElement[]): string {
  for (const el of elements) {
    const text = el.getAttribute(SUMMARY_ATTR);
    if (text) return text;
  }
  return '';
}

/** A summary as stored: whitespace collapsed, capped at `SUMMARY_MAX_LENGTH`. */
export function cleanSummary(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, SUMMARY_MAX_LENGTH).trim();
}

/**
 * Puts one summary tag on all of `elements` (a blank summary removes it).
 * Returns the tag's group id, or null when removed.
 */
export function setSummaryTag(root: HTMLElement, elements: HTMLElement[], summary: string): string | null {
  const text = cleanSummary(summary);
  const all = withWholeGroups(root, elements);
  if (!text) {
    removeSummaryTag(root, all);
    return null;
  }
  const group = all.map((el) => el.getAttribute(SUMMARY_GROUP_ATTR)).find(Boolean) ?? `s${Date.now().toString(36)}-${nextGroup++}`;
  for (const el of all) {
    el.setAttribute(SUMMARY_ATTR, text);
    el.setAttribute(SUMMARY_GROUP_ATTR, group);
  }
  syncSummaryTags(root);
  return group;
}

/** Takes the summary tag off `elements` and the rest of their tag. */
export function removeSummaryTag(root: HTMLElement, elements: HTMLElement[]): void {
  for (const el of withWholeGroups(root, elements)) {
    el.removeAttribute(SUMMARY_ATTR);
    el.removeAttribute(SUMMARY_GROUP_ATTR);
    el.removeAttribute(SUMMARY_END_ATTR);
    el.removeAttribute('title');
  }
}

/** Takes every summary tag off `root`. */
export function removeAllSummaryTags(root: HTMLElement): void {
  removeSummaryTag(root, Array.from(root.querySelectorAll<HTMLElement>(`[${SUMMARY_GROUP_ATTR}], [${SUMMARY_ATTR}]`)));
}

function setAttr(el: Element, name: string, value: string) {
  if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

/**
 * Brings the derived attributes back in line after marks changed: a tag whose
 * highlights were split or partly removed keeps a single end badge, and one
 * whose highlights are all gone leaves nothing behind. Only writes what differs.
 */
export function syncSummaryTags(root: HTMLElement): void {
  const groups = new Map<string, HTMLElement[]>();
  root.querySelectorAll<HTMLElement>(`[${SUMMARY_ATTR}], [${SUMMARY_GROUP_ATTR}]`).forEach((el) => {
    const group = el.getAttribute(SUMMARY_GROUP_ATTR);
    if (!group || !el.getAttribute(SUMMARY_ATTR) || !el.matches(HIGHLIGHT_SELECTOR)) {
      el.removeAttribute(SUMMARY_ATTR);
      el.removeAttribute(SUMMARY_GROUP_ATTR);
      el.removeAttribute(SUMMARY_END_ATTR);
      el.removeAttribute('title');
      return;
    }
    groups.set(group, [...(groups.get(group) ?? []), el]);
  });
  for (const elements of groups.values()) {
    const last = elements[elements.length - 1];
    for (const el of elements) {
      setAttr(el, 'title', el.getAttribute(SUMMARY_ATTR) ?? '');
      if (el === last) setAttr(el, SUMMARY_END_ATTR, '');
      else el.removeAttribute(SUMMARY_END_ATTR);
    }
  }
}

/** One summary tag on the page. */
export interface SummaryTagInfo {
  group: string;
  summary: string;
  /** The highlighted text it covers. */
  text: string;
}

/** Every summary tag under `root`, in reading order. */
export function summaryTags(root: HTMLElement): SummaryTagInfo[] {
  const seen = new Map<string, HTMLElement[]>();
  root.querySelectorAll<HTMLElement>(`[${SUMMARY_ATTR}][${SUMMARY_GROUP_ATTR}]`).forEach((el) => {
    const group = el.getAttribute(SUMMARY_GROUP_ATTR)!;
    seen.set(group, [...(seen.get(group) ?? []), el]);
  });
  return Array.from(seen, ([group, elements]) => ({
    group,
    summary: getSummary(elements),
    text: summarySourceText(elements),
  }));
}

export const SUMMARY_SYSTEM_PROMPT = `You write summary tags for highlighted passages of debate evidence.
Summarize the highlighted text as one short sentence, in plain words, at most 25 words, the way a debater would label the card's claim.
Reply with the summary only: no quotes, no preface, no list.`;

/** The prompt asking for a summary of the highlighted `text`. */
export function summaryPrompt(text: string): string {
  return `Highlighted text:\n\n${text.slice(0, SUMMARY_SOURCE_LIMIT)}`;
}

/** A model's reply as a summary: fences, a "Summary:" lead-in and wrapping quotes dropped, one line. */
export function parseSummary(answer: string): string {
  let text = answer.replace(/```[a-z]*\n?/gi, '').replace(/\s+/g, ' ').trim();
  const unquote = (value: string) => value.replace(/^["'“‘]+|["'”’]+$/g, '').trim();
  text = unquote(unquote(text).replace(/^(?:summary(?: tag)?|tag)\s*:\s*/i, ''));
  return cleanSummary(text);
}
