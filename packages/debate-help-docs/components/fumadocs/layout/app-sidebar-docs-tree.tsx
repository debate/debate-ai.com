'use client';

/**
 * @file app-sidebar-docs-tree.tsx
 * @description The docs' page tree as a section of the app's sidebar.
 *
 * The app has one sidebar on every view, /docs included (the web app's
 * `DocsAppChrome` puts it beside this layout). Fumadocs' own sidebar used to
 * sit next to it, so /docs showed two navigation columns. On desktop that
 * one is now hidden (`styles/docs.css`) and this renders the same page tree
 * into an empty slot the app's sidebar leaves for it, through a portal, so the
 * docs' navigation scrolls, resizes and hides with the rest of the column.
 * Below `md` the app's column is not drawn and Fumadocs' drawer stays the
 * docs' navigation.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, ChevronRight } from 'lucide-react';
import type { Folder, Node, Root } from 'fumadocs-core/page-tree';

/** Mirrors `DOCS_SIDEBAR_SLOT_ID` in debate-webview's `app-sidebar.tsx`. */
export const APP_SIDEBAR_DOCS_SLOT_ID = 'app-sidebar-docs-slot';

const ROW =
  'flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-foreground';

export function AppSidebarDocsTree({ tree }: { tree: Root }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(true);

  // The slot is in the app's sidebar, outside this layout's own tree, so it
  // is looked up once both have mounted.
  useEffect(() => {
    setSlot(document.getElementById(APP_SIDEBAR_DOCS_SLOT_ID));
  }, []);

  if (!slot) return null;

  return createPortal(
    <nav aria-label="Docs" className="flex flex-col gap-1 text-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={`${ROW} font-semibold`}
      >
        <BookOpen className="size-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate">Docs</span>
        <ChevronRight className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <ul className="ms-3 flex flex-col gap-0.5 border-s border-border/60 ps-2">
          {tree.children.map((node, i) => (
            <TreeNode key={node.$id ?? i} node={node} />
          ))}
        </ul>
      )}
    </nav>,
    slot,
  );
}

function TreeNode({ node }: { node: Node }) {
  const pathname = usePathname();

  if (node.type === 'separator') {
    return node.name ? (
      <li className="mt-3 px-2 pb-1 text-xs font-medium text-muted-foreground">{node.name}</li>
    ) : null;
  }

  if (node.type === 'folder') return <FolderNode folder={node} pathname={pathname} />;

  return (
    <li>
      <PageLink url={node.url} name={node.name} icon={node.icon} external={node.external} active={pathname === node.url} />
    </li>
  );
}

function FolderNode({ folder, pathname }: { folder: Folder; pathname: string | null }) {
  const containsActive = pathname != null && folderContains(folder, pathname);
  const [open, setOpen] = useState(containsActive || folder.defaultOpen === true);

  // Opening a page inside a closed folder opens it; nothing closes for you.
  useEffect(() => {
    if (containsActive) setOpen(true);
  }, [containsActive]);

  return (
    <li>
      <div className="flex items-center">
        {folder.index ? (
          <PageLink
            url={folder.index.url}
            name={folder.name}
            icon={folder.icon}
            external={folder.index.external}
            active={pathname === folder.index.url}
          />
        ) : (
          <button type="button" className={ROW} onClick={() => setOpen((value) => !value)}>
            {folder.icon ? <span className="shrink-0 text-muted-foreground [&_svg]:size-4">{folder.icon}</span> : null}
            <span className="flex-1 truncate">{folder.name}</span>
          </button>
        )}
        <button
          type="button"
          aria-label={open ? 'Collapse' : 'Expand'}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ChevronRight className={`size-4 transition-transform ${open ? 'rotate-90' : ''}`} />
        </button>
      </div>
      {open && (
        <ul className="ms-3 flex flex-col gap-0.5 border-s border-border/60 ps-2">
          {folder.children.map((node, i) => (
            <TreeNode key={node.$id ?? i} node={node} />
          ))}
        </ul>
      )}
    </li>
  );
}

function PageLink({
  url,
  name,
  icon,
  external,
  active,
}: {
  url: string;
  name: ReactNode;
  icon?: ReactNode;
  external?: boolean;
  active: boolean;
}) {
  const className = `${ROW} ${active ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground'}`;
  const content = (
    <>
      {icon ? <span className="shrink-0 [&_svg]:size-4">{icon}</span> : null}
      <span className="flex-1 truncate">{name}</span>
    </>
  );
  if (external) {
    return (
      <a href={url} className={className} target="_blank" rel="noreferrer">
        {content}
      </a>
    );
  }
  return (
    <Link href={url} className={className} aria-current={active ? 'page' : undefined}>
      {content}
    </Link>
  );
}

function folderContains(folder: Folder, pathname: string): boolean {
  if (folder.index?.url === pathname) return true;
  return folder.children.some((node) =>
    node.type === 'page' ? node.url === pathname : node.type === 'folder' && folderContains(node, pathname),
  );
}
