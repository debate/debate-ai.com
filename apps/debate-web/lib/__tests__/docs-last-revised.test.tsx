/**
 * The docs last-edit date: the Git log parser behind the fumadocs-mdx
 * lastModified plugin and the shallow-clone guard. The date feeds the page Info
 * button; no page shows a "Last revised" line at the bottom.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  gitLastModified,
  parseGitLog,
} from '../../../../packages/debate-help-docs/lib/mdx/git-last-modified';

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

  it('with deepen, fetches the history of a shallow clone and dates each file by its own last commit', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'git-last-modified-'));
    try {
      const origin = join(tmp, 'origin');
      const git = (cwd: string, args: string[], date?: string) =>
        execFileSync('git', args, {
          cwd,
          env: {
            ...process.env,
            GIT_AUTHOR_NAME: 't',
            GIT_AUTHOR_EMAIL: 't@example.com',
            GIT_COMMITTER_NAME: 't',
            GIT_COMMITTER_EMAIL: 't@example.com',
            ...(date ? { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : {}),
          },
        });
      execFileSync('git', ['init', '-q', origin]);
      writeFileSync(join(origin, 'old.mdx'), 'old');
      git(origin, ['add', '.']);
      git(origin, ['commit', '-q', '-m', 'old'], '2026-01-02T03:04:05+00:00');
      writeFileSync(join(origin, 'new.mdx'), 'new');
      git(origin, ['add', '.']);
      git(origin, ['commit', '-q', '-m', 'new'], '2026-11-20T00:00:00+00:00');

      const clone = join(tmp, 'clone');
      execFileSync('git', ['clone', '-q', '--depth', '1', `file://${origin}`, clone]);
      expect(git(clone, ['rev-parse', '--is-shallow-repository']).toString().trim()).toBe('true');

      const lastModified = gitLastModified(clone, { deepen: true });
      expect((await lastModified(join(clone, 'old.mdx')))?.toISOString()).toBe('2026-01-02T03:04:05.000Z');
      expect((await lastModified(join(clone, 'new.mdx')))?.toISOString()).toBe('2026-11-20T00:00:00.000Z');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('returns undefined for a file Git has never seen', async () => {
    expect(await gitLastModified(docsPkg)(resolve(docsPkg, 'no-such-file.mdx'))).toBeUndefined();
  });
});

describe('docs routes', () => {
  for (const file of ['docs-page.tsx', 'dev-docs-page.tsx']) {
    it(`${file} shows no "Last revised" line at the bottom`, () => {
      const route = readFileSync(resolve(docsPkg, 'routes', file), 'utf8');
      expect(route).not.toMatch(/LastRevised|Last revised/);
    });
  }

  it('docs-page.tsx leaves the last-edit date off the Synergy-style papers', () => {
    const route = readFileSync(resolve(docsPkg, 'routes', 'docs-page.tsx'), 'utf8');
    expect(route).toMatch(/const lastEdited = synergySlayer\s*\?\s*undefined/);
  });

  it('blog posts show no "Last revised" line after the post', () => {
    const route = readFileSync(resolve(docsPkg, '../../apps/debate-web/app/blog/[slug]/page.tsx'), 'utf8');
    expect(route).not.toMatch(/LastRevised|Last revised/);
  });

  it('source.config.ts enables the lastModified plugin', () => {
    const config = readFileSync(resolve(docsPkg, 'source.config.ts'), 'utf8');
    expect(config).toContain("from 'fumadocs-mdx/plugins/last-modified'");
    expect(config).toMatch(/plugins:\s*\[\s*lastModified\(/);
  });
});
