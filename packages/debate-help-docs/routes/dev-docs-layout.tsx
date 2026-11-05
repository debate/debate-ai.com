/**
 * @file dev-docs-layout.tsx
 * @description Layout for the developer docs, mounted by the web app at
 * `app/docs/dev/layout.tsx`. A separate Fumadocs DocsLayout over the
 * developer page tree, so it has its own sidebar and none of the user docs'.
 *
 * The developer docs are unlisted: nothing links here, they are not in the
 * sitemap, and every page is `noindex` (the metadata below, inherited by the
 * pages).
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { DocsLayout } from 'fumadocs-ui/layouts/notebook';
import { devSource } from '../lib/fumadocs/dev-source';
import { AppSidebarDocsTree } from '../components/fumadocs/layout/app-sidebar-docs-tree';
import { devBaseOptions } from './dev-layout.config';

export const metadata: Metadata = {
  title: {
    default: 'Developer docs',
    template: '%s | Debate AI Dev Docs',
  },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function DevDocsLayout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout tree={devSource.pageTree} {...devBaseOptions}>
      <AppSidebarDocsTree tree={devSource.pageTree} />
      {children}
    </DocsLayout>
  );
}
