/**
 * @file root-layout.tsx
 * @description The layout every docs route shares, mounted by the web app at
 * `app/docs/layout.tsx`.
 *
 * The app's root layout owns `<html>` and `<body>` (and the theme provider),
 * so this only adds what the docs need on top: Fumadocs' provider (search
 * dialog, sidebar state) and the docs stylesheet. The app shell puts the
 * site's sidebar (dock and tool tree) beside `/docs`, and the Fumadocs layouts
 * below fill the content column next to it.
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Provider } from './provider';
import { docsConfig } from '../lib/fumadocs/customize-docs';
import '../styles/docs.css';

export const metadata: Metadata = {
  title: {
    default: docsConfig.title ?? 'Docs',
    template: `%s | ${docsConfig.title ?? 'Docs'}`,
  },
  description: docsConfig.description,
};

export default function DocsRootLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Provider>{children}</Provider>
    </div>
  );
}
