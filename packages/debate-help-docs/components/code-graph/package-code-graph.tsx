'use client';
/// <reference path="./virtual-code-graph.d.ts" />

/**
 * @file package-code-graph.tsx
 * @description The two code-tree-graph views for one workspace package, used
 * on the developer docs' package pages (`dev-docs/packages/<dir>.mdx`):
 *
 * - `<DependencyGraph package="debate-round" />`: the Mermaid C4 graph of the
 *   package's files and local imports, with pan/zoom, search and toggles for
 *   npm, type, private and exported nodes.
 * - `<FileTreeView package="debate-round" />`: the searchable file table with
 *   each file's imports, types and exports, linked to GitHub.
 *
 * Same names and views as code-tree-graph's server components, but the tree
 * comes from the build (`devDocsCodeGraph` in `vite.mjs`), since the Worker
 * has no filesystem to scan at request time. Both views on a page share one
 * fetch of the package's tree.
 */
import { useEffect, useState } from 'react';
import { codeGraphLoaders } from 'virtual:debate-code-graph';
import type { FileTreeNode } from '../../lib/code-graph/types';
import { DependencyGraphClient } from './graph/dependency-graph-client';
import type { FileInfo } from './graph/dependency-graph-shared';
import { FileTreeTable } from './tree/filetree-table';

const GITHUB_PACKAGES = 'https://github.com/debate/debate-ai.com/blob/master/packages';

const trees = new Map<string, Promise<FileTreeNode[]>>();

/** The package's tree, loaded once per page however many views ask. */
function loadTree(dir: string): Promise<FileTreeNode[]> {
  let tree = trees.get(dir);
  if (!tree) {
    const load = codeGraphLoaders[dir];
    tree = load ? load().then((m) => m.default as FileTreeNode[]) : Promise.reject(new Error(`No code graph for "${dir}"`));
    trees.set(dir, tree);
  }
  return tree;
}

type TreeState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; tree: FileTreeNode[] };

function usePackageTree(dir: string): TreeState {
  const [state, setState] = useState<TreeState>({ status: 'loading' });
  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    loadTree(dir).then(
      (tree) => !cancelled && setState({ status: 'ready', tree }),
      () => !cancelled && setState({ status: 'error' }),
    );
    return () => {
      cancelled = true;
    };
  }, [dir]);
  return state;
}

/** Graph nodes: every file in the tree, grouped by its top-level folder. */
function collectFiles(nodes: FileTreeNode[], result: FileInfo[] = []): FileInfo[] {
  for (const node of nodes) {
    if (node.type === 'file') {
      result.push({
        path: node.path,
        name: node.name,
        id: node.path.replace(/[^a-zA-Z0-9]/g, '_'),
        pkg: node.path.includes('/') ? node.path.split('/')[0] : 'root',
        description: node.description,
        analysis: node.analysis,
      });
    }
    if (node.children) collectFiles(node.children, result);
  }
  return result;
}

function Placeholder({ state, what }: { state: Exclude<TreeState, { status: 'ready' }>; what: string }) {
  return (
    <div className="not-prose rounded-lg border bg-fd-card px-4 py-6 text-center text-sm text-fd-muted-foreground">
      {state.status === 'loading' ? `Loading the ${what}…` : `Couldn't load the ${what}.`}
    </div>
  );
}

const HELP = (
  <ul className="m-0 list-none space-y-2 p-0">
    <li>Boxes are the package's files, grouped by folder; arrows are local imports.</li>
    <li>
      Toggle <strong>External</strong>, <strong>Types</strong>, <strong>Private</strong> and{' '}
      <strong>Exported</strong> to add npm packages, type declarations and functions as nodes.
    </li>
    <li>
      Drag to pan, hold <code>Ctrl</code> and scroll to zoom. Hover a node for its description and
      exports; click it to jump to that file in the file tree below.
    </li>
  </ul>
);

/** Dependency graph of one package's files (code-tree-graph's `DependencyGraph`). */
export function DependencyGraph({ package: dir }: { package: string }) {
  const state = usePackageTree(dir);
  if (state.status !== 'ready') return <Placeholder state={state} what="dependency graph" />;
  return (
    <div className="not-prose">
      <DependencyGraphClient
        files={collectFiles(state.tree)}
        showLegend
        initialOptions={{
          showNpmImports: false,
          showTypes: false,
          showPrivateFunctions: false,
          showExportedFunctions: false,
        }}
        helpContent={HELP}
      />
    </div>
  );
}

/** Searchable file table of one package (code-tree-graph's `FileTreeView`). */
export function FileTreeView({ package: dir }: { package: string }) {
  const state = usePackageTree(dir);
  if (state.status !== 'ready') return <Placeholder state={state} what="file tree" />;
  return (
    <div className="not-prose">
      <FileTreeTable tree={state.tree} ghBase={`${GITHUB_PACKAGES}/${dir}`} defaultExportFilter="all" />
    </div>
  );
}
