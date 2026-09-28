/**
 * @file home-layout.tsx
 * @description Layout component for the home page,
 * mounted by the web app at `app/docs/(home)/layout.tsx`.
 */
import type { ReactNode } from 'react';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from './layout.config';

export default function Layout({ children }: { children: ReactNode }) {
  return <HomeLayout {...baseOptions}>{children}</HomeLayout>;
}

