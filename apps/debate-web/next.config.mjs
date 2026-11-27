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

/**
 * A Topic Starter's topic code (`vcx27`, `lda27`, `pfb27`, …) as a path
 * segment pattern. The same shape as `TOPIC_CODE_SOURCE` in
 * @debate-ai/reason-docs' lib/reason-docs/topic-doc-paths, which a test keeps
 * this copy equal to (this file is plain JS loaded before the TS packages).
 */
export const TOPIC_CODE_SOURCE = "vcx19\\d{2}|ld[a-z]19\\d{2}|(?:vcx|ndt|bq)\\d{2}|(?:ld|pf)[a-z]\\d{2}|(?:ld|pf)\\d{2}[a-z]";

/**
 * A round video's topic code (`cpd27`, `vcx24`, `ldb23`, `pfa27`) as a path
 * segment pattern. The same shape as `VIDEO_TOPIC_CODE_SOURCE` in
 * `@debate-ai/videos`' lib/video-topic-path, which a test keeps this copy
 * equal to.
 */
export const VIDEO_TOPIC_CODE_SOURCE = "(?:vcx|cpd)\\d{2}|ld[a-f]\\d{2}|pf[a-j]\\d{2}";

/** The first path segments of a Topic Starter's files, as a pattern; never a
 *  tournament. `TOPIC_STARTER_ROOTS` in `@debate-ai/videos`' lib/video-topic-path. */
export const TOPIC_STARTER_ROOTS = "aff|neg|pro|con";

/** @type {import('next').NextConfig} */
/** Sections of the old Framework page that now live on LD Philosophers (ld-ethics). */
const LD_PHILOSOPHER_SECTIONS = [
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
];

/** The current Learn page for a section of an old merged folder page. */
function learnPageFor(folder, slug) {
  if (folder === "framework") {
    return LD_PHILOSOPHER_SECTIONS.includes(slug) ? "ld-ethics" : "ld-framework";
  }
  return folder === "disadvantages" ? "da" : folder;
}

// Each Features group is one page. Some of those pages were later renamed
// from `features/<group>/index.mdx` to a flat `features/<page>.mdx`; this maps
// the old group slug to the page's current slug, for the redirects below.
const FEATURES_GROUP_PAGE = {
  "ai-coaching": "ai-coach",
  "flow-speech": "flow",
  "research-evidence": "research",
  "tournaments-judge": "tournaments-debaters",
  "ui-navigation": "app-ui",
  "video-library": "videos",
};

