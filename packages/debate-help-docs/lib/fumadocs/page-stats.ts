/**
 * @file page-stats.ts
 * @description Counts for a docs page's Info button (`components/guides/page-info.tsx`):
 * words, reading time, sections, links, figures and so on, worked out on the
 * server from the page's processed Markdown and its table of contents.
 */
import { readability, type Readability } from './readability';

/** Words a minute for the reading-time estimate (adult silent reading). */
export const WORDS_PER_MINUTE = 238;

export interface PageStats {
  words: number;
  characters: number;
  readingMinutes: number;
  paragraphs: number;
  /** Top-level sections (`##` headings). */
  sections: number;
  /** Every heading in the table of contents. */
  headings: number;
  links: number;
  images: number;
  tables: number;
  codeBlocks: number;
  /** Author-date citations, `(Smith 2004)` or `Smith (2004)`, and `[^n]` footnote marks. */
  citations: number;
  /** `==highlighted==` passages (the Synergy Slayer papers' underlining). */
  highlights: number;
  /** Readability scores for the page's prose (`lib/fumadocs/readability.ts`). */
  readability: Readability;
}

const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;
const HAS_WORD = /[\p{L}\p{N}]/u;
/**
 * Author-date citations: each part of `(Smith 2004, 12; Jones and Lee 1999a)`,
 * or a narrative `Smith (2004)` / `Smith et al. (2004)`.
 */
const AUTHOR_DATE =
  /(?:\((?:cf\. |see )?|; )\p{Lu}[\p{L}'’.-]+(?: (?:et al\.|and|&) \p{Lu}[\p{L}'’.-]*)?,? \d{4}[a-z]?(?=[;,:)])|\p{Lu}[\p{L}'’.-]+(?: et al\.)?(?:'s|’s)? \(\d{4}[a-z]?[,)]/gu;
const FENCE = /^(```|~~~)[^\n]*\n[\s\S]*?^\1[ \t]*$/gm;

/** Strips Markdown/MDX syntax down to the words a reader sees. */
function proseOf(markdown: string): string {
  return markdown
    .replace(FENCE, ' ')
    .replace(/^---\n[\s\S]*?\n---\n/, ' ') // frontmatter
    .replace(/^\s*(import|export)\s.*$/gm, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{[^{}]*\}/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/==|[*_#>|~]/g, ' ');
}

/**
 * The page's running prose for the readability scores: no frontmatter, code,
 * headings, tables, links' URLs, citations or highlight marks. Each paragraph
 * ends up on its own line so a paragraph break also ends a sentence.
 */
export function readableProse(markdown: string): string {
  return markdown
    .replace(FENCE, '\n\n')
    .replace(/^---\n[\s\S]*?\n---\n/, '\n\n')
    .replace(/^\s*(import|export)\s.*$/gm, '')
    .replace(/^\s{0,3}#{1,6}\s.*$/gm, '\n')
    .replace(/^\s*\|.*$/gm, '')
    .replace(/^\s*[-*+]\s+|^\s*\d+[.)]\s+|^\s*>\s?/gm, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[\^[^\]]+\]:?/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{[^{}]*\}/g, ' ')
    .replace(AUTHOR_DATE, ' ')
    .replace(/\(\s*\)/g, '')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/==|[*_~]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n');
}

/**
 * Stats for one page.
 *
 * @param markdown - The page's processed Markdown (`page.data.getText('processed')`).
 * @param toc - The page's table of contents (each heading's `depth`).
 */
export function pageStats(markdown: string, toc: ReadonlyArray<{ depth: number }> = []): PageStats {
  const prose = proseOf(markdown);
  const words = prose.match(WORD)?.length ?? 0;
  const withoutCode = markdown.replace(FENCE, '');
  const paragraphs = withoutCode
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block && !/^(#|\||import\s|export\s|<\/?[A-Za-z]|!\[|---)/.test(block) && HAS_WORD.test(block)).length;

  return {
    words,
    characters: prose.replace(/\s+/g, ' ').trim().length,
    readingMinutes: words === 0 ? 0 : Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
    paragraphs,
    sections: toc.filter((item) => item.depth === 2).length,
    headings: toc.length,
    links: withoutCode.match(/(?<!!)\[[^\]]+\]\([^)]+\)/g)?.length ?? 0,
    images: (withoutCode.match(/!\[[^\]]*\]\([^)]+\)/g)?.length ?? 0) + (withoutCode.match(/<img\b/gi)?.length ?? 0),
    tables: withoutCode.match(/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/gm)?.length ?? 0,
    codeBlocks: markdown.match(FENCE)?.length ?? 0,
    citations:
      (withoutCode.match(AUTHOR_DATE)?.length ?? 0) + (withoutCode.match(/\[\^[^\]]+\](?!:)/g)?.length ?? 0),
    highlights: withoutCode.match(/==(?=\S)[\s\S]*?\S==/g)?.length ?? 0,
    readability: readability(readableProse(markdown)),
  };
}
