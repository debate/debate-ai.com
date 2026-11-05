import { describe, expect, it, vi } from 'vitest';

import { extractContent, loadSectionPages } from '../src/sections';

const page = (body: string) =>
  `<html><body><nav>Sidebar</nav><div class="doc"><h2 id="a">Heading</h2><p>${body} <mark class="debate-hl">marked</mark></p><script>alert(1)</script></div></body></html>`;

describe('extractContent', () => {
  it('keeps the content and its marks, dropping scripts and ids', () => {
    const html = extractContent(page('Text'), '.doc');
    expect(html).toContain('<mark class="debate-hl">marked</mark>');
    expect(html).not.toContain('script');
    expect(html).not.toContain('id=');
    expect(html).not.toContain('Sidebar');
  });

  it('is empty when the selector matches nothing', () => {
    expect(extractContent('<p>x</p>', '.doc')).toBe('');
  });
});

describe('loadSectionPages', () => {
  it('loads every page in order, using local content and tolerating failures', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      if (String(url) === '/b') return new Response('nope', { status: 500 });
      return new Response(page(`Page ${String(url)}`));
    }) as unknown as typeof fetch;
    const pages = await loadSectionPages(
      [
        { url: '/a', title: 'A' },
        { url: '/b', title: 'B' },
        { url: '/c', title: 'C' },
        { url: '/here', title: 'Here' },
      ],
      { selector: '.doc', fetcher, concurrency: 2, local: (p) => (p.url === '/here' ? '<p>live</p>' : null) },
    );
    expect(pages.map((p) => p.title)).toEqual(['A', 'B', 'C', 'Here']);
    expect(pages[0]!.html).toContain('Page /a');
    expect(pages[1]!.html).toBe('');
    expect(pages[2]!.html).toContain('Page /c');
    expect(pages[3]!.html).toBe('<p>live</p>');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
