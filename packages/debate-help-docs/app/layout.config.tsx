/**
 * @file layout.config.tsx
 * @description Configuration for the documentation layout, including navigation and links.
 */
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { BookOpen, Compass, ExternalLink, Swords } from 'lucide-react';
import { docsConfig } from '@/lib/fumadocs/customize-docs';
import { ThemeDropdown } from '@/components/fumadocs/layout/theme-dropdown';

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
  },
  links: [
    {
      label: 'Guides',
      icon: <Compass />,
      text: 'Guides',
      url: '/docs/guides',
    },
    {
      label: 'Docs',
      icon: <BookOpen />,
      text: 'Docs',
      url: '/docs',
    },
    {
      label: 'Open the app',
      icon: <ExternalLink />,
      text: 'App',
      url: docsConfig.appUrl ?? 'https://debate-ai.com',
      external: true,
    },
    {
      type: 'custom' as const,
      children: <ThemeDropdown />,
    },
  ],
  githubUrl: 'https://github.com/debate/debate-ai.com',
};
