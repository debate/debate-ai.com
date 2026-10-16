import { describe, expect, it } from 'vitest';

import { ARTICLE_MIN_WORDS, countWords, detectArticle } from '@/src/article/detect';

function docFrom(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

/** `words` words of article prose, in paragraphs of 50. */
function prose(words: number): string {
  const paragraphs: string[] = [];
  for (let i = 0; i < words; i += 50) {
    paragraphs.push(`<p>${Array.from({ length: Math.min(50, words - i) }, (_, j) => `word${i + j},`).join(' ')}</p>`);
  }
  return paragraphs.join('');
}

describe('countWords', () => {
  it('counts whitespace-separated runs', () => {
    expect(countWords('  one two\n\tthree  ')).toBe(3);
    expect(countWords('')).toBe(0);
  });
});

describe('detectArticle', () => {
  it('finds an article longer than the threshold', () => {
    const doc = docFrom(`<body><nav><a href="/">Home</a></nav><article class="post">${prose(1200)}</article></body>`);
    const found = detectArticle(doc, 'https://example.com/story');
    expect(found).not.toBeNull();
    expect(found!.wordCount).toBeGreaterThan(ARTICLE_MIN_WORDS);
  });

  it('skips a page whose text is too short', () => {
    const doc = docFrom(`<body><article class="post">${prose(400)}</article></body>`);
    expect(detectArticle(doc, 'https://example.com/story')).toBeNull();
  });

  it('does not count navigation and comments toward the article', () => {
    const links = Array.from({ length: 900 }, (_, i) => `<a href="/${i}">Link ${i}</a>`).join(' ');
    const doc = docFrom(
      `<body><div class="sidebar menu">${links}</div><article class="post">${prose(300)}</article></body>`,
    );
    expect(detectArticle(doc, 'https://example.com/story')).toBeNull();
  });

  it('never flags a search results page', () => {
    const doc = docFrom(`<body><article>${prose(1500)}</article></body>`);
    expect(detectArticle(doc, 'https://www.google.com/search?q=debate')).toBeNull();
  });

  it('leaves the page itself untouched', () => {
    const doc = docFrom(`<body><nav class="nav">Menu</nav><article class="post">${prose(1200)}</article></body>`);
    const before = doc.body.innerHTML;
    detectArticle(doc, 'https://example.com/story');
    expect(doc.body.innerHTML).toBe(before);
  });
});
