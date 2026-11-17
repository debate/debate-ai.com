/**
 * @file inline-toc.ts
 * @description Groups a page's heading list (Fumadocs `toc`) into the
 * in-page table of contents shown at the top of Debate Basics pages.
 *
 * Only the top two heading levels on the page are kept: on the long Debate Basics
 * pages those are the topic groups (`##`) and the sections under them
 * (`###`). Anything deeper stays in the side TOC.
 */
import type { TOCItemType } from 'fumadocs-core/toc';

export interface InlineTocGroup {
  /** The top-level heading, or undefined for sections before the first one. */
  item?: TOCItemType;
  /** The second-level headings under it. */
  children: TOCItemType[];
}

/** Docs sections whose pages get the in-page table of contents. */
  export const INLINE_TOC_SECTIONS = ['debate-basics'];

/** True when a page (by its slugs) shows the in-page table of contents. */
export function hasInlineToc(slugs: string[]): boolean {
  return INLINE_TOC_SECTIONS.includes(slugs[0] ?? '');
}

/** Groups a page's toc into top-level headings with their sub-headings. */
export function groupInlineToc(toc: TOCItemType[]): InlineTocGroup[] {
  if (toc.length === 0) return [];
  const top = Math.min(...toc.map((item) => item.depth));
  const groups: InlineTocGroup[] = [];
  for (const item of toc) {
    if (item.depth === top) {
      groups.push({ item, children: [] });
    } else if (item.depth === top + 1) {
      if (groups.length === 0) groups.push({ children: [] });
      groups[groups.length - 1].children.push(item);
    }
  }
  return groups;
}

/** Number of links the in-page table of contents would show. */
export function inlineTocSize(groups: InlineTocGroup[]): number {
  return groups.reduce((n, g) => n + (g.item ? 1 : 0) + g.children.length, 0);
}
