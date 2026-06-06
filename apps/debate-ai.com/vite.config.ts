import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";
import path from "path";

const appDir = path.resolve(import.meta.dirname);

export default defineConfig({
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
    }),
  ],
  resolve: {
    alias: {
      "@/lib/card-parser": path.resolve(appDir, "../../packages/debate-card-parser"),
      "@/packages": path.resolve(appDir, "../../packages"),
      "@": appDir,
      "@emotion/is-prop-valid": path.resolve(appDir, "node_modules/@emotion/is-prop-valid"),
      "@better-auth/kysely-adapter": path.resolve(appDir, "lib/stubs/kysely-adapter.ts"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react-server-dom-webpack"],
  },
  optimizeDeps: {
    exclude: ["canvas"],
    include: ["@emotion/is-prop-valid"],
  },
  ssr: {
    external: ["canvas"],
    noExternal: [
      "better-auth",
      "better-auth-cloudflare",
      "@better-auth/infra",
      "reason-editor",
    ],
  },
});