// The November 2026 Synergy Slayer of Critiques revision merged sections 4–6
// and 11 into their neighbours and moved The Alternative ahead of the
// critical theories; each old section slug maps to the page that holds it now.
const CRITIQUES_SECTION_MOVED = {
  "04-exigency-and-moral-negligence": "03-nirvana-fallacy",
  "05-mindset-fiat-is-not-solvency": "03-nirvana-fallacy",
  "06-selling-vs-debating": "02-original-sin",
  "07-equal-epistemic-standing": "04-equal-epistemic-standing",
  "11-fear-of-death": "10-security-discourse",
  "12-heidegger-calculative-thinking": "11-heidegger-calculative-thinking",
  "13-biopolitics": "12-biopolitics",
  "14-discursive-sound-bite-sophistry": "13-discursive-sound-bite-sophistry",
  "15-nietzsche": "14-nietzsche",
  "16-settler-colonialism": "15-settler-colonialism",
  "17-vote-synergy-or-die": "05-vote-synergy-or-die",
  "18-theory-into-action": "06-theory-into-action",
  "19-rainbow-coalition": "07-rainbow-coalition",
  "20-duel-critique": "16-duel-critique",
};

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
      // Pages that were folded into a tab of another page. Each used to be its
      // own `app/**/page.tsx` that only called `permanentRedirect`; they are
      // public addresses (sidebar links, bookmarks, saved tool records), so
      // they stay live as 308s here instead of as empty routes.
      ...Object.entries({
        "/practice": "/practice/versus-ai",
        "/practice/briefings": "/practice/prep?section=briefings",
        "/practice/challenges": "/practice/debates",
        "/practice/drills": "/practice/debates?section=drills",
        "/practice/forums": "/news?section=forums",
        "/practice/glossary": "/practice/rules?section=glossary",
        "/practice/judges": "/practice/prep?section=judges",
        "/practice/level": "/research?section=level",
        "/practice/opponents": "/practice/prep?section=opponents",
        "/practice/partners": "/practice/debates?section=partners",
        "/practice/prep-notes": "/practice/prep?section=notes",
        "/practice/strategy": "/practice/prep?section=strategy",
        "/coaching/ai-coach": "/coaching?section=ai-coach",
        "/coaching/calendar": "/coaching?section=calendar",
        "/coaching/laptopless": "/coaching?section=laptopless",
        "/coaching/materials": "/coaching?section=materials",
        "/coaching/programs": "/coaching?section=programs",
        // The rankings page is `/rank/<format>`; in production the Worker's
        // lib/redirects/rankings.ts answers first and also moves `?format=`
        // into the path.
        "/coaching/rankings": "/rank",
        "/research/topics": "/practice/statistics",
        "/research/cards/brainstorm": "/research?section=sprint",
        "/research/cards/contributions": "/research?section=rewards",
        "/research/cards/coverage": "/research?section=coverage",
        "/research/cards/inbox": "/research?section=routing",
        "/research/cards/prep-room": "/research?section=sprint",
        "/research/cards/reviews": "/research?section=review",
      }).map(([source, destination]) => ({ source, destination, permanent: true })),
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
      // Topic Starters moved from `/docs/<topic code>/…` to `/<topic code>/…`
      // (see `rewrites` below); every old link 308s to the new address with
      // its path and query string, and the browser carries a `#hash` over.
      // High-school policy codes were `vcs<yy>` before they became `vcx<yy>`,
      // so those old links go straight to the new code in one hop.
      {
        source: "/docs/vcs:yy(\\d{2})",
        destination: "/vcx:yy",
        permanent: true,
      },
      {
        source: "/docs/vcs:yy(\\d{2})/:path*",
        destination: "/vcx:yy/:path*",
        permanent: true,
      },
      {
        source: `/docs/:code(${TOPIC_CODE_SOURCE})`,
        destination: "/:code",
        permanent: true,
      },
      {
        source: `/docs/:code(${TOPIC_CODE_SOURCE})/:path*`,
        destination: "/:code/:path*",
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
        destination: `/docs/journal/synergy-slayer-critiques/${CRITIQUES_SECTION_MOVED[to] ?? to}`,
        permanent: true,
      })),
      ...Object.entries(CRITIQUES_SECTION_MOVED).map(([from, to]) => ({
        source: `/docs/journal/synergy-slayer-critiques/${from}`,
        destination: `/docs/journal/synergy-slayer-critiques/${to}`,
        permanent: true,
      })),
      // November 2026: the Research Journal moved from /docs/papers to /docs/journal.
      { source: "/docs/papers", destination: "/docs/journal", permanent: true },
      { source: "/docs/papers/:path*", destination: "/docs/journal/:path*", permanent: true },
      // November 2026: the three papers moved out of /docs/learn (and the
      // short-lived /docs/publications) into /docs/journal.
      ...[
        ["learn/critiques/synergy-slayer-critiques", "synergy-slayer-critiques"],
        ["learn/counterplans/synergy-slayer-intrinsicness", "synergy-slayer-intrinsicness"],
        ["learn/resources/debate-ai-collective-consciousness", "debate-ai-collective-consciousness"],
        ["publications/synergy-slayer-critiques", "synergy-slayer-critiques"],
        ["publications/synergy-slayer-intrinsicness", "synergy-slayer-intrinsicness"],
        ["publications/debate-ai-collective-consciousness", "debate-ai-collective-consciousness"],
      ].map(([from, to]) => ({
        source: `/docs/${from}/:path*`,
        destination: `/docs/journal/${to}/:path*`,
        permanent: true,
      })),
      // November 2026: the three papers moved out of Learn into /docs/journal
      // (briefly /docs/publications).
      ...[
        ["learn/critiques/synergy-slayer-critiques", "synergy-slayer-critiques"],
        ["learn/counterplans/synergy-slayer-intrinsicness", "synergy-slayer-intrinsicness"],
        ["learn/resources/debate-ai-collective-consciousness", "debate-ai-collective-consciousness"],
        ["publications", ""],
      ].flatMap(([from, to]) => {
        const dest = to ? `/docs/journal/${to}` : "/docs/journal";
        return [
          { source: `/docs/${from}`, destination: dest, permanent: true },
          { source: `/docs/${from}/:path*`, destination: `${dest}/:path*`, permanent: true },
        ];
      }),
      // November 2026: the small Critiques, Framework, Theory, Disadvantages and
      // Counterplans pages were split into per-section pages under /docs/debate-basics/;
      // each old section page 308s to its section anchor on the page that holds it now.
      ...[
        { from: "critiques", to: "critiques", slugs: [
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
        ]},
        { from: "framework", to: "ld-framework", slugs: [
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
        ]},
        { from: "framework", to: "ld-ethics", slugs: [
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
        ]},
        { from: "theory", to: "theory", slugs: [
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
        ]},
        { from: "counterplans", to: "counterplans", slugs: [
          "counterplans",
          "answering-cps",
          "conditional-cp",
          "consult-cp",
          "plan-inclusive-counterplans-pics",
          "agent-counterplan-theory",
          "court-cps",
          "customary-international-law-cp",
        ]},
        { from: "disadvantages", to: "da", slugs: [
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
        ]},
      ].flatMap(({ from, to, slugs }) =>
        slugs.map((slug) => ({
          source: `/docs/learn/${from}/${slug}`,
          destination: `/docs/debate-basics/${to}#${slug}`,
          permanent: true,
        })),
      ),
      // November 2026: the short Features pages were folded into their group's
      // index page as `## Title [#slug]` sections; each old page (and its flat
      // `/docs/features/<slug>` alias, still used by in-app help links) 308s to
      // its section anchor.
      ...Object.entries({
        "ai-coaching": ["coaching-programs", "llm-card-scoring", "response-outcome-charts", "scout-to-strategy"],
        "flow-speech": [
          "flow-annotations",
          "flow-cloud-save",
          "flow-summaries",
          "flow-tools-menu",
          "prep-notes",
          "shared-flow-sync",
          "speech-documents-cloud-save",
        ],
        gamification: ["daily-best-card", "daily-quests", "progress-unlocks", "quest-streaks", "revision-incentives"],
        "research-evidence": [
          "argument-library-collections",
          "brainstorm-board",
          "research-progress-tracking",
          "team-research",
          "topic-coverage-dashboard",
        ],
        rounds: ["round-invites-and-notifications"],
        "team-collaboration": [
          "card-sharing-co-editing",
          "collaboration-prep-room",
          "contribution-leaderboard",
          "contributions-feed",
          "contributor-awards",
          "group-challenges",
          "review-queue",
          "task-inbox",
          "team-collaboration-mode",
        ],
        "tournaments-judge": ["drill-sets", "judge-profiles", "opponent-team-profiles"],
        "ui-navigation": ["legacy-verbatim-shortcuts", "offline-storage", "quick-cards-cloud-save"],
      }).flatMap(([group, slugs]) =>
        slugs.flatMap((slug) =>
          [`/docs/features/${group}/${slug}`, `/docs/features/${slug}`].map((source) => ({
            source,
            destination: `/docs/features/${FEATURES_GROUP_PAGE[group] ?? group}#${slug}`,
            permanent: true,
          })),
        ),
      ),
      // November 21, 2026: every remaining page of these Features groups was
      // folded into the group's one page too (Tournament admin kept its
      // pages), each as a `## Title [#slug]` section; old page URLs and their
      // flat `/docs/features/<slug>` aliases 308 to the section anchor.
      ...Object.entries({
        "rounds": [
          "ai-versus-rounds",
          "featured-rounds",
          "live-stream",
          "practice-round-simulator",
          "practice-tools",
          "practice-vs-ai",
          "round-cloud-save",
          "round-sidebar-speeches",
          "word-count-rounds",
          "round-recording",
          "online-challenges",
          "prep-workspace",
          "rebuttal-playlists",
          "round-timer",
          "youtube-speech-start",
        ],
        "flow-speech": [
          "speech-document-target",
        ],
        "ai-coaching": [
          "ai-outcome-responses",
          "bradley-terry-debate-rankings",
          "coach-materials",
          "coaching-sessions",
          "prediction-markets",
          "coaching",
        ],
        "research-evidence": [
          "argument-tree-outline",
          "card-library-import",
          "cardmirror-embed-persistence",
          "cards",
          "evidence-library",
          "learn-cards-cloud-sync",
          "learn-decks-cloud-sync",
          "learn-review-log-cloud-sync",
          "on-page-card-reuse-search",
          "research-collaboration",
          "browser-extension-reading-and-search",
          "card-hover-actions",
          "debate-editor-zoom",
          "file-market",
          "cardmirror-read-mode",
          "research-publishers",
        ],
        "team-collaboration": [
          "contacts",
          "news-stream",
          "practice-partners",
          "school-pages",
          "team-calendar",
          "team-rankings",
          "emails",
        ],
        "tournaments-judge": [
          "formats-and-rules",
          "judge-awards",
          "pre-round-briefings",
          "tournaments-panoticon",
          "tournaments",
          "training-tools",
          "judge-paradigms",
        ],
        "video-library": [
          "native-wrapper",
          "video-library",
          "video-topic-statistics",
          "video-watch-page",
        ],
        "ui-navigation": [
          "app-nav-dock",
          "features-page",
          "reason-docs-sidebar",
          "reason-editor-outline-nav",
          "sign-in-with-qwksearch",
          "user-settings",
          "mcp-server",
        ],
      }).flatMap(([group, slugs]) =>
        slugs.flatMap((slug) =>
          [`/docs/features/${group}/${slug}`, `/docs/features/${slug}`].map((source) => ({
            source,
            destination: `/docs/features/${FEATURES_GROUP_PAGE[group] ?? group}#${slug}`,
            permanent: true,
          })),
        ),
      ),
      // The renamed Features pages: the old group URL 308s to the new page (a
      // `#section` on the old link survives the redirect), and so do the
      // history and topic pages that left their folders.
      ...[
        ...Object.entries(FEATURES_GROUP_PAGE),
        ["history/history-overview", "history"],
        ["topic-choice/critique-topics", "topics/critique-topics"],
        ["topic-choice/policy-topics", "topics/policy-topics"],
      ]
        .map(([from, to]) => ({
          source: `/docs/features/${from}`,
          destination: `/docs/features/${to}`,
          permanent: true,
        })),
      // The combined pages later left their folders: framework became
      // ld-ethics.mdx, then (November 2026) was split: ld-ethics kept the ethical
      // theories (LD Philosophers; briefly at ld-philosophers) and ld-framework took
      // burdens, metaethics and skepticism. Old ld-ethics `#section` links that moved
      // to ld-framework are forwarded on the page by <MovedAnchors>. Disadvantages
      // became da.mdx.
      ...[
        ["framework", "ld-framework"],
        ["ld-philosophers", "ld-ethics"],
        ["disadvantages", "da"],
      ].map(([from, to]) => ({
        source: `/docs/learn/${from}`,
        destination: `/docs/learn/${to}`,
        permanent: true,
      })),
    ];
  },
  // A public Topic Starter's address is `/<topic code>/<file path>`
  // (`/vcx27/neg/cp/aca-expansion-cp-cndi-2026`), served by the Debate Editor
  // page, which reads the code and file back off the address bar.
  // `beforeFiles`, because `app/[username]/[...path]` (personal files) would
  // otherwise claim it. Only a first segment shaped like a topic code is
  // rewritten, a shape no top-level page, static file or username can take
  // (`lib/__tests__/topic-starter-routes.test.ts`), so nothing else is shadowed.
  //
  // A round video's short address, `/<topic code>/<tournament>/<round>/<teams>`
  // (`/cpd27/shirley/octofinals/kansas-ss-harvard-ab`), shares the first
  // segment with Topic Starters. Rules match in order, so a path under a Topic
  // Starter root (`aff`, `neg`, `pro`, `con`) goes to the editor first; then
  // three to six segments after a video code (tournament, round, teams, then
  // the variant, speech and view) go to the video page (`app/videos/code`),
  // which serves the editor again when no round has the address; the rest are
  // Topic Starters. The root list and the segment counts are
  // `TOPIC_STARTER_ROOTS`, `MIN_ROUND_SEGMENTS` and `MAX_ROUND_SEGMENTS` in
  // `@debate-ai/videos`' lib/video-topic-path; a test keeps them in step.
  async rewrites() {
    const videoPath = [":tournament", ":round", ":teams", ":variant", ":speech", ":view"];
    return {
      beforeFiles: [
        { source: `/:code(${TOPIC_CODE_SOURCE})/:path((?:${TOPIC_STARTER_ROOTS})(?:/.*)?)`, destination: "/reason-editor" },
        ...[3, 4, 5, 6].map((count) => ({
          source: `/:code(${VIDEO_TOPIC_CODE_SOURCE})/${videoPath.slice(0, count).join("/")}`,
          destination: `/videos/code/:code/${videoPath.slice(0, count).join("/")}`,
        })),
        { source: `/:code(${TOPIC_CODE_SOURCE})`, destination: "/reason-editor" },
        { source: `/:code(${TOPIC_CODE_SOURCE})/:path*`, destination: "/reason-editor" },
      ],
      afterFiles: [
        { source: "/@:handle", destination: "/teams/:handle" },
        { source: "/youtube-player.html", destination: "/youtube-player" },
      ],
    };
  },
};

export default nextConfig;
