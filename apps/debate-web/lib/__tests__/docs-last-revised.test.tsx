/**
 * "Last revised: <date>" on docs pages: the Git log parser behind the
 * fumadocs-mdx lastModified plugin, the shallow-clone guard, the rendered
 * line, and both page routes wiring it in.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  gitLastModified,
  parseGitLog,
} from '../../../../packages/debate-help-docs/lib/mdx/git-last-modified';
import { LastRevised } from '../../../../packages/debate-help-docs/components/fumadocs/layout/last-revised';

const docsPkg = resolve(__dirname, '../../../../packages/debate-help-docs');

describe('parseGitLog', () => {
  it('keeps the newest commit per file and resolves paths from the repo root', () => {
    const log = [
      'commit:2026-11-10T12:00:00+00:00',
      '',
      'packages/debate-help-docs/content/docs/a.mdx',
      '',
      'commit:2026-10-01T08:30:00-04:00',
      '',
      'packages/debate-help-docs/content/docs/a.mdx',
      'packages/debate-help-docs/content/docs/b.mdx',
      '',
    ].join('\n');
    const dates = parseGitLog(log, '/repo');
    expect(dates.get('/repo/packages/debate-help-docs/content/docs/a.mdx')?.toISOString()).toBe(
      '2026-11-10T12:00:00.000Z',
    );
    expect(dates.get('/repo/packages/debate-help-docs/content/docs/b.mdx')?.toISOString()).toBe(
      '2026-10-01T12:30:00.000Z',
    );
  });

  it('skips files under an unparseable commit date', () => {
    const dates = parseGitLog('commit:not-a-date\nx.mdx\n', '/repo');
    expect(dates.size).toBe(0);
  });
});

describe('gitLastModified', () => {
  it('returns a date only in a full-history checkout', async () => {
    const shallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: docsPkg })
      .toString()
      .trim();
    const date = await gitLastModified(docsPkg)(resolve(docsPkg, 'source.config.ts'));
    if (shallow === 'true') expect(date).toBeUndefined();
    else expect(date).toBeInstanceOf(Date);
  });

  it('returns undefined for a file Git has never seen', async () => {
    expect(await gitLastModified(docsPkg)(resolve(docsPkg, 'no-such-file.mdx'))).toBeUndefined();
  });
});

describe('LastRevised', () => {
  it('renders the label with a machine-readable date', () => {
    const html = renderToStaticMarkup(<LastRevised date={new Date('2026-11-14T23:00:00Z')} />);
    expect(html).toContain('Last revised:');
    expect(html).toContain('<time dateTime="2026-11-14T23:00:00.000Z">November 14, 2026</time>');
  });

  it('renders nothing without a valid date', () => {
    expect(renderToStaticMarkup(<LastRevised date={undefined} />)).toBe('');
    expect(renderToStaticMarkup(<LastRevised date="garbage" />)).toBe('');
  });
});

describe('docs routes', () => {
  for (const file of ['docs-page.tsx', 'dev-docs-page.tsx']) {
    it(`${file} renders the last revised line from the loaded page`, () => {
      const route = readFileSync(resolve(docsPkg, 'routes', file), 'utf8');
      expect(route).toContain('<LastRevised date={lastRevised} />');
      expect(route).toMatch(/lastModified/);
    });
  }

  it('docs-page.tsx puts the line at the bottom of Synergy Slayer papers, top elsewhere', () => {
    const route = readFileSync(resolve(docsPkg, 'routes', 'docs-page.tsx'), 'utf8');
    expect(route).toContain('{!synergySlayer && <LastRevised date={lastRevised} />}');
    const paper = route.indexOf('<div className={SYNERGY_SLAYER_CLASS}>');
    const mdx = route.indexOf('<MDX', paper);
    const bottom = route.indexOf('<LastRevised date={lastRevised} />', paper);
    expect(paper).toBeGreaterThan(-1);
    expect(bottom).toBeGreaterThan(mdx);
  });

  it('source.config.ts enables the lastModified plugin', () => {
    const config = readFileSync(resolve(docsPkg, 'source.config.ts'), 'utf8');
    expect(config).toContain("from 'fumadocs-mdx/plugins/last-modified'");
    expect(config).toMatch(/plugins:\s*\[\s*lastModified\(/);
  });
});
