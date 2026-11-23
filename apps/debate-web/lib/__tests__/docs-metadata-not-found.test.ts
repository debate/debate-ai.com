/**
 * A /docs URL with no page must not throw from generateMetadata. The page
 * component already calls notFound() and serves the 404; a throw in
 * generateMetadata as well is recorded by vinext's tracer as an error span
 * ("generateMetadata /docs/(pages)/[[...slug]]/page ERROR NEXT_NOT_FOUND"),
 * which filled Workers observability with errors for ordinary 404s.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const routes = resolve(__dirname, '../../../../packages/debate-help-docs/routes');

function generateMetadataBody(file: string): string {
  const source = readFileSync(resolve(routes, file), 'utf8');
  const start = source.indexOf('export async function generateMetadata');
  expect(start).toBeGreaterThan(-1);
  return source.slice(start);
}

describe.each(['docs-page.tsx', 'dev-docs-page.tsx'])('%s generateMetadata', (file) => {
  it('returns not-found metadata instead of throwing notFound()', () => {
    const body = generateMetadataBody(file);
    expect(body).not.toMatch(/notFound\(\)\s*;/);
    expect(body).toMatch(/if \(!page\) return /);
  });

  it('still 404s from the page component', () => {
    const source = readFileSync(resolve(routes, file), 'utf8');
    const page = source.slice(source.indexOf('export default'), source.indexOf('export async function generateMetadata'));
    expect(page).toContain('notFound();');
  });
});
