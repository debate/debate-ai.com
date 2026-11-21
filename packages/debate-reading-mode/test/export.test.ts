import { describe, expect, it } from 'vitest';

import { exportFileName, exportableHtml, htmlToMarkdown, standaloneHtmlDocument } from '../src/export';

function rootOf(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

describe('htmlToMarkdown', () => {
  it('keeps headings, emphasis, highlights and underlining', () => {
    const root = rootOf(
      '<h2>Kant <button>copy</button></h2><p>The <strong>categorical</strong> imperative is <mark>universal</mark> and <u>binding</u>.</p>',
    );
    expect(htmlToMarkdown(root)).toBe('## Kant\n\nThe **categorical** imperative is ==universal== and <u>binding</u>.\n');
  });

  it('writes lists, nested lists and links', () => {
    const root = rootOf(
      '<ul><li>One <a href="https://example.com/a">link</a></li><li>Two<ol><li>Inner</li></ol></li></ul>',
    );
    expect(htmlToMarkdown(root)).toBe('- One [link](https://example.com/a)\n- Two\n  1. Inner\n');
  });

  it('turns loose inline text in a div into a paragraph and drops icons', () => {
    const root = rootOf('<div><svg></svg>Loose <em>text</em></div><hr><p>After</p>');
    expect(htmlToMarkdown(root)).toBe('Loose *text*\n\n---\n\nAfter\n');
  });

  it('writes tables', () => {
    const root = rootOf('<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>');
    expect(htmlToMarkdown(root)).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |\n');
  });

  it('adds the title as a heading when the text has none', () => {
    expect(htmlToMarkdown(rootOf('<p>Body</p>'), 'Synergy Slayer')).toBe('# Synergy Slayer\n\nBody\n');
  });

  it('escapes Markdown characters in text', () => {
    expect(htmlToMarkdown(rootOf('<p>a_b *c*</p>'))).toBe('a\\_b \\*c\\*\n');
  });
});

describe('exportableHtml', () => {
  it('strips controls and makes links absolute, without touching the page', () => {
    const root = rootOf('<p>Hi <button>x</button><a href="/docs/x">x</a> <a href="#top">top</a></p>');
    const html = exportableHtml(root);
    expect(html).not.toContain('<button');
    expect(html).toContain(`href="${new URL('/docs/x', location.href).href}"`);
    expect(html).not.toContain('#top');
    expect(root.querySelector('button')).not.toBeNull();
  });
});

describe('standaloneHtmlDocument', () => {
  it('titles the document and escapes the title', () => {
    const doc = standaloneHtmlDocument('A & B', '<p>x</p>');
    expect(doc).toContain('<title>A &amp; B</title>');
    expect(doc).toContain('<h1>A &amp; B</h1>');
    expect(doc).toContain('<p>x</p>');
  });
});

describe('exportFileName', () => {
  it('slugs the title', () => {
    expect(exportFileName('Synergy Slayer of Critiques: Nietzsche', 'md')).toBe('synergy-slayer-of-critiques-nietzsche.md');
    expect(exportFileName('!!!', 'pdf')).toBe('document.pdf');
  });
});
