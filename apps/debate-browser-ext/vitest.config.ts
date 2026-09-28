import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Tests for the parts of this extension that are plain functions over a DOM —
 * the reading-mode extractor, the citation reader, the Markdown renderer — and
 * nothing else. Anything that touches `browser.*` is exercised by loading the
 * built extension, as the README says; a mocked `chrome.storage` would only
 * assert that the mock works.
 *
 * This app is outside the repo's workspace globs and its own config, so it
 * carries its own runner rather than appearing in the root Vitest projects
 * list. Run it with `bun run test` from this directory.
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
