/**
 * @file home-layout.tsx
 * @description Layout component for the home page,
 * mounted by the web app at `app/docs/(home)/layout.tsx`.
 *
 * The welcome page is documentation like any other page, so it gets the same
 * `notebook` DocsLayout — and therefore the same page-tree sidebar — as
 * `app/docs/(pages)`, rather than the sidebar-less `HomeLayout`.
 */
import type { ReactNode } from 'react';
import { DocsLayout } from 'fumadocs-ui/layouts/notebook';
import { source } from '../lib/fumadocs/source';
import { baseOptions } from './layout.config';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout tree={source.pageTree} {...baseOptions}>
      {children}
    </DocsLayout>
  );
}

