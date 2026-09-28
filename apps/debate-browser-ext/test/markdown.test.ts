import { describe, expect, it } from 'vitest';

import { escapeHtml, renderMarkdown } from '@/src/ai/markdown';

describe('renderMarkdown', () => {
  it('renders the shapes a model answer actually uses', () => {
    const html = renderMarkdown('## Findings\n\n- **Cost** is the main objection\n- Timing is second\n\nSo the case turns on cost.');
    expect(html).toContain('<h3>Findings</h3>');
    expect(html).toContain('<li><strong>Cost</strong> is the main objection</li>');
    expect(html).toContain('<p>So the case turns on cost.</p>');
  });

  it('treats numbered lists as lists too', () => {
    expect(renderMarkdown('1. First point\n2. Second point')).toBe(
      '<ul><li>First point</li><li>Second point</li></ul>',
    );
  });

  it('renders emphasis and inline code', () => {
    expect(renderMarkdown('Use *care* with `--force`')).toBe(
      '<p>Use <em>care</em> with <code>--force</code></p>',
    );
  });

  it('cannot be made to emit a tag the model wrote', () => {
    // This is the whole reason the renderer exists: the answer has not been
    // through a server, and the panel injects the result as HTML.
    const html = renderMarkdown('<img src=x onerror="alert(1)"> and <script>alert(1)</script>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes inside the tags it does emit', () => {
    expect(renderMarkdown('**<b>bold</b>**')).toBe('<p><strong>&lt;b&gt;bold&lt;/b&gt;</strong></p>');
  });

  it('has nothing to render for nothing', () => {
    expect(renderMarkdown('')).toBe('');
    expect(renderMarkdown('   \n  ')).toBe('');
  });
});

describe('escapeHtml', () => {
  it('escapes every character that could start markup', () => {
    expect(escapeHtml(`<&>"'`)).toBe('&lt;&amp;&gt;&quot;&#39;');
  });
});
