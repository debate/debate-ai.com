/**
 * @file docs-layout.tsx
 * @description Layout component for documentation pages,
 * mounted by the web app at `app/docs/(pages)/layout.tsx`.
 */
import { source } from '../lib/fumadocs/source';
import { DocsLayout } from 'fumadocs-ui/layouts/notebook';
import { AppSidebarDocsTree } from '../components/fumadocs/layout/app-sidebar-docs-tree';
import type { ReactNode } from 'react';
import { baseOptions } from './layout.config';
import { SearchWithThemesIcon, SearchWithToolbarSlot } from '../components/fumadocs/layout/header-toolbar';

export default function RootDocsLayout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      {...baseOptions}
      // The header's search box is followed by a spot for the page's toolbar
      // (Copy, Ask AI, … Info), which each page portals in (header-toolbar.tsx), then
      // by the Themes menu; below `md` the Themes icon sits beside the search icon.
      slots={{ searchTrigger: { sm: SearchWithThemesIcon, full: SearchWithToolbarSlot } }}
    >
      {/* The page tree again, as a section of the app's sidebar (desktop). */}
      <AppSidebarDocsTree tree={source.pageTree} />
      {children}
    </DocsLayout>
  );
}
