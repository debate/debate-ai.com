/**
 * @file layout.config.tsx
 * @description Configuration for the documentation layout, including navigation and links.
 */
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { DebateAiLogo } from '@debate-ai/icons/brand';
import { withBasePath } from '../lib/fumadocs/base-path';
import { SearchWithThemesIcon, SearchWithThemesSlot } from '../components/fumadocs/layout/header-toolbar';

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
  // Fumadocs' own light/dark switch is replaced by the Themes menu
  // (components/fumadocs/layout/themes-menu.tsx), which the search slots add to
  // the header's buttons, wide and narrow.
  themeSwitch: { enabled: false },
  slots: { searchTrigger: { sm: SearchWithThemesIcon, full: SearchWithThemesSlot } },

};
