import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const monoRoot = resolve(__dirname, "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  transpilePackages: [
    "react-resizable-panels",
    // Published as TypeScript source rather than a build output.
    "legal-terms-privacy-policy",
    // Workspace packages are published as TypeScript source.
    "reason-editor",
    "@debate/card-parser",
    "debate-card-search",
    "debate-core",
    "@debate/data-sync",
    "@debate/editor",
    "@debate/flow-ebb",
    "debate-rankings",
    "@debate/rankings-adapter",
    "@debate/round",
    "@debate/timer",
    "@debate/videos",
  ],
  serverExternalPackages: [
    "better-auth",
    "drizzle-orm",
    "@libsql/client",
    "libsql",
  ],
  turbopack: {
    root: monoRoot,
  },
  outputFileTracingRoot: monoRoot,
  // Team profiles live at `@<handle>` handles (`/@harker-ll`), not
  // under `/teams/`. `@` cannot name an `app/` folder — Next reserves
  // it for parallel-route slots — so the page keeps its `app/teams/
  // [team]` home and the handle is mapped onto it here: a request for
  // `/@harker-ll` is rewritten to `/teams/harker-ll` internally, and
  // the old `/teams/<slug>` address 308s to the handle so bookmarks
  // and search indexes follow the move. Both spellings still resolve
  // on the page itself (see `findTeamEntries`), so a link carrying
  // the pre-move school-plus-name slug lands correctly too.
  async redirects() {
    return [
      {
        source: "/teams/:handle",
        destination: "/@:handle",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [{ source: "/@:handle", destination: "/teams/:handle" }];
  },
};

export default nextConfig;
