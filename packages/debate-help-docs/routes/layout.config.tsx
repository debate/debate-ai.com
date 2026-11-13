/**
 * @file layout.config.tsx
 * @description Configuration for the documentation layout, including navigation and links.
 */
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { DebateAiLogo } from '@debate-ai/icons/brand';
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
  githubUrl: 'https://github.com/debate/debate-ai.com',
};
