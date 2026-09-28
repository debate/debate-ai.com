import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Tests for the parts of this extension that are plain functions over a DOM —
 * the reading-mode extractor, the citation reader, the Markdown renderer — and
 * nothing else. Anything that touches `browser.*` is exercised by loading the
 * built extension, as the README says; a mocked `chrome.storage` would only
 * assert that the mock works.
 *
 * The root Vitest config (`apps/debate-ai.com/vitest.config.ts`) registers
 * this directory as a project, so the root `bun run test` / `bun run coverage`
 * run it under this file, and its coverage reaches Codecov. `bun run test`
 * from this directory still runs it on its own.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
  },
});
