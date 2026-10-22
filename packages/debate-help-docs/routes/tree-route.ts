/**
 * @file tree-route.ts
 * @description The docs' page tree as plain JSON, mounted by the web app at
 * `app/docs/api/docs-tree/route.ts`. Off `/docs` the app sidebar lists every
 * docs page in a collapsed "Docs" section (`DocsNavTree` in @debate/videos),
 * which preloads this as soon as the sidebar mounts. Names are reduced to text
 * and icons dropped, since React nodes don't survive JSON.
 */
import { isValidElement, type ReactNode } from 'react';
import type { Node, Root } from 'fumadocs-core/page-tree';
import { source } from '../lib/fumadocs/source';

/** One row of the serialized tree; mirrors `DocsTreeNode` in @debate/videos. */
export type DocsTreeJsonNode =
  | { type: 'page'; name: string; url: string; external?: boolean }
  | { type: 'separator'; name: string }
  | { type: 'folder'; name: string; url?: string; children: DocsTreeJsonNode[] };

// it should be cached forever
export const revalidate = false;

export function GET() {
  return Response.json(serializeDocsTree(source.pageTree));
}

export function serializeDocsTree(tree: Root): DocsTreeJsonNode[] {
  return tree.children.map(serializeNode);
}

function serializeNode(node: Node): DocsTreeJsonNode {
  if (node.type === 'separator') return { type: 'separator', name: nodeText(node.name) };
  if (node.type === 'folder') {
    return {
      type: 'folder',
      name: nodeText(node.name),
      ...(node.index ? { url: node.index.url } : {}),
      children: node.children.map(serializeNode),
    };
  }
  return {
    type: 'page',
    name: nodeText(node.name),
    url: node.url,
    ...(node.external ? { external: true } : {}),
  };
}

/** The text of a tree name, which may be wrapped in an element (`<code>`). */
function nodeText(name: ReactNode): string {
  if (name == null || typeof name === 'boolean') return '';
  if (typeof name === 'string' || typeof name === 'number') return String(name);
  if (Array.isArray(name)) return name.map(nodeText).join('');
  if (isValidElement<{ children?: ReactNode }>(name)) return nodeText(name.props.children);
  return '';
}
