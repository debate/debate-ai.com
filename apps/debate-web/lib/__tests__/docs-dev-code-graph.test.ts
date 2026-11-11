/**
 * The developer docs' package code graphs (/docs/dev/packages/<dir>): the
 * build-time scanner in packages/debate-help-docs/lib/code-graph, and one page
 * per package with both views on it.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeFile } from '../../../../packages/debate-help-docs/lib/code-graph/analyze';
import {
  listCodeGraphPackages,
  scanPackage,
  type FileTreeNode,
} from '../../../../packages/debate-help-docs/lib/code-graph';

const packagesRoot = resolve(__dirname, '../../../../packages');
const pagesDir = resolve(packagesRoot, 'debate-help-docs/dev-docs/packages');

function files(nodes: FileTreeNode[]): FileTreeNode[] {
  return nodes.flatMap((n) => (n.type === 'file' ? [n] : files(n.children ?? [])));
}

describe('code graph analyser', () => {
  it('reads imports, exports, JSDoc and lines from TSX', () => {
    const source = [
      "import { useState } from 'react';",
      "import { helper, type Shape } from './helper';",
      '',
      '/** Renders the panel. */',
      'export function Panel(props: { title: string }) {',
      '  return <div>{props.title}</div>;',
      '}',
      '',
      'function local() {}',
      '',
      '/** A shape. */',
      'export interface Box { width: number; label?: string }',
      '',
      '/** Most boxes per row. */',
      'export const MAX_BOXES = 3;',
    ].join('\n');

    const analysis = analyzeFile('panel.tsx', source);
    expect(analysis?.npmImports).toEqual(['react']);
    expect(analysis?.localImports).toEqual(['./helper']);
    expect(analysis?.localImportSymbols).toEqual([
      { source: './helper', valueNames: ['helper'], typeNames: ['Shape'] },
    ]);

    const panel = analysis?.exports.find((e) => e.name === 'Panel');
    expect(panel).toMatchObject({ kind: 'function', line: 5, jsdoc: 'Renders the panel.' });
    expect(panel?.signature).toContain('Panel(props: { title: string })');

    expect(analysis?.functions.map((f) => f.name)).toEqual(['local']);
    const box = analysis?.exports.find((e) => e.name === 'Box');
    expect(box?.properties).toEqual([
      { name: 'width', type: 'number', required: true },
      { name: 'label', type: 'string', required: false },
    ]);
    expect(analysis?.exports.find((e) => e.name === 'MAX_BOXES')).toMatchObject({
      kind: 'constant',
      line: 15,
      jsdoc: 'Most boxes per row.',
    });
  });

  it('skips files it cannot parse', () => {
    expect(analyzeFile('broken.ts', 'export const = ;')).toBeUndefined();
    expect(analyzeFile('notes.md', '# hi')).toBeUndefined();
  });
});

describe('dev docs package pages', () => {
  const packages = listCodeGraphPackages(packagesRoot);

  it('covers the @debate-ai packages and leaves out upstream submodules', () => {
    const dirs = packages.map((p) => p.dir);
    expect(dirs).toContain('debate-round');
    expect(dirs).toContain('debate-webview');
    for (const submodule of ['debate-editor-cm', 'debate-tournaments-tabroom', 'debate-rankings-sync-data']) {
      expect(dirs).not.toContain(submodule);
    }
  });

  it('has one page per package, showing its dependency graph and file tree', () => {
    for (const { dir } of packages) {
      const page = resolve(pagesDir, `${dir}.mdx`);
      expect(existsSync(page), `dev-docs/packages/${dir}.mdx`).toBe(true);
      const body = readFileSync(page, 'utf8');
      expect(body).toContain(`<DependencyGraph package="${dir}" />`);
      expect(body).toContain(`<FileTreeView package="${dir}" />`);
    }
    const pages = readdirSync(pagesDir)
      .filter((f) => f.endsWith('.mdx') && f !== 'index.mdx')
      .map((f) => f.replace(/\.mdx$/, ''));
    expect(pages.sort()).toEqual(packages.map((p) => p.dir).sort());
  });

  it('scans a package into files with their analysis', () => {
    const tree = files(scanPackage(packagesRoot, 'debate-reading-mode'));
    expect(tree.length).toBeGreaterThan(0);
    expect(tree.some((f) => f.analysis && f.analysis.exports.length > 0)).toBe(true);
    // Tests are left out of the graph.
    expect(tree.some((f) => f.path.startsWith('test/'))).toBe(false);
  });
});
