import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EXTRACT_ARTICLE_API,
  RemoteExtractError,
  fetchExtractedArticle,
  fetchRemoteArticle,
  isPdf,
  prefersRemoteExtraction,
  transcriptToHtml,
  youtubeVideoId,
} from '@/src/article/remote';

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const LONG = 'The affirmative bears the burden of proof on the resolution. '.repeat(10);

describe('youtubeVideoId', () => {
  it('reads every YouTube URL shape', () => {
    expect(youtubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s')).toBe('dQw4w9WgXcQ');
    expect(youtubeVideoId('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeVideoId('https://youtu.be/dQw4w9WgXcQ?si=x')).toBe('dQw4w9WgXcQ');
    expect(youtubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('is null for anything else', () => {
    expect(youtubeVideoId('https://www.youtube.com/feed/subscriptions')).toBeNull();
    expect(youtubeVideoId('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(youtubeVideoId('not a url')).toBeNull();
  });
});

describe('isPdf / prefersRemoteExtraction', () => {
  it('spots PDFs by path or by the viewer content type', () => {
    expect(isPdf('https://example.com/paper.PDF')).toBe(true);
    expect(isPdf('https://arxiv.org/pdf/1706.03762', { contentType: 'application/pdf' })).toBe(true);
    expect(isPdf('https://example.com/story')).toBe(false);
  });

  it('sends videos and PDFs to the server, ordinary pages to the tab', () => {
    expect(prefersRemoteExtraction('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
    expect(prefersRemoteExtraction('https://example.com/a.pdf')).toBe(true);
    expect(prefersRemoteExtraction('https://example.com/story', { contentType: 'text/html' })).toBe(false);
  });
});

describe('transcriptToHtml', () => {
  it('groups lines into timestamped paragraphs and keeps captions as text', () => {
    const html = transcriptToHtml('dQw4w9WgXcQ', [
      { text: 'Hello <b>there</b>', start: 0 },
      { text: 'second line', start: 5 },
      { text: 'new paragraph', start: 75 },
    ]);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const paragraphs = doc.querySelectorAll('p');
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].textContent).toBe('0:00 Hello <b>there</b> second line');
    expect(doc.querySelector('b')).toBeNull();
    expect(paragraphs[1].querySelector('a')!.getAttribute('href')).toBe(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=75s',
    );
  });
});

describe('fetchExtractedArticle', () => {
  it('asks extract-webpage for the URL and sanitizes what comes back', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        article: {
          html: `<p onclick="x()">${LONG}</p><script>alert(1)</script><a href="javascript:x">bad</a>`,
          cite: '<b>Smith</b>, "Paper," Journal, 2024',
          title: 'Paper',
          author: 'Smith',
          word_count: '120',
        },
      }),
    );
    const article = await fetchExtractedArticle('https://example.com/paper.pdf');
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      `${EXTRACT_ARTICLE_API}?url=${encodeURIComponent('https://example.com/paper.pdf')}`,
    );
    expect(article.html).toContain('burden of proof');
    expect(article.html).not.toContain('onclick');
    expect(article.html).not.toContain('alert');
    expect(article.html).not.toContain('javascript:');
    expect(article.cite).toBe('Smith, "Paper," Journal, 2024');
    expect(article.title).toBe('Paper');
    expect(article.word_count).toBeGreaterThan(20);
  });

  it('reports a page with no text as not readable', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ article: { html: '<p>tiny</p>' } }));
    await expect(fetchExtractedArticle('https://example.com')).rejects.toBeInstanceOf(RemoteExtractError);
  });
});

describe('fetchRemoteArticle', () => {
  it('reads a YouTube video from the debate-ai.com transcript first', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ videoId: 'dQw4w9WgXcQ', snippets: [{ text: 'First words of the round.', start: 1, duration: 2 }] }),
    );
    const article = await fetchRemoteArticle('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
      apiBase: 'https://debate-ai.com/',
      title: 'Finals round - YouTube',
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://debate-ai.com/api/transcript?videoId=dQw4w9WgXcQ');
    expect(article.title).toBe('Finals round');
    expect(article.source).toBe('YouTube');
    expect(article.html).toContain('First words of the round.');
  });

  it('falls back to extract-webpage when the video has no stored transcript', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ videoId: 'dQw4w9WgXcQ', snippets: [], unavailable: 'none' }))
      .mockResolvedValueOnce(jsonResponse({ article: { html: `<p>${LONG}</p>`, title: 'Video' } }));
    const article = await fetchRemoteArticle('https://youtu.be/dQw4w9WgXcQ', { apiBase: 'https://debate-ai.com' });
    expect(String(fetchMock.mock.calls[1][0])).toContain(EXTRACT_ARTICLE_API);
    expect(article.title).toBe('Video');
  });
});
