/**
 * @file git-last-modified.ts
 * @description Each docs file's last Git commit date, for fumadocs-mdx's
 * `lastModified` plugin (source.config.ts). The date is read once at build
 * time and compiled into the page module as `lastModified`, so the Worker
 * never needs Git at runtime. It is the date the file last changed on GitHub
 * (its newest commit), not the file's mtime, which every fresh checkout,
 * build and deploy resets.
 *
 * Same idea as the plugin's built-in `'git'` mode (one `git log` per
 * collection folder, newest commit per file wins), with one difference: a
 * shallow clone yields no dates at all. In a shallow checkout every file's
 * newest *visible* commit is the clone's boundary commit, so the built-in mode
 * would stamp every page with the build date. Returning nothing instead lets
 * the docs page fall back to the GitHub API, or hide the line.
 *
 * CI builds check out full history (`fetch-depth: 0` in
 * .github/workflows/cloudflare-workers-deploy.yml). Cloudflare Workers Builds,
 * which deploys production, clones shallow and has no such setting, so with
 * `deepen` the build first fetches the missing history itself: commits and
 * trees only (`--filter=blob:none`), a few seconds for this repository. If
 * that fetch fails (no network, no remote), the build carries on with no
 * dates. Builds without Git, or outside a repository, degrade the same way.
 */
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

/** Git output for a large docs history easily passes Node's 1 MB default. */
const MAX_BUFFER = 64 * 1024 * 1024;

/** Upper bound for deepening a shallow clone, so a hung fetch can't stall the build. */
const DEEPEN_TIMEOUT_MS = 3 * 60 * 1000;

async function git(cwd: string, args: string[], timeout = 0): Promise<string | undefined> {
  try {
    const { stdout } = await run('git', ['-c', 'core.quotepath=off', ...args], {
      cwd,
      maxBuffer: MAX_BUFFER,
      timeout,
    });
    return stdout;
  } catch {
    return undefined;
  }
}

/**
 * Parses `git log --format=commit:%aI --name-only` output into a map of
 * absolute file path → newest commit date. Exported for tests.
 */
export function parseGitLog(stdout: string, repoRoot: string): Map<string, Date> {
  const dates = new Map<string, Date>();
  let date: Date | undefined;
  for (const line of stdout.split('\n')) {
    if (line.startsWith('commit:')) {
      const parsed = new Date(line.slice('commit:'.length));
      date = Number.isNaN(parsed.getTime()) ? undefined : parsed;
    } else if (line.length > 0 && date) {
      const file = path.join(repoRoot, line);
      if (!dates.has(file)) dates.set(file, date);
    }
  }
  return dates;
}

/** One lookup per folder per build. */
const byDir = new Map<string, Promise<Map<string, Date>>>();

async function isShallow(dir: string): Promise<boolean> {
  return (await git(dir, ['rev-parse', '--is-shallow-repository']))?.trim() !== 'false';
}

/**
 * Turns a shallow clone into a full-history one (commits and trees, no file
 * contents). Returns whether the checkout now has full history.
 */
async function deepenHistory(dir: string): Promise<boolean> {
  console.info('[docs] Shallow Git checkout: fetching history for last-edit dates.');
  await git(dir, ['fetch', '--quiet', '--no-tags', '--unshallow', '--filter=blob:none'], DEEPEN_TIMEOUT_MS);
  return !(await isShallow(dir));
}

async function readDates(dir: string, deepen: boolean): Promise<Map<string, Date>> {
  const root = (await git(dir, ['rev-parse', '--show-toplevel']))?.trim();
  if (!root) return new Map();
  if ((await isShallow(dir)) && !(deepen && (await deepenHistory(dir)))) {
    console.warn(
      '[docs] Shallow or unreadable Git checkout: pages get no last-edit date from Git. ' +
        'Check out full history (fetch-depth: 0) to enable it.',
    );
    return new Map();
  }
  const log = await git(dir, ['log', '--format=commit:%aI', '--name-only', '--', dir]);
  return log ? parseGitLog(log, root) : new Map();
}

/**
 * Builds a `LastModifiedFn` for files under `dir`: the date of the newest
 * commit that touched the file, or `undefined` when unknown. With `deepen`,
 * a shallow clone is first given its full history (see the file header).
 */
export function gitLastModified(dir: string, { deepen = false }: { deepen?: boolean } = {}) {
  return async (filePath: string): Promise<Date | undefined> => {
    let pending = byDir.get(dir);
    if (!pending) {
      pending = readDates(dir, deepen);
      byDir.set(dir, pending);
    }
    return (await pending).get(path.resolve(filePath));
  };
}
