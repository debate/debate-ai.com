/**
 * cardmirror-read — mirror mode.
 *
 * Watches one or more source folders and maintains a parallel tree of
 * plain-text renderings, so integrations that can only READ files (an
 * AI assistant's Dropbox connector, a screen-reader pipeline) always
 * have a current, legible copy without anyone running anything by
 * hand.
 *
 * Layout: with one source, the out-dir mirrors it directly; with
 * several, each source gets its own subfolder (by basename,
 * de-duplicated) so same-named files can't collide.
 *
 * No feedback loops are possible by construction: inputs are only
 * `.cmir`/`.docx`, outputs are only `.txt`.
 */

import {
  readdirSync,
  statSync,
  mkdirSync,
  writeFileSync,
  chmodSync,
  rmSync,
  existsSync,
  watch,
  readFileSync,
  type FSWatcher,
} from 'node:fs';
import { join, relative, dirname, extname, basename, resolve } from 'node:path';
import { parseToDoc, renderPlainText, type FileKind } from './cardmirror-read-lib.js';

const CONVERTIBLE = new Set(['.cmir', '.docx']);

export interface MirrorSource {
  /** Absolute source folder. */
  root: string;
  /** Subfolder of the out-dir this source mirrors into ('' = flat). */
  prefix: string;
}

/** Assign each source its out-dir subfolder: flat for a single source,
 *  basename (de-duplicated with numeric suffixes) for several. */
export function planSources(roots: string[]): MirrorSource[] {
  if (roots.length === 1) return [{ root: roots[0]!, prefix: '' }];
  const used = new Map<string, number>();
  return roots.map((root) => {
    const base = basename(root) || 'root';
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    return { root, prefix: n === 0 ? base : `${base}-${n + 1}` };
  });
}

/** Shadow path for a convertible source file, or null when the file
 *  isn't one we render. */
export function shadowPathFor(
  src: MirrorSource,
  outDir: string,
  filePath: string,
): string | null {
  const ext = extname(filePath).toLowerCase();
  if (!CONVERTIBLE.has(ext)) return null;
  const rel = relative(src.root, filePath);
  if (rel.startsWith('..')) return null; // outside the source tree
  const relTxt = rel.slice(0, rel.length - ext.length) + '.txt';
  return join(outDir, src.prefix, relTxt);
}

/** Skip Word owner/lock files and hidden files. */
function isRenderable(name: string): boolean {
  if (name.startsWith('.') || name.startsWith('~$')) return false;
  return CONVERTIBLE.has(extname(name).toLowerCase());
}

async function renderOne(filePath: string, target: string): Promise<void> {
  const ext = extname(filePath).toLowerCase();
  const kind: FileKind = ext === '.docx' ? 'docx' : 'cmir';
  const bytes = new Uint8Array(readFileSync(filePath));
  const doc = await parseToDoc(bytes, kind);
  const text = renderPlainText(doc, basename(filePath));
  mkdirSync(dirname(target), { recursive: true });
  if (existsSync(target)) chmodSync(target, 0o644); // our shadows are 444
  writeFileSync(target, text);
  chmodSync(target, 0o444);
}

function* walkFiles(dir: string): Generator<string> {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (ent.name.startsWith('.')) continue;
    const full = join(dir, ent.name);
    if (ent.isDirectory()) yield* walkFiles(full);
    else if (ent.isFile() && isRenderable(ent.name)) yield full;
  }
}

/** One pass over a source: render new/changed files (mtime newer than
 *  the shadow), remove orphaned shadows. Returns counts for logging. */
export async function sweepSource(
  src: MirrorSource,
  outDir: string,
  log: (line: string) => void,
): Promise<{ rendered: number; skipped: number; removed: number; failed: number }> {
  let rendered = 0;
  let skipped = 0;
  let removed = 0;
  let failed = 0;
  const liveShadows = new Set<string>();
  for (const file of walkFiles(src.root)) {
    const target = shadowPathFor(src, outDir, file);
    if (!target) continue;
    liveShadows.add(resolve(target));
    try {
      const srcM = statSync(file).mtimeMs;
      const outM = existsSync(target) ? statSync(target).mtimeMs : -1;
      if (outM >= srcM) {
        skipped++;
        continue;
      }
      await renderOne(file, target);
      rendered++;
      log(`rendered ${relative(src.root, file)}`);
    } catch (err) {
      failed++;
      log(`FAILED ${relative(src.root, file)}: ${err instanceof Error ? err.message : err}`);
    }
  }
  // Orphan removal, scoped to this source's shadow subtree.
  const shadowRoot = join(outDir, src.prefix);
  for (const shadow of walkTxt(shadowRoot)) {
    if (!liveShadows.has(resolve(shadow))) {
      try {
        chmodSync(shadow, 0o644);
        rmSync(shadow);
        removed++;
        log(`removed orphan ${relative(outDir, shadow)}`);
      } catch {
        /* ignore */
      }
    }
  }
  return { rendered, skipped, removed, failed };
}

function* walkTxt(dir: string): Generator<string> {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) yield* walkTxt(full);
    else if (ent.isFile() && ent.name.toLowerCase().endsWith('.txt')) yield full;
  }
}

/** Full mirror loop: initial sweep of every source, then recursive
 *  watches with a debounced re-sweep per source (Dropbox sync fires
 *  bursts of events; a per-source 1.5s coalesce keeps re-renders to
 *  one pass per burst — the mtime skip makes the pass cheap). */
export async function runMirror(roots: string[], outDir: string): Promise<never> {
  const sources = planSources(roots.map((r) => resolve(r)));
  const out = resolve(outDir);
  mkdirSync(out, { recursive: true });
  const log = (line: string): void => {
    process.stdout.write(`[${new Date().toISOString()}] ${line}\n`);
  };
  log(`mirroring ${sources.length} source(s) → ${out}`);
  for (const src of sources) {
    const r = await sweepSource(src, out, log);
    log(
      `${src.root}: ${r.rendered} rendered, ${r.skipped} current, ${r.removed} orphans removed` +
        (r.failed ? `, ${r.failed} FAILED` : ''),
    );
  }
  const watchers: FSWatcher[] = [];
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  for (const src of sources) {
    const schedule = (): void => {
      const prev = timers.get(src.root);
      if (prev) clearTimeout(prev);
      timers.set(
        src.root,
        setTimeout(() => {
          void sweepSource(src, out, log);
        }, 1500),
      );
    };
    try {
      watchers.push(watch(src.root, { recursive: true }, schedule));
      log(`watching ${src.root}`);
    } catch (err) {
      log(`WATCH FAILED for ${src.root} (${err instanceof Error ? err.message : err}) — falling back to 60s polling`);
      setInterval(schedule, 60_000);
    }
  }
  process.on('SIGINT', () => {
    for (const w of watchers) w.close();
    process.exit(0);
  });
  // Keep the process alive on the watchers.
  return new Promise<never>(() => {});
}
