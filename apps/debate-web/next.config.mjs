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
      // The October 2026 Synergy Slayer of Critiques revision renumbered
      // and merged sections; old section links 308 to their new home.
      ...Object.entries({
        "02-what-the-round-trains-you-on": "01-concerned-reader-standard",
        "03-original-sin": "02-original-sin",
        "04-nirvana-fallacy": "03-nirvana-fallacy",
        "05-exigency-and-moral-negligence": "04-exigency-and-moral-negligence",
        "06-mindset-fiat-is-not-solvency": "05-mindset-fiat-is-not-solvency",
        "07-selling-vs-debating": "06-selling-vs-debating",
        "08-equal-epistemic-standing": "07-equal-epistemic-standing",
        "10-discursive-sound-bite-sophistry": "14-discursive-sound-bite-sophistry",
        "11-rejecting-the-system": "08-rejecting-the-system",
        "12-security-planning": "10-security-discourse",
        "13-heidegger-calculative-thinking": "12-heidegger-calculative-thinking",
        "14-biopolitics": "13-biopolitics",
        "18-rejection-without-institutions": "17-theory-into-action",
        "19-permutation": "16-vote-synergy-or-die",
        "20-rainbow-coalition": "18-rainbow-coalition",
        "21-duel-critique": "19-duel-critique",
      }).map(([from, to]) => ({
        source: `/docs/learn/critiques/synergy-slayer-critiques/${from}`,
        destination: `/docs/learn/critiques/synergy-slayer-critiques/${to}`,
        permanent: true,
      })),
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
