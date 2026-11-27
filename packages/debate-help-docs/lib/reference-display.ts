/**
 * @file reference-display.ts
 * @description Pure helpers for how the References side panel
 * (`components/guides/references-panel.tsx`) lays out one source:
 *
 *   1. the card's summary,
 *   2. `Authors ’yy — qualifications` and the full Chicago citation,
 *   3. the quoted card text, in the collapsible part.
 *
 * Everything here is string heuristics, with no React, so it is unit tested
 * on its own (`apps/debate-web/lib/__tests__/docs-reference-display.test.ts`):
 *
 * - `parseReferenceCard` splits a card's HTML into summary, qualification and quote.
 * - `yearTick` and `stripAuthorFromQualification` shorten the year and the
 *   qualification line.
 * - `classifySource`, `isInstitutionAuthor` and `isProfessor` pick the small
 *   flags drawn on the card's edge. They are best-effort regexes over the
 *   Chicago citation, not authority records.
 */
import { htmlToText } from './mdx/citation-cards';

/** A card HTML split into the parts the panel shows. */
export interface ParsedReferenceCard {
  /** What the card is about: the card's first paragraph. */
  summary: string;
  /** The author's qualifications as the card words them, without markup. */
  qualification: string;
  /** The quoted card text (underlined and highlighted), as HTML. Empty when the entry has none. */
  quoteHtml: string;
}

const EMPTY_CARD: ParsedReferenceCard = { summary: '', qualification: '', quoteHtml: '' };

function tidy(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Whether a paragraph holds nothing but italic text: the qualification line. */
function isQualification(element: Element): boolean {
  if (element.tagName !== 'P') return false;
  const children = Array.from(element.childNodes).filter((node) => tidy(node.textContent ?? '') !== '');
  return children.length === 1 && (children[0] as Element).tagName === 'EM';
}

/**
 * Splits a card (`<div class="debate-card">`: summary, qualification, stats,
 * `<hr>`, quote) into its parts. A card with no rule has its quote after the
 * summary and qualification; a card with only a summary has no quote.
 */
export function parseReferenceCard(cardHtml: string, doc: Document = document): ParsedReferenceCard {
  if (!cardHtml.trim()) return EMPTY_CARD;
  const holder = doc.createElement('div');
  holder.innerHTML = cardHtml;
  const root = holder.querySelector('.debate-card') ?? holder;
  const children = Array.from(root.children).filter((child) => !child.classList.contains('stats'));
  const rule = children.findIndex((child) => child.tagName === 'HR');
  let head = rule >= 0 ? children.slice(0, rule) : [];
  let quote = rule >= 0 ? children.slice(rule + 1) : [];
  if (rule < 0) {
    const first = children[0];
    const second = children[1];
    head = [first, second && isQualification(second) ? second : undefined].filter((child): child is Element => !!child);
    quote = children.slice(head.length);
  }
  const qualificationBlock = head.find(isQualification);
  const summaryBlock = head.find((child) => child !== qualificationBlock && child.tagName === 'P');
  return {
    summary: tidy(summaryBlock?.textContent ?? ''),
    qualification: tidy(qualificationBlock?.textContent ?? ''),
    quoteHtml: quote.map((child) => child.outerHTML).join(''),
  };
}

/** `2020` → `’20`; `[1888] 1990` → `’90`; no year → `n.d.`. */
export function yearTick(year: string): string {
  const years = year.match(/\d{4}/g);
  if (!years) return /n\.?\s*d\.?/i.test(year) ? 'n.d.' : '';
  return `’${years[years.length - 1]!.slice(2)}`;
}

/** A capitalized name of up to five words (`Ryan Galloway`, `Amy A. Kay`). */
const NAME_WORDS = String.raw`(?:\p{Lu}[\p{L}.'’-]*\s+){0,4}\p{Lu}[\p{L}.'’-]*`;

function upperFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The qualification line without the author's own name, so it reads
 * `Longtime college debate coach, Samford University` after `Galloway ’20 —`.
 * Strips `Ryan Galloway is a …` and `Roland Bleiker — …; Amy Kay — …` leads, but
 * only names that contain one of the authors' surnames (for `Smith et al.`,
 * every `Name — ` lead).
 */
export function stripAuthorFromQualification(qualification: string, authors: string): string {
  const surnames = authors
    .replace(/\bet al\.?/i, '')
    .split(/\s*&\s*|,\s*/)
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
  // "Smith et al." names only the first author, so every `Name — ` lead of a multi-author line is a co-author.
  const coAuthored = /\bet al\b/i.test(authors);
  const isAuthor = (name: string) => {
    const lower = name.toLowerCase();
    return coAuthored || surnames.some((surname) => lower.includes(surname));
  };
  let text = tidy(qualification);
  text = text.replace(new RegExp(`(^|;\\s*)(?:edited by\\s+)?(${NAME_WORDS})\\s+[—–-]\\s+`, 'gu'), (whole, lead: string, name: string) =>
    isAuthor(name) ? lead : whole,
  );
  text = text.replace(new RegExp(`^(${NAME_WORDS})\\s+(?:is|was)\\s+(?:(?:an?|the)\\s+)?`, 'u'), (whole, name: string) =>
    isAuthor(name) ? '' : whole,
  );
  return upperFirst(text);
}

/** What kind of publication a source is. */
export type SourceKind = 'court' | 'game' | 'video' | 'report' | 'journal' | 'book' | 'blog' | 'news' | 'web' | 'other';

