/**
 * Reading mode: picks the one element on a page that holds the article and
 * throws the rest away.
 *
 * A port of the scoring extractor in qwksearch-research-agent's
 * `extract-webpage` package
 * (`src/html-to-content/extract-content/extract-content-readability.ts`) — the
 * same unlikely-candidate filter, the same "score block-level text, credit the
 * parent and grandparent, then take the best-scoring container plus its
 * siblings" shape. Two things differ, both because this runs in a browser on a
 * document the reader already has open rather than on a server against fetched
 * HTML: it walks a real DOM instead of running regexes over a string, and it
 * is handed a *cloned* document so nothing it strips is visible on the page.
 */

/** Containers that are almost never the article, by class/id. */
const UNLIKELY =
  /combx|comment|community|disqus|extra|foot|header|menu|related|remark|rss|share|shoutbox|sidebar|skyscraper|sponsor|ad-break|agegate|pagination|pager|popup|tweet|twitter|masthead|subscribe|newsletter|cookie|consent|paywall|promo|nav|social|breadcrumb/i;

/** ...unless they also look like the article. */
const MAYBE = /and|article|body|column|main|shadow|content|entry|post|story|text/i;

/** Class/id hints that a container *is* the article. */
const POSITIVE =
  /article|body|content|entry|hentry|main|page|pagination|post|text|blog|story/i;

/** Class/id hints that it is not. */
const NEGATIVE =
  /combx|comment|contact|foot|footer|footnote|link|media|meta|outbrain|promo|related|scroll|shoutbox|sidebar|sponsor|shopping|tags|tool|widget|nav|menu|share|social|newsletter|subscribe/i;

/** Elements that carry no reading value wherever they appear. */
const ALWAYS_DROP =
  'script,style,noscript,template,link,meta,iframe,object,embed,canvas,svg,form,input,button,select,textarea,dialog,video,audio';

/** Elements scored directly; their score is credited upward to their container. */
const SCORED_BLOCKS = 'p,pre,td,blockquote,article,section,h1,h2,h3';

/** Tags the reading-mode body may contain. Everything else is unwrapped. */
export const ALLOWED_TAGS = new Set([
  'A', 'P', 'BR', 'HR', 'IMG', 'FIGURE', 'FIGCAPTION', 'PICTURE', 'SOURCE',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'UL', 'OL', 'LI', 'DL', 'DT', 'DD',
  'BLOCKQUOTE', 'PRE', 'CODE', 'Q', 'CITE',
  'STRONG', 'B', 'EM', 'I', 'U', 'S', 'SUB', 'SUP', 'MARK', 'SMALL', 'ABBR', 'TIME',
  'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD', 'CAPTION', 'COLGROUP', 'COL',
  'DIV', 'SPAN', 'SECTION', 'ARTICLE', 'MAIN', 'HEADER', 'FOOTER',
]);

/** Attributes kept on a surviving element, per tag. */
const ALLOWED_ATTRS: Record<string, string[]> = {
  A: ['href', 'title'],
  IMG: ['src', 'srcset', 'alt', 'title', 'width', 'height', 'loading'],
  SOURCE: ['srcset', 'type', 'media'],
  TIME: ['datetime'],
  TD: ['colspan', 'rowspan'],
  TH: ['colspan', 'rowspan', 'scope'],
  COL: ['span'],
  COLGROUP: ['span'],
};

/** The visible text of an element, whitespace-collapsed. */
function textOf(el: Element): string {
  return (el.textContent || '').replace(/\s+/g, ' ').trim();
}

/** Share of an element's text that sits inside links — high means navigation. */
function linkDensity(el: Element): number {
  const total = textOf(el).length;
  if (total === 0) return 0;
  let linked = 0;
  el.querySelectorAll('a').forEach((a) => {
    linked += textOf(a).length;
  });
  return linked / total;
}

/** `class` and `id` together, which is what the hint regexes are matched against. */
function classAndId(el: Element): string {
  return `${el.className && typeof el.className === 'string' ? el.className : ''} ${el.id || ''}`;
}

