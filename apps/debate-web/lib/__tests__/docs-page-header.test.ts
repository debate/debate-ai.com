/**
 * The /docs page route must render DocsPageHeader (the title; the breadcrumbs are hidden):
 * remark-drop-title-heading removes a body `#` that repeats the title, so a
 * page without the header shows no title at all. A merge dropped it once.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DocsPageHeader } from '../../../../packages/debate-help-docs/components/fumadocs/layout/docs-page-header';

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

  it('shows the Navigation button in the page toolbar', () => {
    expect(route).toContain('<PageNavigationMenu breadcrumbs={breadcrumbs} outline={toc} />');
  });
});

describe('dev docs page route', () => {
  it('shows the Navigation button too', () => {
    const dev = readFileSync(
      resolve(__dirname, '../../../../packages/debate-help-docs/routes/dev-docs-page.tsx'),
      'utf8',
    );
    expect(dev).toContain('<PageNavigationMenu breadcrumbs={breadcrumbs} outline={toc} />');
    expect(dev).toContain('getPageBreadcrumbs(devSource.pageTree');
  });
});

describe('DocsPageHeader', () => {
  it('renders the title without the breadcrumb trail', () => {
    const html = renderToStaticMarkup(
      createElement(DocsPageHeader, {
        title: 'Page title',
        breadcrumbs: [{ name: 'Section', url: '/docs/section', siblings: [] }],
      }),
    );
    expect(html).toContain('Page title');
    expect(html).not.toContain('Breadcrumb');
    expect(html).not.toContain('Section');
  });
});
