import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const monoRoot = resolve(__dirname, "../..");

/**
 * Crawlers that get page metadata in `<head>` instead of streamed into the
 * body: vinext's (Next's) default list, plus Googlebot, which the default
 * leaves out because it runs JavaScript. Google only accepts a
 * `rel="canonical"` from `<head>`, so without this every page's canonical was
 * invisible to it and Search Console reported "Duplicate without
 * user-selected canonical". See lib/seo/canonical-link.ts.
 */
const HTML_LIMITED_BOTS = String.raw`Googlebot|(?:^|[^\w-])[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|meta-externalagent|meta-externalfetcher|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight`;

/** @type {import('next').NextConfig} */
const nextConfig = {
  htmlLimitedBots: new RegExp(HTML_LIMITED_BOTS, "i"),
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
        "18-rejection-without-institutions": "18-theory-into-action",
        "19-permutation": "17-vote-synergy-or-die",
        "20-rainbow-coalition": "19-rainbow-coalition",
        "21-duel-critique": "20-duel-critique",
        // November 2026: section 15 (Nietzsche) was added, shifting 15–19 up one.
        "15-settler-colonialism": "16-settler-colonialism",
        "16-vote-synergy-or-die": "17-vote-synergy-or-die",
        "17-theory-into-action": "18-theory-into-action",
        "18-rainbow-coalition": "19-rainbow-coalition",
        "19-duel-critique": "20-duel-critique",
      }).map(([from, to]) => ({
        source: `/docs/learn/critiques/synergy-slayer-critiques/${from}`,
        destination: `/docs/learn/critiques/synergy-slayer-critiques/${to}`,
        permanent: true,
      })),
      // November 2026: the small Critiques, Framework, Theory and Disadvantages
      // pages were merged into one page per folder (its index); each old page
      // 308s to its section anchor on the combined page.
      ...Object.entries({
        critiques: [
          "kritiks",
          "k-2nr-collapse",
          "responding-to-k",
          "plan-inclusive-kritiks-piks",
          "non-topical-affirmatives-k-affs",
          "responding-to-k-affs",
          "afropessimism-antiblackness-k",
          "capitalism-k",
          "death-k",
          "deleuze-k",
          "lacan-k",
          "nietzsche-k",
          "queer-theory-k",
          "settler-colonialism-k",
          "virilio-k",
          "philosophy-framework",
          "a-prioris",
        ],
        framework: [
          "metaethic",
          "truth-testing",
          "permissibility-and-presumption",
          "permissibility-triggers",
          "presumption-triggers",
          "necessary-but-insufficient-burden-nib",
          "moral-skepticism",
          "induction",
          "determinism",
          "particularism",
          "utilitarianism",
          "longtermism",
          "kant",
          "contractarianism",
          "hobbes",
          "rawls",
          "pettit",
          "hegel",
          "levinas",
          "existentialism",
          "mills",
          "plato",
          "virtue-ethics",
          "pragmatism",
        ],
        theory: [
          "theory",
          "common-theory-shells",
          "responding-to-theory",
          "reverse-voting-issue-rvi",
          "1nc-theory",
          "1ar-theory",
          "1ar-restart",
          "combo-shells",
          "frivolous-theory",
          "topicality",
          "t-framework",
          "role-of-the-ballot",
          "disclosure",
          "evidence-ethics-theory",
          "agent-specification-aspec",
          "solvency-advocate-theory",
          "international-fiat-theory",
          "multi-actor-fiat-theory",
          "vague-alternatives-theory",
          "act-omission-distinction",
          "intent-foresight-distinction",
          "indexicals",
          "performative-contradictions-perfcon",
          "tricks",
          "skepticism-triggers",
          "hijacks",
          "underviews-spikes",
          "tournaments-guide",
        ],
        disadvantages: [
          "argument-basics",
          "disadvantages",
          "structure-of-a-shell",
          "foundational-calculus",
          "answering-das",
          "horsetrading-da",
          "policy-affirmatives",
          "policy-negatives",
          "briefs",
          "crystalization",
          "spreading",
        ],
      }).flatMap(([folder, slugs]) =>
        slugs.map((slug) => ({
          source: `/docs/learn/${folder}/${slug}`,
          destination: `/docs/learn/${folder}#${slug}`,
          permanent: true,
        })),
      ),
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
    const topicCode = "vcx19\\d{2}|(?:vcx|ndt)\\d{2}|(?:ld|pf)[a-z]\\d{2}|(?:ld|pf)\\d{2}[a-z]";
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
