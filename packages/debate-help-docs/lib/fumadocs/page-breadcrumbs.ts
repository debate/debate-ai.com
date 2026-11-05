/**
 * @file page-breadcrumbs.ts
 * @description The breadcrumb trail above each docs page's title
 * (`components/fumadocs/layout/docs-page-header.tsx`), worked out from the
 * page tree.
 *
 * One crumb per folder on the way to the page, then the page itself. Each
 * crumb also carries its siblings — everything at that level of the tree — so
 * hovering a crumb lists the other sections or pages it could be swapped for.
 */
import type { Folder, Node, Root } from 'fumadocs-core/page-tree';
import type { ReactNode } from 'react';

/** One entry of a crumb's dropdown. */
export interface BreadcrumbSibling {
  name: ReactNode;
  url: string;
  /** This entry is the crumb itself. */
  current: boolean;
}

export interface PageBreadcrumb {
  name: ReactNode;
  /** Where the crumb links; undefined for a folder with no pages. */
  url?: string;
  /** Everything at this crumb's level of the tree, the crumb included. */
  siblings: BreadcrumbSibling[];
}

/** The URL a folder opens: its index page, else its first page. */
export function folderUrl(folder: Folder): string | undefined {
  if (folder.index) return folder.index.url;
  for (const child of folder.children) {
    if (child.type === 'page') return child.url;
    if (child.type === 'folder') {
      const url = folderUrl(child);
      if (url) return url;
    }
  }
  return undefined;
}

/** The folders from the root down to the one holding `url`, or null when absent. */
function findPath(nodes: Node[], url: string, trail: Folder[]): { trail: Folder[]; node: Node } | null {
  for (const node of nodes) {
    if (node.type === 'page' && node.url === url) return { trail, node };
    if (node.type === 'folder') {
      if (node.index?.url === url) return { trail, node };
      const found = findPath(node.children, url, [...trail, node]);
      if (found) return found;
    }
  }
  return null;
}

/** The pages and folders among `nodes`, as dropdown entries; separators are left out. */
function siblingsOf(nodes: Node[], current: Node): BreadcrumbSibling[] {
  const out: BreadcrumbSibling[] = [];
  for (const node of nodes) {
    if (node.type === 'separator') continue;
    // A folder's index page is listed as the folder, not twice.
    const url = node.type === 'page' ? node.url : folderUrl(node);
    if (!url) continue;
    out.push({ name: node.name, url, current: node === current });
  }
  return out;
}

/**
 * The crumbs for the page at `url`: each folder on its path, then the page
 * (or, for a folder's index page, the folder itself last). Empty when the page
 * is not in the tree.
 */
export function getPageBreadcrumbs(tree: Root, url: string): PageBreadcrumb[] {
  const found = findPath(tree.children, url, []);
  if (!found) return [];

  const levels: { node: Node; parentChildren: Node[] }[] = [];
  let parentChildren: Node[] = tree.children;
  for (const folder of found.trail) {
    levels.push({ node: folder, parentChildren });
    parentChildren = folder.children;
  }
  levels.push({ node: found.node, parentChildren });

  return levels.map(({ node, parentChildren: nodes }) => ({
    name: node.name,
    url: node.type === 'page' ? node.url : node.type === 'folder' ? folderUrl(node) : undefined,
    siblings: siblingsOf(nodes, node),
  }));
}
