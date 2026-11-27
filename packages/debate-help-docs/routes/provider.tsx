/**
 * @file provider.tsx
 * @description Root provider component that sets up Fumadocs and search functionality.
 */
'use client';
import { RootProvider } from 'fumadocs-ui/provider/next';
import SearchDialog from '../components/fumadocs/layout/search';
import type { ReactNode } from 'react';

export function Provider({ children }: { children: ReactNode }) {
  return (
    <RootProvider
      search={{
        SearchDialog,
      }}
      // The app's root layout already provides next-themes (and its "d" hotkey
      // is gone with the light/dark switch): a second provider here would keep
      // its own copy of the mode, apart from the one the app and the Themes
      // menu share.
      theme={{ enabled: false }}
    >
      {children}
    </RootProvider>
  );
}