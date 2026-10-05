'use client';

import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { configureResearchAgentUI } from 'research-agent-ui';
import { researchSettingsHref } from '../../../lib/qwksearch/settings-paths';

interface SettingsModalContextValue {
  /**
   * Opens the research agent's settings, as a full page (`/settings/research`),
   * optionally on one section. Always returns `true`: debate-ai serves these
   * pages itself, so callers must never route-navigate on their own.
   */
  openSettings: (section?: string) => boolean;
  /** Leaves the settings page for the research workspace. */
  closeSettings: () => void;
}

const SettingsModalContext = createContext<SettingsModalContextValue | null>(null);

export function useSettingsModal(): SettingsModalContextValue {
  const ctx = useContext(SettingsModalContext);
  if (!ctx) {
    throw new Error('useSettingsModal must be used within a SettingsModalProvider');
  }
  return ctx;
}

/**
 * Routes the research agent's "open settings" requests to its full settings
 * page. (It was a modal; settings are a full page by default now, with the
 * sections as tabs down the side — see `SettingsContent`.)
 */
export function SettingsModalProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const openSettings = useCallback(
    (section?: string) => {
      router.push(researchSettingsHref(section));
      return true;
    },
    [router],
  );

  const closeSettings = useCallback(() => router.push('/doc'), [router]);

  // Let the shared research-agent-ui package (e.g. the input box's settings
  // menu item) open the settings page instead of navigating to a /settings
  // route this app uses for something else.
  useEffect(() => {
    configureResearchAgentUI({ onOpenSettings: openSettings });
    return () => configureResearchAgentUI({ onOpenSettings: undefined });
  }, [openSettings]);

  const value = useMemo(() => ({ openSettings, closeSettings }), [openSettings, closeSettings]);

  return <SettingsModalContext.Provider value={value}>{children}</SettingsModalContext.Provider>;
}
