import { describe, expect, it } from 'vitest';

import { buildSavedArticleDocument } from '@/src/article/document';

describe('buildSavedArticleDocument', () => {
  const article = {
    title: 'Carbon taxes & growth',
    cite: 'Doe, "Carbon taxes & growth," Example News, 2026',
    url: 'https://example.com/carbon',
    html: '<p>The body.</p>',
  };

  it('stores the title, citation, link and body as an HTML document', () => {
    const doc = buildSavedArticleDocument(article);
    expect(doc.format).toBe('html');
    expect(doc.title).toBe('Carbon taxes & growth');
    expect(doc.content).toContain('<h1>Carbon taxes &amp; growth</h1>');
    expect(doc.content).toContain('Doe, &quot;Carbon taxes &amp; growth,&quot;');
    expect(doc.content).toContain('<a href="https://example.com/carbon">');
    expect(doc.content).toContain('<p>The body.</p>');
    expect(doc.content).not.toContain('Notes from the article panel');
  });

  it('includes the panel Q&A, escaped', () => {
    const doc = buildSavedArticleDocument(article, [
      { role: 'user', content: 'Is <b>this</b> true?', time: '' },
      { role: 'assistant', content: '**Yes**, mostly.', time: '' },
    ]);
    expect(doc.content).toContain('Notes from the article panel');
    expect(doc.content).toContain('Q: Is &lt;b&gt;this&lt;/b&gt; true?');
    expect(doc.content).toContain('<strong>Yes</strong>, mostly.');
  });

  it('never links a non-web URL', () => {
    const doc = buildSavedArticleDocument({ ...article, url: 'javascript:alert(1)' });
    expect(doc.content).not.toContain('javascript:');
  });

  it('falls back to a title when the page had none', () => {
    expect(buildSavedArticleDocument({ html: '<p>x</p>' }).title).toBe('Saved article');
  });
});