/**
 * A container's starting score, from its tag and its class/id hints — before
 * any of the text it holds is counted.
 */
function baseScore(el: Element): number {
  let score = 0;
  switch (el.tagName) {
    case 'ARTICLE':
    case 'MAIN':
      score += 15;
      break;
    case 'DIV':
    case 'SECTION':
      score += 5;
      break;
    case 'PRE':
    case 'TD':
    case 'BLOCKQUOTE':
      score += 3;
      break;
    case 'ADDRESS':
    case 'OL':
    case 'UL':
    case 'DL':
    case 'DD':
    case 'DT':
    case 'LI':
    case 'FORM':
      score -= 3;
      break;
    case 'H1':
    case 'H2':
    case 'H3':
    case 'H4':
    case 'H5':
    case 'H6':
    case 'TH':
      score -= 5;
      break;
  }
  const hints = classAndId(el);
  if (POSITIVE.test(hints)) score += 25;
  if (NEGATIVE.test(hints)) score -= 25;
  if (el.getAttribute('itemprop') === 'articleBody') score += 30;
  return score;
}

/**
 * Removes what is definitely not article text: inert elements, and containers
 * whose class/id marks them as chrome without also marking them as content.
 */
function stripUnlikely(root: Element): void {
  root.querySelectorAll(ALWAYS_DROP).forEach((el) => el.remove());
  root.querySelectorAll('[aria-hidden="true"],[hidden]').forEach((el) => el.remove());
  Array.from(root.querySelectorAll('*')).forEach((el) => {
    if (el.tagName === 'BODY' || el.tagName === 'HTML') return;
    const hints = classAndId(el);
    if (!hints.trim()) return;
    if (UNLIKELY.test(hints) && !MAYBE.test(hints)) el.remove();
  });
}

/**
 * The container holding the page's article text, scored the way the upstream
 * extractor scores it: every block of real prose credits its parent with a
 * point per comma plus a point per 100 characters, and half of that to its
 * grandparent, so the element that *contains* the prose wins rather than the
 * longest single paragraph. A container full of links is discounted at the
 * end, which is what keeps link lists and related-story rails from winning.
 */
function findTopCandidate(root: Element): Element | null {
  const scores = new Map<Element, number>();

  const credit = (el: Element | null, amount: number) => {
    if (!el || el.tagName === 'HTML' || el.tagName === 'BODY') return;
    if (!scores.has(el)) scores.set(el, baseScore(el));
    scores.set(el, (scores.get(el) ?? 0) + amount);
  };

  root.querySelectorAll(SCORED_BLOCKS).forEach((block) => {
    const text = textOf(block);
    // Short blocks are captions, bylines and button labels, not prose.
    if (text.length < 25) return;
    const points = 1 + text.split(',').length - 1 + Math.min(Math.floor(text.length / 100), 3);
    credit(block.parentElement, points);
    credit(block.parentElement?.parentElement ?? null, points / 2);
  });

  let best: Element | null = null;
  let bestScore = 0;
  scores.forEach((score, el) => {
    const adjusted = score * (1 - linkDensity(el));
    if (adjusted > bestScore) {
      bestScore = adjusted;
      best = el;
    }
  });
  return best;
}

/**
 * Siblings of the winning container that are themselves article text — the
 * lead paragraph and the pull quotes that so often sit outside the main
 * `<div>` — gathered into one fragment with it.
 */
function collectArticle(doc: Document, candidate: Element): Element {
  const container = doc.createElement('div');
  const parent = candidate.parentElement;
  if (!parent) {
    container.appendChild(candidate.cloneNode(true));
    return container;
  }

  const candidateText = textOf(candidate).length;
  Array.from(parent.children).forEach((sibling) => {
    if (sibling === candidate) {
      container.appendChild(sibling.cloneNode(true));
      return;
    }
    const text = textOf(sibling);
    if (text.length < 80) return;
    // A sibling has to look like prose on its own terms to come along: mostly
    // unlinked text, and a meaningful share of the winner's own bulk.
    if (linkDensity(sibling) > 0.25) return;
    if (text.length < candidateText * 0.1) return;
    if (NEGATIVE.test(classAndId(sibling)) && !POSITIVE.test(classAndId(sibling))) return;
    container.appendChild(sibling.cloneNode(true));
  });

  return container;
}

