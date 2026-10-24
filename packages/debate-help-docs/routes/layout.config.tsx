/**
 * @file layout.config.tsx
 * @description Configuration for the documentation layout, including navigation and links.
 */
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { BookOpen, Compass, ExternalLink, FileText } from 'lucide-react';
import { DebateAiLogo } from '@debate-ai/icons/brand';
import { docsConfig } from '../lib/fumadocs/customize-docs';
import { withBasePath } from '../lib/fumadocs/base-path';

export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <span className="inline-flex items-center gap-2">
        {/* The wordmark from @debate-ai/icons/brand, bundled like any other asset. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={DebateAiLogo} alt="Debate AI" width={400} height={89} className="h-6 w-auto" />
        <span>Docs</span>
      </span>
    ),
    url: withBasePath('/'),
  },
  links: [
    {
      label: 'Guides',
      icon: <Compass />,
      text: 'Guides',
      url: withBasePath('/guides'),
    },
    {
      label: 'Blog',
      icon: <FileText />,
      text: 'Blog',
      url: '/blog',
    },
    {
      label: 'Docs',
      icon: <BookOpen />,
      text: 'Docs',
      url: withBasePath('/'),
    },
    {
      // `external` makes this a plain `<a>` rather than a client-side route
      // change: the app shell (bar its sidebar) is not mounted under /docs and
      // the docs' stylesheet is, so the app has to be entered with a real page
      // load.
      label: 'Open the app',
      icon: <ExternalLink />,
      text: 'App',
      url: docsConfig.appUrl ?? '/',
      external: true,
    },
  ],
  githubUrl: 'https://github.com/debate/debate-ai.com',
};
