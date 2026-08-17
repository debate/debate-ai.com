import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";
import path from "path";
import { createRequire } from "module";

const appDir = path.resolve(import.meta.dirname);
const require = createRequire(import.meta.url);

export default defineConfig({
  define: {
    __USE_LIBSQL__: false,
  },
  build: {
    // Never inline imported assets as `data:` URIs. vinext's next/image shim
    // routes any local src that does not end in `.svg` through
    // `/_vinext/image?url=…`, and that endpoint rejects every `url` which
    // doesn't start with `/`. A small icon inlined as `data:image/svg+xml,…`
    // therefore 400s and renders as a broken image, while the same icon over
    // Vite's default 4096-byte threshold is emitted as a file and loads fine —
    // which is why only icon-trophy, icon-trophy-goat, icon-settings and
    // icon-read were broken. Emitting every asset as a real hashed file keeps
    // the URLs resolvable regardless of icon size.
    assetsInlineLimit: 0,
  },
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
    }),
  ],
  resolve: {
    alias: {
      "@": appDir,
      "@emotion/is-prop-valid": require.resolve("@emotion/is-prop-valid"),
      "@better-auth/kysely-adapter": path.resolve(appDir, "lib/stubs/kysely-adapter.ts"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react-server-dom-webpack",
      // Keep a single ProseMirror instance shared between the
      // reason-editor TipTap shell (@tiptap/pm) and its vendored
      // CardMirror engine (bare prosemirror-* imports).
      "prosemirror-model",
      "prosemirror-state",
      "prosemirror-view",
      "prosemirror-transform",
      "prosemirror-keymap",
    ],
  },
  optimizeDeps: {
    exclude: ["canvas"],
    include: ["@emotion/is-prop-valid"],
  },
  ssr: {
    external: ["canvas", "@libsql/client"],
    noExternal: [
      "better-auth",
      "better-auth-cloudflare",
      "@better-auth/infra",
      // Workspace packages ship TypeScript sources, so they always have to be
      // bundled rather than externalized to the Cloudflare runtime.
      "reason-editor",
      "debate-card-parser",
      "debate-card-search",
      "debate-core",
      "debate-data-sync",
      "debate-editor",
      "debate-round",
      "debate-timer",
      "debate-ui",
      "debate-videos",
    ],
  },
});
