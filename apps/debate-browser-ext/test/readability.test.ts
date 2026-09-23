import { describe, expect, it } from 'vitest';

import { absolutize, toReadingMode } from '@/src/article/readability';

/** Builds a document the way `DOMParser` gives the extractor one. */
function docFrom(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

const PARAGRAPH =
  'The resolution asks whether the policy should be adopted, and the affirmative bears the burden of proof, which is a claim worth examining closely. ';

function article(paragraphs = 4): string {
  return Array.from({ length: paragraphs }, (_, i) => `<p>${i} ${PARAGRAPH}</p>`).join('');
}

describe('toReadingMode', () => {
  it('keeps the article and drops the navigation around it', () => {
    const result = toReadingMode(
      docFrom(`
        <body>
          <nav class="site-nav"><a href="/a">Home</a><a href="/b">Topics</a></nav>
          <div class="article-body">${article()}</div>
          <div class="sidebar"><a href="/x">Related story one</a><a href="/y">Related two</a></div>
          <footer class="footer">Copyright</footer>
        </body>`),
      'https://example.com/story',
    );

    expect(result).not.toBeNull();
    expect(result!.html).toContain('the affirmative bears the burden');
    expect(result!.html).not.toContain('Topics');
    expect(result!.html).not.toContain('Related story one');
    expect(result!.html).not.toContain('Copyright');
  });

  it('counts the words of what it kept', () => {
    const result = toReadingMode(
      docFrom(`<body><div class="post">${article(2)}</div></body>`),
      'https://example.com/story',
    );
    // Two paragraphs of the same sentence, each prefixed with its index.
    expect(result!.wordCount).toBe(2 * (PARAGRAPH.trim().split(/\s+/).length + 1));
  });

  it('returns null when there is no article to read', () => {
    expect(
      toReadingMode(
        docFrom('<body><div id="app"><button>Sign in</button></div></body>'),
        'https://example.com/app',
      ),
    ).toBeNull();
  });

  it('never executes or carries over scripts and handlers', () => {
    const result = toReadingMode(
      docFrom(`
        <body>
          <div class="article-body">
            ${article()}
            <script>window.stolen = true;</script>
            <p onclick="alert(1)">Handled ${PARAGRAPH}</p>
            <a href="javascript:alert(1)">Click</a>
            <img src="x" onerror="alert(1)">
          </div>
        </body>`),
      'https://example.com/story',
    );

    const html = result!.html;
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('javascript:');
    // The link's text survives even though its unsafe href does not.
    expect(html).toContain('Click');
  });

  it('resolves relative links and images against the page', () => {
    const result = toReadingMode(
      docFrom(`
        <body>
          <div class="article-body">
            ${article()}
            <p><a href="/other">Other</a></p>
            <img src="../img/photo.jpg" alt="A photo">
          </div>
        </body>`),
      'https://example.com/news/story',
    );

    expect(result!.html).toContain('https://example.com/other');
    expect(result!.html).toContain('https://example.com/img/photo.jpg');
    expect(result!.html).toContain('alt="A photo"');
  });

  it('opens links in a new tab, since the panel is not a browsing context', () => {
    const result = toReadingMode(
      docFrom(`<body><div class="article-body">${article()}<p><a href="/x">X</a></p></div></body>`),
      'https://example.com/story',
    );
    expect(result!.html).toContain('target="_blank"');
    expect(result!.html).toContain('rel="noopener noreferrer"');
  });

  it('leaves the document it was given untouched', () => {
    const doc = docFrom(`<body><nav class="site-nav">Nav</nav><div class="post">${article()}</div></body>`);
    toReadingMode(doc, 'https://example.com/story');
    expect(doc.querySelector('.site-nav')).not.toBeNull();
  });

  it('prefers the container with the prose over one with more links', () => {
    const result = toReadingMode(
      docFrom(`
        <body>
          <div class="content">
            <div class="entry">${article()}</div>
            <div class="more-links">
              ${Array.from({ length: 20 }, (_, i) => `<p><a href="/s${i}">Story number ${i} about the topic</a></p>`).join('')}
            </div>
          </div>
        </body>`),
      'https://example.com/story',
    );
    expect(result!.html).toContain('the affirmative bears the burden');
    expect(result!.html).not.toContain('Story number 7');
  });
});

describe('absolutize', () => {
  it('resolves a relative URL against the page', () => {
    expect(absolutize('/a', 'https://example.com/x/y')).toBe('https://example.com/a');
  });

  it('keeps inline images', () => {
    expect(absolutize('data:image/png;base64,AAA', 'https://example.com')).toBe(
      'data:image/png;base64,AAA',
    );
  });

  it('rejects every scheme that is not a page or an image', () => {
    expect(absolutize('javascript:alert(1)', 'https://example.com')).toBeNull();
    expect(absolutize('data:text/html,<script>', 'https://example.com')).toBeNull();
    expect(absolutize('  ', 'https://example.com')).toBeNull();
  });
});
