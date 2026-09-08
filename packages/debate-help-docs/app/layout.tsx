/**
 * @file layout.tsx
 * @description Root layout component that wraps the entire application.
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Provider } from './provider';
import { docsConfig } from '@/lib/fumadocs/customize-docs';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: docsConfig.title ?? 'Docs',
    template: `%s | ${docsConfig.title ?? 'Docs'}`,
  },
  description: docsConfig.description,
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
    >
      <body className="flex flex-col min-h-screen">
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