/**
 * Rebuilds a subtree out of allowed tags and attributes only, resolving
 * relative URLs against the page it came from.
 *
 * This is the sanitizer, and it works by construction rather than by
 * blocklist: nodes are copied into a fresh document one at a time, so an
 * element that is not on the allowlist can only contribute its text, and an
 * attribute that is not on the allowlist cannot come across at all. That
 * closes `onerror=`, `javascript:` and `<script>` by never copying them, which
 * matters because the panel renders this markup as HTML.
 */
function toCleanHtml(node: Node, doc: Document, baseUrl: string): Node | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return doc.createTextNode(node.textContent || '');
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const el = node as Element;
  const keep = ALLOWED_TAGS.has(el.tagName);
  const target = keep ? doc.createElement(el.tagName.toLowerCase()) : doc.createDocumentFragment();

  if (keep && target instanceof Element) {
    for (const attr of ALLOWED_ATTRS[el.tagName] ?? []) {
      const value = el.getAttribute(attr);
      if (!value) continue;
      if (attr === 'href' || attr === 'src') {
        const absolute = absolutize(value, baseUrl);
        // Anything that is not a plain web URL or a data-image is dropped
        // rather than rewritten, which is what rules out `javascript:`.
        if (!absolute) continue;
        target.setAttribute(attr, absolute);
      } else {
        target.setAttribute(attr, value);
      }
    }
    if (el.tagName === 'A') {
      target.setAttribute('target', '_blank');
      target.setAttribute('rel', 'noopener noreferrer');
    }
  }

  el.childNodes.forEach((child) => {
    const cleaned = toCleanHtml(child, doc, baseUrl);
    if (cleaned) target.appendChild(cleaned);
  });

  return target;
}

/**
 * A URL safe to put in `href`/`src`, absolute against the page it came from,
 * or `null` for a scheme the panel should not render.
 */
export function absolutize(value: string, baseUrl: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^data:image\//i.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed, baseUrl);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/** Collapses the empty wrappers left behind once unwanted elements are gone. */
function dropEmpty(root: Element): void {
  let changed = true;
  while (changed) {
    changed = false;
    root.querySelectorAll('div,span,section,p,li,figure,header,footer').forEach((el) => {
      if (el.querySelector('img')) return;
      if (textOf(el).length === 0) {
        el.remove();
        changed = true;
      }
    });
  }
}

export interface ReadingModeResult {
  html: string;
  wordCount: number;
}

/**
 * Turns a page into reading mode: its article body as sanitized HTML, and the
 * word count of that body.
 *
 * Returns `null` when nothing on the page scores as an article — a search
 * results page, an app screen, an empty shell — so callers can say so rather
 * than show a panel of navigation links.
 */
export function toReadingMode(
  sourceDoc: Document,
  baseUrl: string,
  { minLength = 140 }: { minLength?: number } = {},
): ReadingModeResult | null {
  // Every mutation below happens on a copy. When the panel extracts the tab
  // the reader is on, `sourceDoc` may be that live page.
  const working = sourceDoc.cloneNode(true) as Document;
  const body = working.body;
  if (!body) return null;

  stripUnlikely(body);

  const candidate = findTopCandidate(body) ?? body.querySelector('article') ?? body;
  const collected = collectArticle(working, candidate);
  dropEmpty(collected);

  const output = document.implementation.createHTMLDocument('');
  const cleaned = toCleanHtml(collected, output, baseUrl);
  if (!cleaned) return null;
  const holder = output.createElement('div');
  holder.appendChild(cleaned);
  dropEmpty(holder);

  const text = (holder.textContent || '').replace(/\s+/g, ' ').trim();
  if (text.length < minLength) return null;

  return {
    html: holder.innerHTML,
    wordCount: text.split(/\s+/).filter(Boolean).length,
  };
}
