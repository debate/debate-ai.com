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

export default function RootDocsLayout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout tree={source.pageTree} {...baseOptions}>
      {/* The page tree again, as a section of the app's sidebar (desktop). */}
      <AppSidebarDocsTree tree={source.pageTree} />
      {children}
    </DocsLayout>
  );
}
