import path from 'node:path';
import { defineConfig } from 'vitest/config';

// offline/main.tsx mounts the workspace's debate-webview, which
// scripts/build-offline.mjs bundles from its source folder rather than as a
// dependency of this package; resolve it the same way (the tests mock it).
const webviewDir = path.resolve(import.meta.dirname, '../../packages/debate-webview');

export default defineConfig({
  // offline/api-proxy.ts reads the profile's site from a build-time constant
  // (scripts/build-offline.mjs defines it the same way).
  define: {
    __WRAPPER_SITE__: JSON.stringify('https://site.test'),
  },
  resolve: {
    alias: {
      '@debate-ai/webview': webviewDir,
    },
  },
  test: {
    name: '@debate-ai/native-wrapper',
    root: import.meta.dirname,
    environment: 'jsdom',
    include: ['test/**/*.test.ts?(x)'],
  },
});
