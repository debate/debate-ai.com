import type { WxtViteConfig } from 'wxt';

/**
 * Vite's `Plugin` type, as the Vite that WXT builds with defines it.
 *
 * This app declares no `vite` of its own, so `import type { Plugin } from
 * 'vite'` resolves the monorepo root's Vite 8 — whose `Plugin` WXT's config
 * (typed against its own Vite 6) rejects. Taking the type from WXT's config
 * keeps the plugins here typed against the Vite that actually runs them.
 */
export type Plugin = Extract<NonNullable<WxtViteConfig['plugins']>[number], { name: string }>;
