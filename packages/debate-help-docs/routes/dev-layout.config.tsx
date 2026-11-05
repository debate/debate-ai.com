/**
 * @file dev-layout.config.tsx
 * @description Layout options for the developer docs at /docs/dev: their own
 * nav title and home link, and links out to the user docs and the repository.
 * The user docs never link back here.
 */
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { BookOpen, ExternalLink } from 'lucide-react';
import { DebateAiLogo } from '@debate-ai/icons/brand';
import { docsConfig } from '../lib/fumadocs/customize-docs';
import { withBasePath, withDevBasePath } from '../lib/fumadocs/base-path';

export const devBaseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <span className="inline-flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={DebateAiLogo} alt="Debate AI" width={400} height={89} className="h-6 w-auto" />
        <span>Dev Docs</span>
      </span>
    ),
    url: withDevBasePath('/'),
  },
  links: [
    {
      label: 'User docs',
      icon: <BookOpen />,
      text: 'User docs',
      url: withBasePath('/'),
    },
    {
      // A real page load, as in layout.config.tsx: the app shell is not
      // mounted under /docs.
      label: 'Open the app',
      icon: <ExternalLink />,
      text: 'App',
      url: docsConfig.appUrl ?? '/',
      external: true,
    },
  ],
  githubUrl: 'https://github.com/debate/debate-ai.com',
};
