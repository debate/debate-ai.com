/**
 * @file collect-authors.ts
 * @description Reads the docs folders that have a `references.mdx` from disk
 * and builds the authors dataset from them. Node only (it uses `node:fs`);
 * `extract-authors.ts` holds the parsing, which needs no file system.
 *
 * A folder's pages are listed in the order its `meta.json` gives, so the
 * "cited in" links of a card read in the order of the paper.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractAuthorsDataset, type CollectionSource } from './extract-authors';
import type { AuthorsDataset } from './types';

const DOCS_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'content', 'docs');
const REFERENCES_FILE = 'references.mdx';

function frontmatterTitle(source: string, fallback: string): string {
  const raw = /^---\r?\n[\s\S]*?\btitle:\s*(.+?)\s*\r?\n[\s\S]*?---/.exec(source)?.[1] ?? '';
  const title = raw.replace(/^(["'])(.*)\1$/, '$2').trim();
  return title || fallback;
}

function findReferenceFolders(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      if (!statSync(path).isDirectory()) continue;
      if (existsSync(join(path, REFERENCES_FILE))) found.push(path);
      walk(path);
    }
  };
  walk(root);
  return found;
}

function pageOrder(folder: string): string[] {
  const names = new Set(
    readdirSync(folder)
      .filter((file) => /\.mdx?$/.test(file))
      .map((file) => file.replace(/\.mdx?$/, '')),
  );
  let listed: string[] = [];
  try {
    const meta = JSON.parse(readFileSync(join(folder, 'meta.json'), 'utf8')) as { pages?: string[] };
    listed = (meta.pages ?? []).filter((page) => names.has(page));
  } catch {
    listed = [];
  }
  const rest = [...names].filter((name) => !listed.includes(name)).sort();
  return [...listed, ...rest].filter((name) => name !== 'references');
}

/** The URL path of a docs page: `index` stands for its folder. */
function pagePath(dir: string, name: string): string {
  return name === 'index' ? `/docs/${dir}` : `/docs/${dir}/${name}`;
}

/** Every folder with a References page, read from `content/docs`. */
export function collectCollections(root = DOCS_ROOT): CollectionSource[] {
  return findReferenceFolders(root).map((folder) => {
    const dir = relative(root, folder).split('\\').join('/');
    const source = (name: string) => {
      const file = ['.mdx', '.md'].map((ext) => join(folder, `${name}${ext}`)).find((candidate) => existsSync(candidate));
      return file ? readFileSync(file, 'utf8') : '';
    };
    const indexSource = source('index');
    const pages = pageOrder(folder).map((name) => {
      const text = source(name);
      return { path: pagePath(dir, name), title: frontmatterTitle(text, name), source: text };
    });
    return {
      dir,
      title: frontmatterTitle(indexSource, dir),
      referencesSource: readFileSync(join(folder, REFERENCES_FILE), 'utf8'),
      pages,
    };
  });
}

/** The authors dataset of the docs on disk. */
export function buildAuthorsDataset(root = DOCS_ROOT): AuthorsDataset {
  return extractAuthorsDataset(collectCollections(root));
}
