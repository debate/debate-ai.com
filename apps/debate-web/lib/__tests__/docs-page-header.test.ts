/**
 * The /docs page route must render DocsPageHeader (breadcrumbs + title):
 * remark-drop-title-heading removes a body `#` that repeats the title, so a
 * page without the header shows no title at all. A merge dropped it once.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const route = readFileSync(
  resolve(__dirname, '../../../../packages/debate-help-docs/routes/docs-page.tsx'),
  'utf8',
);

describe('docs page route', () => {
  it('renders the page title header above the content', () => {
    const header = route.indexOf('<DocsPageHeader');
    expect(header).toBeGreaterThan(-1);
    expect(route.slice(header, header + 200)).toContain('title={data.title}');
    // The header comes before the Copy / Ask AI toolbar and the MDX body.
    expect(header).toBeLessThan(route.indexOf('<LLMCopyButton'));
    expect(header).toBeLessThan(route.indexOf('<MDX '));
  });
});
