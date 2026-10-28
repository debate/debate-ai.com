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
    "@debate-ai/card-parser",
    "debate-card-search",
    "debate-core",
    "@debate-ai/data-sync",
    "@debate-ai/editor",
    "@debate-ai/flow-ebb",
    "debate-rankings-sync-data",
    "@debate-ai/rankings",
    "@debate-ai/round",
    "@debate-ai/timer",
    "@debate-ai/videos",
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
  // the pre-move school-plus-name slug lands correctly too. School
  // profiles share the handle space (`/@michigan`): the same page
  // shows the school when the handle names a ranked school (see
  // `profileHandleKind` in @debate-ai/videos), and the old
  // `/schools/<slug>` address 308s to it.
  async redirects() {
    return [
      {
        source: "/teams/:handle",
        destination: "/@:handle",
        permanent: true,
      },
      {
        source: "/schools/:handle",
        destination: "/@:handle",
        permanent: true,
      },
      // High-school policy topic codes were `vcs<yy>` before they became
      // `vcx<yy>`; old Topic Starter links 308 to the new code.
      {
        source: "/docs/vcs:yy(\\d{2})",
        destination: "/docs/vcx:yy",
        permanent: true,
      },
      {
        source: "/docs/vcs:yy(\\d{2})/:path*",
        destination: "/docs/vcx:yy/:path*",
        permanent: true,
      },
    ];
  },
  // A public Topic Starter's address is `/docs/<topic code>/<file path>`
  // (`/docs/vcx27/neg/cp/aca-expansion-cp-cndi-2026`), served by the
  // Debate Editor page, which reads the code and file back off the
  // address bar. `beforeFiles`, because `/docs/[[...slug]]` (the help docs)
  // would otherwise claim it; only a first segment shaped like a topic code is
  // rewritten, so every help page keeps its URL. The shape is
  // `TOPIC_CODE_SOURCE` in @debate-ai/webview's lib/reason-docs/topic-doc-paths.
  async rewrites() {
    const topicCode = "(?:vcx|ndt)\\d{2}|(?:ld|pf)\\d{2}[a-z]";
    return {
      beforeFiles: [
        { source: `/docs/:code(${topicCode})`, destination: "/reason-editor" },
        { source: `/docs/:code(${topicCode})/:path*`, destination: "/reason-editor" },
      ],
      afterFiles: [
        { source: "/@:handle", destination: "/teams/:handle" },
        { source: "/youtube-player.html", destination: "/youtube-player" },
      ],
    };
  },
};

export default nextConfig;
