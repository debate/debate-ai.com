/**
 * @file layout.config.tsx
 * @description Configuration for the documentation layout, including navigation and links.
 */
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { BookOpen, Compass, ExternalLink, Swords } from 'lucide-react';
import { docsConfig } from '../lib/fumadocs/customize-docs';
import { withBasePath } from '../lib/fumadocs/base-path';

export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <span className="inline-flex items-center gap-2">
        {/* An icon rather than docsConfig.favicon: the favicon binaries were
            never copied from the template (see README "Known gaps"), and a
            missing <img> renders as a broken-image glyph. */}
        <Swords className="size-5 text-primary" aria-hidden="true" />
        {docsConfig.title}
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
      label: 'Docs',
      icon: <BookOpen />,
      text: 'Docs',
      url: withBasePath('/'),
    },
    {
      // `external` makes this a plain `<a>` rather than a client-side route
      // change: the app shell and its stylesheet are not mounted under /docs,
      // so the app has to be entered with a real page load.
      label: 'Open the app',
      icon: <ExternalLink />,
      text: 'App',
      url: docsConfig.appUrl ?? '/',
      external: true,
    },
  ],
  githubUrl: 'https://github.com/debate/debate-ai.com',
};
