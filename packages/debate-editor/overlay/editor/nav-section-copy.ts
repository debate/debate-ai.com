/**
 * Nav-pane "copy section" helpers (debate-ai.com).
 *
 * Every pocket / hat / block row in the nav pane carries a copy button, and
 * its right-click menu gains the same two entries:
 *
 *  - **Copy all tags** — every card tag under the heading, one per line.
 *  - **Copy tags, cites & highlighted text** — per card: the tag, the cite
 *    (author + year, the same `collectCiteText` string the nav row shows) and
 *    the card's highlighted text read in order.
 *
 * Kept in its own file so the upstream nav-panel patch stays a few hook lines.
 */

import type { Node as PMNode } from 'prosemirror-model';
import { collectCiteText, computeHeadingRange, type HeadingEntry } from './headings.js';
import { CLIPBOARD_BUSY_MESSAGE, writeClipboardHtml, writeClipboardText } from './clipboard-write.js';
import { showToast } from './toast.js';

export type NavSectionCopyMode = 'tags' | 'full';

export interface NavSectionCard {
  tag: string;
  cite: string;
  highlighted: string;
}

/** Rows that get a copy button: headings that own a section of cards. */
export function isSectionCopyEntry(entry: HeadingEntry): boolean {
  return (
    !entry.windowed &&
    (entry.type === 'pocket' || entry.type === 'hat' || entry.type === 'block')
  );
}

/** Highlighted text of a card's body, in reading order. Separate highlighted
 *  runs are joined by a single space; whitespace is collapsed. */
export function collectHighlightedText(card: PMNode): string {
  let out = '';
  let gap = false;
  card.forEach((child) => {
    // The tag and cite are copied separately — only read the card's body.
    if (child.type.name === 'tag' || child.type.name === 'cite_paragraph') return;
    gap = true; // paragraph boundary
    child.descendants((node) => {
      if (!node.isText) return;
      if (!node.marks.some((m) => m.type.name === 'highlight')) {
        gap = true;
        return;
      }
      if (gap && out !== '' && !/\s$/.test(out)) out += ' ';
      out += node.text ?? '';
      gap = false;
    });
  });
  return out.replace(/\s+/g, ' ').trim();
}

/** The cards inside a heading's section, in document order. */
export function collectSectionCards(doc: PMNode, entry: HeadingEntry): NavSectionCard[] {
  const range = computeHeadingRange(doc, entry);
  if (!range) return [];
  const cards: NavSectionCard[] = [];
  doc.nodesBetween(range.from, range.to, (node) => {
    if (node.type.name !== 'card') return true;
    const tag = node.firstChild?.type.name === 'tag' ? node.firstChild.textContent.trim() : '';
    cards.push({
      tag,
      cite: collectCiteText(node).trim(),
      highlighted: collectHighlightedText(node),
    });
    return false; // cards don't nest
  });
  return cards;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Plain-text and HTML clipboard payloads for a section copy. */
export function formatSectionCopy(
  cards: NavSectionCard[],
  mode: NavSectionCopyMode,
): { text: string; html: string } {
  if (mode === 'tags') {
    const tags = cards.map((c) => c.tag).filter((t) => t !== '');
    return {
      text: tags.join('\n'),
      html: tags.map((t) => `<p>${escapeHtml(t)}</p>`).join(''),
    };
  }
  const blocks = cards
    .map((c) => [c.tag, c.cite, c.highlighted].filter((s) => s !== ''))
    .filter((b) => b.length > 0);
  return {
    text: blocks.map((b) => b.join('\n')).join('\n\n'),
    html: cards
      .map(
        (c) =>
          (c.tag ? `<p><b>${escapeHtml(c.tag)}</b></p>` : '') +
          (c.cite ? `<p><b>${escapeHtml(c.cite)}</b></p>` : '') +
          (c.highlighted ? `<p>${escapeHtml(c.highlighted)}</p>` : ''),
      )
      .join('<p></p>'),
  };
}

/** Copy a heading's section to the clipboard and toast the outcome. */
export async function copyNavSection(
  doc: PMNode,
  entry: HeadingEntry,
  mode: NavSectionCopyMode,
): Promise<void> {
  const cards = collectSectionCards(doc, entry);
  const { text, html } = formatSectionCopy(cards, mode);
  if (text === '') {
    showToast('No cards under this heading.');
    return;
  }
  const ok = mode === 'tags' ? await writeClipboardText(text) : await writeClipboardHtml(html, text);
  if (!ok) {
    showToast(CLIPBOARD_BUSY_MESSAGE);
    return;
  }
  const n = cards.length;
  showToast(
    mode === 'tags'
      ? `Copied ${n} tag${n === 1 ? '' : 's'}`
      : `Copied ${n} card${n === 1 ? '' : 's'} (tags, cites & highlighting)`,
  );
}

/** Menu labels, shared by the copy button's dropdown and the right-click menu. */
export const NAV_SECTION_COPY_LABELS: Record<NavSectionCopyMode, string> = {
  tags: 'Copy all tags',
  full: 'Copy tags, cites & highlighted text',
};
