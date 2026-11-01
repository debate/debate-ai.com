import { beforeEach, describe, expect, it } from 'vitest';

import { buildCardCopy, highlightedSpan, paragraphBlocks } from '@/src/reader/copy-card';

let root: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = `
    <div id="article-content">
      <p>Intro with no marks.</p>
      <p>First <mark class="reader-highlight" data-highlight-id="h1">highlighted</mark> line.</p>
      <p>Middle paragraph, plain.</p>
      <ul><li>Item with <u>underlined</u> words.</li></ul>
      <p>Trailing plain paragraph.</p>
    </div>`;
  root = document.getElementById('article-content')!;
});

describe('highlightedSpan', () => {
  it('runs from the first highlight to the last highlight or underline', () => {
    const texts = highlightedSpan(root).map((el) => el.textContent?.trim());
    expect(texts).toEqual([
      'First highlighted line.',
      'Middle paragraph, plain.',
      'Item with underlined words.',
    ]);
  });

  it('is empty when nothing is highlighted', () => {
    root.querySelector('mark')!.replaceWith('plain');
    expect(highlightedSpan(root)).toEqual([]);
  });

  it('starts at a highlight even when an underline comes earlier', () => {
    root.querySelector('p')!.innerHTML = 'Early <u>underline</u>.';
    expect(highlightedSpan(root)[0].textContent).toContain('First');
  });
});

describe('buildCardCopy', () => {
  it('puts the citation first and keeps highlighting and underlining as inline styles', () => {
    const copy = buildCardCopy(highlightedSpan(root), 'Roe, Jane. "T." https://x.org');
    expect(copy.text.split('\n\n')).toEqual([
      'Roe, Jane. "T." https://x.org',
      'First highlighted line.',
      'Middle paragraph, plain.',
      'Item with underlined words.',
    ]);
    expect(copy.html.indexOf('Roe, Jane.')).toBeLessThan(copy.html.indexOf('First'));
    expect(copy.html).toContain('<span style="background-color:#ffff00;mso-highlight:yellow">highlighted</span>');
    expect(copy.html).toContain('<span style="text-decoration:underline">underlined</span>');
    expect(copy.html).not.toContain('data-highlight-id');
    expect(copy.html).not.toContain('reader-highlight');
    expect(copy.paragraphCount).toBe(3);
  });

  it('escapes the citation', () => {
    expect(buildCardCopy([], 'A <b> & C').html).toContain('A &lt;b&gt; &amp; C');
  });

  it('lists every paragraph for the whole-article copy', () => {
    expect(paragraphBlocks(root)).toHaveLength(5);
  });
});
