import { describe, expect, it } from 'vitest';

import { safeUrl, sanitizeArticleHtml } from '../src/article-html';

describe('sanitizeArticleHtml', () => {
  it('keeps reading tags and drops scripts, handlers, iframes and forms', () => {
    const result = sanitizeArticleHtml(
      '<div onclick="x()"><h2>Title</h2><p style="color:red">Body <b>bold</b></p><script>alert(1)</script><iframe src="https://evil.test"></iframe><form><input></form></div>',
      'https://example.org/post',
    )!;
    expect(result.html).toContain('<h2>Title</h2>');
    expect(result.html).toContain('<b>bold</b>');
    expect(result.html).not.toMatch(/script|onclick|iframe|form|style=|alert/);
    expect(result.wordCount).toBe(3);
  });

  it('makes links absolute, opens them safely and removes javascript: links', () => {
    const result = sanitizeArticleHtml(
      '<p><a href="/next">next</a> <a href="javascript:alert(1)">bad</a> <a href="data:text/html,x">data</a></p>',
      'https://example.org/post',
    )!;
    expect(result.html).toContain('href="https://example.org/next"');
    expect(result.html).toContain('rel="noopener noreferrer nofollow"');
    expect(result.html).toContain('target="_blank"');
    expect(result.html).not.toContain('javascript');
    expect(result.html).not.toContain('data:text');
  });

  it('keeps images with safe sources only', () => {
    const result = sanitizeArticleHtml(
      '<p>Text</p><img src="/a.png" alt="a" onerror="x()"><img src="javascript:x"><img src="data:image/png;base64,AAAA">',
      'https://example.org/post',
    )!;
    expect(result.html).toContain('src="https://example.org/a.png"');
    expect(result.html).toContain('data:image/png;base64,AAAA');
    expect(result.html).not.toMatch(/javascript|onerror/);
    expect(result.html.match(/<img/g)).toHaveLength(2);
  });

  it('is null when nothing readable remains', () => {
    expect(sanitizeArticleHtml('<script>x</script><div> </div>', 'https://example.org/')).toBeNull();
  });
});

describe('safeUrl', () => {
  it('resolves relative and refuses other schemes', () => {
    expect(safeUrl('a/b', 'https://x.test/c/')).toBe('https://x.test/c/a/b');
    expect(safeUrl('mailto:a@b.c', 'https://x.test/')).toBeNull();
    expect(safeUrl('', 'https://x.test/')).toBeNull();
  });
});