export const SOURCE_KIND_LABELS: Record<SourceKind, string> = {
  court: 'Court case',
  game: 'Video game',
  video: 'Video',
  report: 'Report, paper or thesis',
  journal: 'Journal article',
  book: 'Book or book chapter',
  blog: 'Blog post',
  news: 'News or magazine article',
  web: 'Web page',
  other: 'Source',
};

const COURT = /\bv\.\s.*\b(?:U\.S\.|S\.\s?Ct\.|F\.\s?(?:\dd|Supp)|L\.\s?Ed\.)/;
const GAME = /\bvideo ?games?\b|\b(?:Bethesda|Nintendo|Ubisoft|Activision|Valve|Sony Interactive|Electronic Arts)\b/i;
const VIDEO = /\b(?:youtube|youtu\.be|vimeo|TED\s?(?:talk|x)|documentary|\[video\]|video recording|directed by)\b/i;
const REPORT =
  /\b(?:working paper|white ?paper|paper presented|conference|workshop|proceedings|zenodo|arxiv|ssrn|ph\.?d\.? (?:diss|thesis)|dissertation|thesis|technical report|policy brief|\bReport\b)/i;
const JOURNAL_VOLUME = /\b\d+\s*\((?:\d{4}|[A-Z][a-z]+\.?(?:\s\d{4})?)\)\s*:\s*\d|\bvol\.\s*\d|\bno\.\s*\d+\b|\b\d+,\s*no\.\s*\d|doi\.org|\bdoi:/i;
const JOURNAL_NAME = /<em>[^<]*\b(?:Journal|Review|Quarterly|Studies|Annals|Transactions|Proceedings|Argumentation|Alternatives|Philosophy|Affairs|Politics|Sociology|Theory|Ethics|Science|Nature|Law|Economics)\b[^<]*<\/em>/;
const CHAPTER = /(?:^|\.\s|”\s)In\s+<em>/;
const PUBLISHER = /\b(?:Press|Books|Publishers?|Publishing|Routledge|Penguin|Random House|Viking|Littlefield|Verso|Polity|Basic Books|Wiley|Springer|Saunders|Elsevier)\b/;
const BLOG = /\b(?:blog|substack|medium\.com|wordpress|blogspot|slowboring|lesswrong|debate roundup|roundup)\b/i;
const NEWS =
  /<em>[^<]*\b(?:New Yorker|Harper|Atlantic|Times|Post|Guardian|Tablet|Magazine|Mondoweiss|Wired|Vox|Politico|Economist|Forbes|Jacobin|Nation|Dispatch|Tribune|Herald|Gazette|News|BBC|CNN|NPR)\b[^<]*<\/em>/i;
const FULL_DATE = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},\s+\d{4}/;
const URL = /https?:\/\/|\bwww\./i;

/**
 * The kind of publication a Chicago bibliography line (HTML) describes, with
 * the card's summary as a hint for things the citation does not say.
 * First match wins; a line that looks like nothing in particular is `other`.
 */
export function classifySource(citationHtml: string, summary = ''): SourceKind {
  const text = htmlToText(citationHtml);
  const quotedTitle = /[“"][^”"]+[”"]/.test(text);
  if (COURT.test(text)) return 'court';
  if (GAME.test(summary) || GAME.test(text)) return 'game';
  if (VIDEO.test(text)) return 'video';
  if (REPORT.test(text) && !JOURNAL_VOLUME.test(text)) return 'report';
  if (quotedTitle && (JOURNAL_VOLUME.test(text) || JOURNAL_NAME.test(citationHtml))) return 'journal';
  if (CHAPTER.test(citationHtml)) return 'book';
  if (BLOG.test(text)) return 'blog';
  if (quotedTitle && (NEWS.test(citationHtml) || FULL_DATE.test(text.replace(/\bAccessed\b[^.]*\./g, '')))) return 'news';
  if (!quotedTitle && /<em>/.test(citationHtml) && (PUBLISHER.test(text) || !URL.test(text))) return 'book';
  if (quotedTitle && /<em>/.test(citationHtml) && URL.test(text)) return 'news';
  if (URL.test(text)) return 'web';
  return 'other';
}

const INSTITUTION =
  /\b(?:Institute|University|College|School|Foundation|Center|Centre|Council|Committee|Association|Agency|Department|Ministry|Commission|Corporation|Company|Studios?|Press|Bureau|Court|Nations|Organi[sz]ation|Society|Project|Initiative|Group|Lab|Laboratory|Network|Forum|Board|Office|Service|Fund|Trust|League|Union|Party|Inc\.?|Ltd\.?|LLC|Government|Congress|Senate|Collective|Consortium|Academy|Library|Museum|Administration)\b|^(?:[A-Z]{2,6}|U\.S\.)(?:\s|$)/;

/**
 * Whether the author is an organization (`U.S. Department of Education`,
 * `Debate AI Institute`) rather than a person. The first words of a Chicago
 * line are the author: a person is `Last, First`, an organization has no comma
 * before its first full stop.
 */
export function isInstitutionAuthor(authors: string, citationHtml: string): boolean {
  if (INSTITUTION.test(authors)) return true;
  const byline = htmlToText(citationHtml).split(/\.\s/)[0] ?? '';
  return INSTITUTION.test(byline) && !byline.includes(',');
}

/** Whether the qualification says the author is a professor (including emeritus and assistant professors). */
export function isProfessor(qualification: string): boolean {
  return /\b(?:professor|prof\.)\b/i.test(qualification);
}
