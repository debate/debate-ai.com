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
    // Never inline assets as `data:` URIs. vinext's next/image shim decides
    // whether to route a source through `/_vinext/image` by checking whether
    // the src ends in `.svg`, so any icon Vite inlined (default: everything
    // under 4 KB) was sent to the optimizer as `data:image/svg+xml,…`, which
    // it rejects with 400 — the icon silently rendered as a broken image.
    // Emitting every asset as a real file keeps that extension check working.
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
