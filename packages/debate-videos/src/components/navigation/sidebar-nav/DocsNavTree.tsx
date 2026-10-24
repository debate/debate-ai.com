/**
 * @fileoverview The "Docs" section at the end of the sidebar tree: every help
 * docs page, as an ordinary section that scrolls with the rest of the column.
 * It starts collapsed, and its folders do too.
 *
 * The page tree belongs to the help docs (`@debate-ai/help-docs`), which this
 * package does not import: the app serves it as JSON at
 * {@link DOCS_TREE_URL}, and the section fetches it as soon as the sidebar
 * mounts, so the pages are already listed the first time it is opened. If
 * that request fails, opening the section tries again. Rows are full page
 * loads, since `/docs` renders outside the app's own layout.
 *
 * On `/docs` the docs layout portals its own, richer tree into the same spot
 * (`app-sidebar-docs-tree.tsx`), so this renders nothing there.
 *
 * @module components/sidebar-nav/DocsNavTree
 */

"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BookOpen } from "lucide-react";
import { TreeItem } from "./TreeItem";

/** Where the app serves the docs' page tree (`app/docs/api/docs-tree`). */
export const DOCS_TREE_URL = "/docs/api/docs-tree";
/** The docs' landing page, for the section heading's ctrl/middle-click. */
export const DOCS_HOME_URL = "/docs";

/** One row of the docs' page tree, as the app serves it. */
export type DocsTreeNode =
  | { type: "page"; name: string; url: string; external?: boolean }
  | { type: "separator"; name: string }
  | { type: "folder"; name: string; url?: string; children: DocsTreeNode[] };

/** Whether `pathname` is `/docs` or a page under it. */
export function isDocsRoute(pathname: string | null | undefined): boolean {
  return pathname === DOCS_HOME_URL || (pathname?.startsWith(`${DOCS_HOME_URL}/`) ?? false);
}

let treeRequest: Promise<DocsTreeNode[]> | null = null;

/** Fetches the docs tree once per page load; a failed request may be retried. */
function loadDocsTree(): Promise<DocsTreeNode[]> {
  treeRequest ??= fetch(DOCS_TREE_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`docs tree: HTTP ${response.status}`);
      return response.json() as Promise<DocsTreeNode[]>;
    })
    .catch((error: unknown) => {
      treeRequest = null;
      throw error;
    });
  return treeRequest;
}

export function DocsNavTree() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const [tree, setTree] = useState<DocsTreeNode[] | null>(null);
  const [failed, setFailed] = useState(false);
  const onDocs = isDocsRoute(pathname);

  // Preload while collapsed; a failed preload is retried when the section opens.
  useEffect(() => {
    if (onDocs || tree || (failed && !expanded)) return;
    let cancelled = false;
    setFailed(false);
    loadDocsTree().then(
      (nodes) => !cancelled && setTree(nodes),
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
    };
    // `failed` is left out on purpose: clearing it must not start another request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDocs, expanded, tree]);

  if (onDocs) return null;

  return (
    <TreeItem
      level={1}
      title="Docs"
      icon={BookOpen}
      sectionHref={DOCS_HOME_URL}
      expanded={expanded}
      onToggleExpand={() => setExpanded((value) => !value)}
    >
      {tree ? (
        tree.map((node, i) => <DocsTreeRow key={`${node.type}:${node.name}:${i}`} node={node} />)
      ) : (
        <p className="px-2 py-1.5 text-xs text-muted-foreground">
          {failed ? "Couldn't load the docs." : "Loading…"}
        </p>
      )}
    </TreeItem>
  );
}

function DocsTreeRow({ node }: { node: DocsTreeNode }) {
  if (node.type === "separator") {
    return node.name ? (
      <p className="px-2 pb-0.5 pt-2 text-xs font-medium text-muted-foreground">{node.name}</p>
    ) : null;
  }
  if (node.type === "folder") return <DocsFolderRow folder={node} />;
  return <TreeItem level={3} href={node.url} title={node.name} reloadDocument />;
}

function DocsFolderRow({ folder }: { folder: Extract<DocsTreeNode, { type: "folder" }> }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <TreeItem
      level={2}
      href={folder.url}
      title={folder.name}
      reloadDocument
      expanded={expanded}
      onToggleExpand={() => setExpanded((value) => !value)}
    >
      {folder.children.map((node, i) => (
        <DocsTreeRow key={`${node.type}:${node.name}:${i}`} node={node} />
      ))}
    </TreeItem>
  );
}
