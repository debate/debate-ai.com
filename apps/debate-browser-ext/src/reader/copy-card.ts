/**
 * What the article panel's copy buttons put on the clipboard: the citation,
 * then paragraphs of the article with their highlighting and underlining kept.
 *
 * "Copy highlighted" takes only the stretch a debater would cut into a card:
 * from the first paragraph with a highlight through the last paragraph with a
 * highlight or an underline. "Copy" takes every paragraph.
 *
 * The clipboard gets two versions. The HTML one carries the formatting, and
 * spells it out as inline styles (`background-color` plus Word's
 * `mso-highlight`, and `text-decoration`) because a pasted `<mark>` keeps no
 * colour in Word or Google Docs. The plain-text one is the fallback for
 * anywhere that only takes text.
 */

/** Elements that read as one paragraph. The innermost match wins. */
const BLOCK_SELECTOR =
  'p, li, blockquote, pre, h1, h2, h3, h4, h5, h6, dt, dd, td, th, figcaption';

/** Highlight colour on the clipboard: Word's own "yellow" highlight. */
const HIGHLIGHT_STYLE = 'background-color:#ffff00;mso-highlight:yellow';
const UNDERLINE_STYLE = 'text-decoration:underline';

export interface CardCopy {
  html: string;
  text: string;
  /** How many paragraphs went in. */
  paragraphCount: number;
}

/** Paragraph-level elements of `root`, in document order, none inside another. */
export function paragraphBlocks(root: HTMLElement): HTMLElement[] {
  const all = Array.from(root.querySelectorAll<HTMLElement>(BLOCK_SELECTOR));
  return all.filter(
    (el) => el.textContent?.trim() && !el.querySelector(BLOCK_SELECTOR),
  );
}

const hasHighlight = (el: Element) => el.querySelector('mark') !== null;
const hasUnderline = (el: Element) => el.querySelector('u, ins') !== null;

/**
 * The paragraphs from the first one with a highlight through the last one with
 * a highlight or an underline. Empty when nothing is highlighted.
 */
export function highlightedSpan(root: HTMLElement): HTMLElement[] {
  const blocks = paragraphBlocks(root);
  const first = blocks.findIndex(hasHighlight);
  if (first === -1) return [];
  let last = first;
  for (let i = blocks.length - 1; i > first; i--) {
    if (hasHighlight(blocks[i]) || hasUnderline(blocks[i])) {
      last = i;
      break;
    }
  }
  return blocks.slice(first, last + 1);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * One paragraph's inner HTML for the clipboard: highlights and underlines as
 * styled spans, links and the rest of the inline formatting kept, images and
 * the panel's own attributes dropped.
 */
function clipboardParagraphHtml(block: HTMLElement): string {
  const clone = block.cloneNode(true) as HTMLElement;
  const doc = block.ownerDocument;

  clone.querySelectorAll('img, picture, source, figure, svg, video, audio, iframe').forEach((el) =>
    el.remove(),
  );

  const restyle = (selector: string, style: string) => {
    clone.querySelectorAll(selector).forEach((el) => {
      const span = doc.createElement('span');
      span.setAttribute('style', style);
      while (el.firstChild) span.appendChild(el.firstChild);
      el.replaceWith(span);
    });
  };
  restyle('mark', HIGHLIGHT_STYLE);
  restyle('u, ins', UNDERLINE_STYLE);

  clone.querySelectorAll('*').forEach((el) => {
    el.removeAttribute('class');
    el.removeAttribute('id');
    Array.from(el.attributes)
      .filter((attr) => attr.name.startsWith('data-'))
      .forEach((attr) => el.removeAttribute(attr.name));
  });

  return clone.innerHTML.trim();
}

/** A paragraph's text with its whitespace collapsed. */
function paragraphText(block: HTMLElement): string {
  return (block.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * The clipboard content for `blocks` under `cite`, with any `preface` (the
 * panel's AI answer, for the whole-article copy) above the citation.
 */
export function buildCardCopy(
  blocks: HTMLElement[],
  cite: string,
  preface?: string,
): CardCopy {
  const htmlParts: string[] = [];
  const textParts: string[] = [];

  if (preface?.trim()) {
    htmlParts.push(`<p>${escapeHtml(preface.trim()).replace(/\n/g, '<br>')}</p>`);
    textParts.push(preface.trim());
  }
  if (cite.trim()) {
    htmlParts.push(`<p>${escapeHtml(cite.trim())}</p>`);
    textParts.push(cite.trim());
  }
  for (const block of blocks) {
    htmlParts.push(`<p>${clipboardParagraphHtml(block)}</p>`);
    textParts.push(paragraphText(block));
  }

  return {
    html: `<div>${htmlParts.join('\n')}</div>`,
    text: textParts.join('\n\n'),
    paragraphCount: blocks.length,
  };
}

/**
 * Writes both versions to the clipboard, falling back to plain text where the
 * browser has no `ClipboardItem`.
 */
export async function writeCardToClipboard(copy: CardCopy): Promise<void> {
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([copy.html], { type: 'text/html' }),
          'text/plain': new Blob([copy.text], { type: 'text/plain' }),
        }),
      ]);
      return;
    } catch {
      // Some browsers refuse rich clipboard writes; plain text still works.
    }
  }
  await navigator.clipboard.writeText(copy.text);
}
