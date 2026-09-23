import { describe, expect, it } from 'vitest';

import { buildCite, extractCiteMetadata, formatCiteDate, sourceFromUrl } from '@/src/article/cite';

function docFrom(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('extractCiteMetadata', () => {
  it('reads OpenGraph and article meta tags', () => {
    const metadata = extractCiteMetadata(
      docFrom(`
        <head>
          <meta property="og:title" content="A Case for the Policy">
          <meta name="author" content="Jane Roe">
          <meta property="article:published_time" content="2024-03-02T10:00:00Z">
          <meta property="og:site_name" content="The Example Review">
        </head>`),
      'https://example.com/story',
    );

    expect(metadata).toMatchObject({
      title: 'A Case for the Policy',
      author: 'Jane Roe',
      source: 'The Example Review',
    });
    expect(metadata.date).toContain('2024-03-02');
  });

  it('prefers the article JSON-LD over the site-wide meta tags', () => {
    const metadata = extractCiteMetadata(
      docFrom(`
        <head>
          <meta name="author" content="Site Desk">
          <meta property="og:title" content="Example Review">
          <script type="application/ld+json">
            {
              "@type": "NewsArticle",
              "headline": "A Case for the Policy",
              "author": { "@type": "Person", "name": "Jane Roe" },
              "publisher": { "@type": "Organization", "name": "The Example Review" },
              "datePublished": "2024-03-02"
            }
          </script>
        </head>`),
      'https://example.com/story',
    );

    expect(metadata.author).toBe('Jane Roe');
    expect(metadata.title).toBe('A Case for the Policy');
    expect(metadata.source).toBe('The Example Review');
  });

  it('joins co-authors', () => {
    const metadata = extractCiteMetadata(
      docFrom(`
        <head><script type="application/ld+json">
          {"@type":"Article","author":[{"name":"Jane Roe"},{"name":"John Doe"}]}
        </script></head>`),
      'https://example.com/story',
    );
    expect(metadata.author).toBe('Jane Roe, John Doe');
  });

  it('digs an article out of a JSON-LD @graph', () => {
    const metadata = extractCiteMetadata(
      docFrom(`
        <head><script type="application/ld+json">
          {"@graph":[{"@type":"WebSite","name":"Site"},{"@type":"BlogPosting","headline":"Deep"}]}
        </script></head>`),
      'https://example.com/story',
    );
    expect(metadata.title).toBe('Deep');
  });

  it('survives malformed JSON-LD, which is common', () => {
    const metadata = extractCiteMetadata(
      docFrom(`
        <head>
          <title>Fallback Title</title>
          <script type="application/ld+json">{ not json </script>
        </head>`),
      'https://example.com/story',
    );
    expect(metadata.title).toBe('Fallback Title');
  });

  it('falls back to the document title and the hostname', () => {
    const metadata = extractCiteMetadata(
      docFrom('<head><title>Just a Page</title></head>'),
      'https://www.example.com/story',
    );
    expect(metadata.title).toBe('Just a Page');
    expect(metadata.source).toBe('example.com');
    expect(metadata.author).toBeUndefined();
  });
});

describe('buildCite', () => {
  it('renders author, title, source and date', () => {
    expect(
      buildCite({
        author: 'Jane Roe',
        title: 'A Case for the Policy',
        source: 'The Example Review',
        date: '2024-03-02T10:00:00Z',
      }),
    ).toBe(`Jane Roe, "A Case for the Policy", The Example Review, ${formatCiteDate('2024-03-02T10:00:00Z')}`);
  });

  it('leaves out what the page did not say', () => {
    expect(buildCite({ title: 'Untitled Page' })).toBe('"Untitled Page"');
    expect(buildCite({})).toBe('');
  });

  it('does not repeat a source that is also the author', () => {
    expect(buildCite({ author: 'Reuters', source: 'Reuters', title: 'A Report' })).toBe(
      'Reuters, "A Report"',
    );
  });
});

describe('formatCiteDate', () => {
  it('formats an ISO date, which is what meta tags carry', () => {
    expect(formatCiteDate('2024-03-02T10:00:00Z')).toMatch(/2024/);
    expect(formatCiteDate('2024-03-02T10:00:00Z')).not.toContain('T10:00');
  });

  it('repeats a vague date rather than inventing a precise one', () => {
    // `new Date('Spring 2024')` is January 1st, 2024 — a day the page never
    // claimed. A citation must not make that up.
    expect(formatCiteDate('Spring 2024')).toBe('Spring 2024');
    expect(formatCiteDate('2024')).toBe('2024');
    expect(formatCiteDate('Winter')).toBe('Winter');
  });

  it('formats a written-out date that does name a day', () => {
    expect(formatCiteDate('March 2, 2024')).toMatch(/2024/);
  });

  it('keeps a date it cannot parse at all', () => {
    expect(formatCiteDate('12 Nonemberary 2024')).toBe('12 Nonemberary 2024');
  });

  it('has nothing to render for nothing', () => {
    expect(formatCiteDate(undefined)).toBeUndefined();
    expect(formatCiteDate('')).toBeUndefined();
  });
});

describe('sourceFromUrl', () => {
  it('drops a leading www', () => {
    expect(sourceFromUrl('https://www.example.com/a')).toBe('example.com');
  });

  it('gives nothing for a value that is not a URL', () => {
    expect(sourceFromUrl('not a url')).toBeUndefined();
  });
});
