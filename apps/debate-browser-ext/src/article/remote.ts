/**
 * Reading mode for what the page's own DOM can't give us: YouTube videos
 * (their transcript), PDFs (the browser's viewer has no article markup), and
 * any page the local extractor (./extract) finds nothing in.
 *
 * Two server-side sources, by URL rather than by page snapshot:
 *
 * - **YouTube** — debate-ai.com's `GET /api/transcript?videoId=`, the same
 *   cached transcript the video library's captions panel reads.
 * - **Anything else** — qwksearch's `GET /api/doc/article?url=`, which runs the
 *   URL through `extract-webpage` server side (web pages, PDFs, and YouTube
 *   too when debate-ai.com has no transcript), the extractor the card
 *   library's source-article panel already uses.
 *
 * Only the URL is sent, and only when the reader opens reading mode on that
 * page — never from the on-every-page article detection.
 */
import { buildCite, sourceFromUrl } from './cite';
import { sanitizeArticleHtml } from './readability';
import type { Article, PageSnapshot } from './types';

/** qwksearch's extract-webpage endpoint. */
export const EXTRACT_ARTICLE_API = 'https://qwksearch.com/api/doc/article';

/** Below this many words a server extraction counts as having found nothing. */
const MIN_EXTRACTED_WORDS = 20;

/** Seconds of transcript per paragraph, each opening with its timestamp. */
const TRANSCRIPT_PARAGRAPH_SECONDS = 30;

export class RemoteExtractError extends Error {}

/** The video id of a YouTube watch, short, shorts or embed URL, or `null`. */
export function youtubeVideoId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^(www|m|music)\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = parsed.pathname.slice(1).split('/')[0] ?? null;
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id =
      parsed.searchParams.get('v') ??
      parsed.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/)?.[1] ??
      null;
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

/** Whether the URL names a PDF, or the snapshot came from the browser's PDF viewer. */
export function isPdf(url: string, snapshot?: Pick<PageSnapshot, 'contentType'>): boolean {
  if (snapshot?.contentType === 'application/pdf') return true;
  try {
    return /\.pdf$/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

/** Whether reading mode should go straight to the server for this page. */
export function prefersRemoteExtraction(url: string, snapshot?: Pick<PageSnapshot, 'contentType'>): boolean {
  return youtubeVideoId(url) !== null || isPdf(url, snapshot);
}

interface TranscriptSnippet {
  text: string;
  start: number;
}

function timestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`;
}

/**
 * Transcript lines as reading-mode HTML: a paragraph per
 * {@link TRANSCRIPT_PARAGRAPH_SECONDS}, each opening with a link to that
 * moment in the video. Built node by node, so caption text is only ever text.
 */
export function transcriptToHtml(videoId: string, snippets: TranscriptSnippet[]): string {
  const doc = document.implementation.createHTMLDocument('');
  const holder = doc.createElement('div');
  let paragraph: HTMLParagraphElement | null = null;
  let paragraphStart = -Infinity;
  for (const snippet of snippets) {
    const text = snippet.text.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    if (!paragraph || snippet.start - paragraphStart >= TRANSCRIPT_PARAGRAPH_SECONDS) {
      paragraph = doc.createElement('p');
      paragraphStart = snippet.start;
      const link = doc.createElement('a');
      link.href = `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(snippet.start)}s`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = timestamp(snippet.start);
      paragraph.append(link, ' ');
      holder.appendChild(paragraph);
    } else {
      paragraph.append(' ');
    }
    paragraph.append(text);
  }
  return holder.innerHTML;
}

function wordCount(html: string): number {
  return html.replace(/<[^>]*>/g, ' ').match(/\S+/g)?.length ?? 0;
}

/** A YouTube video's transcript from debate-ai.com, as an article. */
export async function fetchYouTubeTranscriptArticle(
  url: string,
  { apiBase, title, signal }: { apiBase: string; title?: string; signal?: AbortSignal },
): Promise<Article> {
  const videoId = youtubeVideoId(url);
  if (!videoId) throw new RemoteExtractError('Not a YouTube video.');
  const response = await fetch(
    `${apiBase.replace(/\/+$/, '')}/api/transcript?videoId=${encodeURIComponent(videoId)}`,
    { signal },
  );
  if (!response.ok) throw new RemoteExtractError(`Transcript request failed (${response.status}).`);
  const payload = (await response.json()) as { snippets?: TranscriptSnippet[]; unavailable?: string };
  const snippets = Array.isArray(payload.snippets) ? payload.snippets : [];
  if (snippets.length === 0) {
    throw new RemoteExtractError(payload.unavailable || 'No transcript available for this video.');
  }
  const html = transcriptToHtml(videoId, snippets);
  const cleanTitle = (title ?? '').replace(/\s*-\s*YouTube$/i, '').trim() || 'YouTube video';
  return {
    url,
    title: cleanTitle,
    source: 'YouTube',
    cite: buildCite({ title: cleanTitle, source: 'YouTube' }),
    html,
    word_count: wordCount(html),
  };
}

/** Text of a server-built citation, which arrives as markup. */
function plainText(markup: string | undefined): string | undefined {
  if (!markup) return undefined;
  const text = new DOMParser().parseFromString(markup, 'text/html').body.textContent ?? '';
  return text.replace(/\s+/g, ' ').trim() || undefined;
}

/** Any URL — web page, PDF, YouTube — through the server-side extract-webpage. */
export async function fetchExtractedArticle(url: string, signal?: AbortSignal): Promise<Article> {
  const response = await fetch(`${EXTRACT_ARTICLE_API}?url=${encodeURIComponent(url)}`, { signal });
  if (!response.ok) throw new RemoteExtractError(`The extractor could not read this page (${response.status}).`);
  const payload = (await response.json()) as { article?: Record<string, unknown> & { error?: unknown } };
  const article = payload.article;
  const reading =
    article && !article.error && typeof article.html === 'string'
      ? sanitizeArticleHtml(article.html, url)
      : null;
  if (!article || !reading || reading.wordCount < MIN_EXTRACTED_WORDS) {
    throw new RemoteExtractError('No readable text was found at this address.');
  }
  const str = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);
  const title = str(article.title);
  const metadata = {
    title,
    author: str(article.author),
    date: str(article.date),
    source: str(article.source) ?? sourceFromUrl(url),
  };
  return {
    url: str(article.url) ?? url,
    ...metadata,
    cite: plainText(str(article.cite)) ?? buildCite(metadata),
    html: reading.html,
    word_count: reading.wordCount,
  };
}

/**
 * The article for a URL from the server: a YouTube video's transcript from
 * debate-ai.com first, then extract-webpage for anything (including a video
 * with no stored transcript).
 */
export async function fetchRemoteArticle(
  url: string,
  options: { apiBase: string; title?: string; signal?: AbortSignal },
): Promise<Article> {
  if (youtubeVideoId(url)) {
    try {
      return await fetchYouTubeTranscriptArticle(url, options);
    } catch (error) {
      if (options.signal?.aborted) throw error;
      // Fall through to extract-webpage, which fetches transcripts itself.
    }
  }
  return fetchExtractedArticle(url, options.signal);
}
