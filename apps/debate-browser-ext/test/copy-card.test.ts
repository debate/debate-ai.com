import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildCardCopy, highlightedSpan, paragraphBlocks, writeCardToClipboard } from '@/src/reader/copy-card';

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

describe('buildCardCopy details', () => {
  it('puts the AI preface above the citation, with line breaks kept in the HTML', () => {
    const copy = buildCardCopy([], 'Cite line', '  Line one\nLine two <b>  ');
    expect(copy.text).toBe('Line one\nLine two <b>\n\nCite line');
    expect(copy.html).toBe('<div><p>Line one<br>Line two &lt;b&gt;</p>\n<p>Cite line</p></div>');
  });

  it('skips a blank preface and a blank citation', () => {
    expect(buildCardCopy([], '  ', '  ').text).toBe('');
  });

  it('drops images and media, and strips classes, ids, data attributes and keeps links', () => {
    document.body.innerHTML = `<p id="p1" class="x" data-k="1">See <a href="https://x.org" class="l">this</a>
      <img src="a.png"><svg></svg><picture><source></picture><ins>added</ins><mark>marked</mark></p>`;
    const copy = buildCardCopy([document.querySelector('p') as HTMLElement], '');
    expect(copy.html).toContain('<a href="https://x.org">this</a>');
    expect(copy.html).toContain('<span style="text-decoration:underline">added</span>');
    expect(copy.html).toContain('background-color:#ffff00');
    for (const gone of ['<img', '<svg', '<picture', 'class=', 'id=', 'data-k']) {
      expect(copy.html).not.toContain(gone);
    }
  });
});

describe('writeCardToClipboard', () => {
  const copy = { html: '<p>Hi</p>', text: 'Hi', paragraphCount: 1 };
  const write = vi.fn();
  const writeText = vi.fn();

  class FakeClipboardItem {
    constructor(public items: Record<string, Blob>) {}
  }

  beforeEach(() => {
    write.mockReset().mockResolvedValue(undefined);
    writeText.mockReset().mockResolvedValue(undefined);
    vi.stubGlobal('ClipboardItem', FakeClipboardItem);
    Object.defineProperty(navigator, 'clipboard', { value: { write, writeText }, configurable: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes both the HTML and plain versions when the browser can', async () => {
    await writeCardToClipboard(copy);
    expect(writeText).not.toHaveBeenCalled();
    const [[items]] = write.mock.calls;
    expect(Object.keys(items[0].items)).toEqual(['text/html', 'text/plain']);
    expect(await items[0].items['text/html'].text()).toBe('<p>Hi</p>');
    expect(await items[0].items['text/plain'].text()).toBe('Hi');
  });

  it('falls back to plain text when the rich write is refused', async () => {
    write.mockRejectedValue(new Error('NotAllowedError'));
    await writeCardToClipboard(copy);
    expect(writeText).toHaveBeenCalledWith('Hi');
  });

  it('writes plain text when there is no ClipboardItem', async () => {
    vi.stubGlobal('ClipboardItem', undefined);
    await writeCardToClipboard(copy);
    expect(write).not.toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledWith('Hi');
  });
});
