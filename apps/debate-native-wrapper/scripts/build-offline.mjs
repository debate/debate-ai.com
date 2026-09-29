#!/usr/bin/env node
// Builds the debate-ai profile's "offline" source into dist/offline/: the
// whole debate-ai.com app (packages/debate-webview) as a bundled page, which
// the window loads instead of a site when the user picks "Offline" in the
// wrapper's settings. Host code is offline/main.tsx.
//
// Unlike the rest of this package this needs the monorepo installed, because
// debate-webview and everything it imports are workspace packages: run
// `bun install` at the repo root first. It runs under bun (`npm run
// build:offline`), which imports the extension's TypeScript Vite plugins as-is. It uses that install's Vite and
// Tailwind rather than adding either to this package. Without dist/offline/
// the app still builds, and the splash opens the site instead.

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(rootDir, "../..");
const webviewDir = path.join(repoRoot, "packages/debate-webview");
const extDir = path.join(repoRoot, "apps/debate-browser-ext");
const outDir = path.join(rootDir, "dist/offline");

if (!existsSync(path.join(webviewDir, "node_modules"))) {
  console.error("[native-wrapper] packages/debate-webview is not installed; run `bun install` at the repo root first.");
  process.exit(1);
}

// 1. The app. Vite, React and the node-builtin/CDN plugins come from the
// monorepo install: Vite from the root, React from debate-webview (one copy,
// or hooks break), and the two Vite plugins the browser extension already
// uses to bundle this same package — stubbing api2client's Node-only codegen,
// and shipping local copies of the scripts its libraries would fetch from a
// CDN, which is what makes the result actually work offline.
const requireFromRoot = createRequire(path.join(repoRoot, "package.json"));
const requireFromWebview = createRequire(path.join(webviewDir, "package.json"));
const { build } = await import(pathToFileURL(requireFromRoot.resolve("vite")).href);
const { stubNodeBuiltins } = await import(pathToFileURL(path.join(extDir, "vite/stub-node-builtins.ts")).href);
const { createPackageFileResolver, noRemoteCode } = await import(
  pathToFileURL(path.join(extDir, "vite/no-remote-code.ts")).href
);

const pkgDir = (name) => path.dirname(requireFromWebview.resolve(`${name}/package.json`));
const webui = (file) => path.join(webviewDir, file);
const workspaceDirs = ["debate-webview", "debate-editor", "debate-round", "debate-videos", "debate-speech-writer",
  "debate-timer", "debate-tournaments", "debate-flow", "debate-data-sync"].map((name) => path.join(repoRoot, "packages", name));

rmSync(outDir, { recursive: true, force: true });
await build({
  configFile: false,
  root: path.join(rootDir, "offline"),
  // Relative asset URLs: the page is served from tauri://localhost/offline/.
  base: "./",
  // Rolldown's notes about "use client" directives and chunking are noise for
  // a page loaded from disk; real errors still fail the build.
  logLevel: "error",
  plugins: [stubNodeBuiltins(), noRemoteCode(createPackageFileResolver(repoRoot, workspaceDirs))],
  define: {
    "process.env.NEXT_PUBLIC_APP_URL": JSON.stringify("https://debate-ai.com"),
    "process.env.NEXT_PUBLIC_BASE_URL": JSON.stringify("https://debate-ai.com"),
    "process.env": "{}",
  },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: [
      { find: /^react$/, replacement: pkgDir("react") },
      { find: /^react\/(.*)$/, replacement: `${pkgDir("react")}/$1` },
      { find: /^react-dom$/, replacement: pkgDir("react-dom") },
      { find: /^react-dom\/(.*)$/, replacement: `${pkgDir("react-dom")}/$1` },
      { find: /^debate-webview$/, replacement: webui("src/index.ts") },
      { find: /^next\/link$/, replacement: webui("src/next/link.tsx") },
      { find: /^next\/navigation$/, replacement: webui("src/next/navigation.tsx") },
      { find: /^next\/image$/, replacement: webui("src/next/image.tsx") },
      // Never shipped; the web app and the extension use the same stub.
      {
        find: "@cardcutter/browser",
        replacement: path.join(repoRoot, "packages/debate-editor/src/editor/card-cutter-stub.ts"),
      },
    ],
  },
  build: {
    outDir,
    emptyOutDir: true,
    // Loaded from disk, route by route; the web-sized warning says nothing.
    chunkSizeWarningLimit: 8000,
  },
});

// 2. debate-webview's stylesheet (Tailwind v4, compiled from its sources) —
// its own `build:css`, written straight into the output instead of the
// package's dist/.
mkdirSync(outDir, { recursive: true });
const css = spawnSync(
  path.join(webviewDir, "node_modules/.bin/tailwindcss"),
  ["-i", "src/styles/app.css", "-o", path.join(outDir, "app.css"), "--minify"],
  { cwd: webviewDir, stdio: "inherit" },
);
if (css.status !== 0) process.exit(css.status ?? 1);

console.log(`[native-wrapper] offline build written to ${path.relative(rootDir, outDir)}/`);
