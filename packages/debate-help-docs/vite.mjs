/**
 * @file vite.mjs
 * @description The Vite plugin that compiles these docs, for the web app's
 * `vite.config.ts`.
 *
 * The docs are rendered by the web app (it mounts `routes/` under
 * `app/docs`), so it is the app's build that has to turn `content/docs` into
 * modules. That is fumadocs-mdx's Vite plugin, pointed at this package's
 * `source.config.ts` and writing its generated collections to this package's
 * `.source/` — where `lib/fumadocs/source.tsx` imports them from — rather than
 * at the app's root, which is where it would look by default.
 *
 * Plain JavaScript because Vite loads its config's workspace imports with no
 * TypeScript step of their own.
 *
 * @module debate-help-docs/vite
 */
import mdx from 'fumadocs-mdx/vite';
import { fileURLToPath } from 'node:url';

/** @returns {import('vite').PluginOption} */
export function helpDocsMdx() {
  return mdx(undefined, {
    configPath: fileURLToPath(new URL('./source.config.ts', import.meta.url)),
    outDir: fileURLToPath(new URL('./.source', import.meta.url)),
  });
}
