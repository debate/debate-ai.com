/**
 * @fileoverview The root `README.md`'s banner, badges and product
 * screenshots, as data the features page renders.
 *
 * The README is the repo's front page and this panel is the app's, so they
 * show the same imagery: the banner, every badge row in the README's order,
 * and one screenshot per workspace (CARDS, FIAT, LEARN, STREAM, REASON). The
 * README stays the source — edit it first, then mirror the change here;
 * `test/lib/ui/readme-media.test.ts` fails when the two drift apart.
 *
 * @module features/readme-media
 */

/** One badge from the README's centered badge block. */
export interface ReadmeBadge {
  /** Badge image URL, exactly as the README has it. */
  src: string;
  /** Alt text for the badge image. */
  alt: string;
  /** Where the badge links; absent for the README's unlinked tech badges. */
  href?: string;
  /** Pixel height the README pins the badge to, when it pins one. */
  height?: number;
}

/** One workspace screenshot and the heading it sits above in the README. */
export interface ReadmeShowcase {
  /** The workspace's acronym, as the README's heading names it. */
  name: string;
  /** Emoji the README's heading leads with. */
  emoji: string;
  /** What the acronym stands for. */
  expansion: string;
  /** Screenshot URL on imgur. */
  image: string;
  /** App route the workspace lives on. */
  href: string;
}

/** The README's full-width banner. */
export const README_BANNER = "https://i.imgur.com/mVdcP7Y.png";

/**
 * The project's YouTube video, embedded on the features page.
 *
 * The same video the README's YouTube badge links to, promoted to an embed so a
 * reader gets the tour without leaving the page.
 *
 * `youtube-nocookie.com` rather than `youtube.com/embed`: the embeddable host
 * does not drop tracking cookies until the reader actually presses play, which
 * is what makes the click-to-load poster in `FeaturesPanel` worth having.
 */
export const README_VIDEO = {
  /** YouTube video id — the one the README's YouTube badge points at. */
  id: "XB0tzpBUEKQ",
  title: "Debate AI in two minutes",
  /** Poster frame, so the embed has something to show before it is played. */
  thumbnail: "https://i.ytimg.com/vi/XB0tzpBUEKQ/maxresdefault.jpg",
  /** Canonical watch page, for readers who would rather watch it there. */
  watchUrl: "https://www.youtube.com/watch?v=XB0tzpBUEKQ",
} as const;

/** The README's badges, one array per `<br />`-separated row. */
export const README_BADGE_ROWS: ReadmeBadge[][] = [
  [
    {
      href: "https://doi.org/10.5281/zenodo.20320435",
      src: "https://zenodo.org/badge/DOI/10.5281/zenodo.20320435.svg",
      alt: "DOI",
    },
    {
      href: "https://doi.org/10.5281/zenodo.20320093",
      src: "https://zenodo.org/badge/DOI/10.5281/zenodo.20320093.svg",
      alt: "DOI",
    },
    {
      href: "https://doi.org/10.5281/zenodo.20517983",
      src: "https://zenodo.org/badge/DOI/10.5281/zenodo.20517983.svg",
      alt: "DOI",
    },
  ],
  [
    {
      href: "https://www.reddit.com/r/Debate+PublicForumDebate+lincolndouglas+policydebate/",
      src: "https://img.shields.io/badge/_Reddit-FF4500?style=for-the-badge&logo=reddit&logoColor=white",
      alt: "Reddit Forum",
      height: 20,
    },
    {
      href: "https://www.tabroom.com/",
      src: "https://img.shields.io/badge/🏆_Tournaments-informational?style=for-the-badge",
      alt: "Tournaments",
      height: 20,
    },
    {
      href: "https://debate-ai.com",
      src: "https://img.shields.io/badge/App-blueviolet?style=for-the-badge&logo=googlechrome&logoColor=white",
      alt: "Website",
      height: 20,
    },
    {
      href: "https://deepwiki.com/debate/debate-ai.com",
      src: "https://deepwiki.com/badge.svg",
      alt: "Ask DeepWiki",
    },
    {
      href: "https://debate-ai.com/docs",
      src: "https://img.shields.io/badge/Docs-blue?logo=ReadTheDocs&logoColor=white",
      alt: "Documentation",
    },
    {
      href: "https://debate-ai.com/api",
      src: "https://img.shields.io/badge/API-blue?logo=fastapi&logoColor=white",
      alt: "API",
    },
    {
      href: "https://youtu.be/XB0tzpBUEKQ",
      src: "https://img.shields.io/badge/YouTube-red?style=for-the-badge&logo=youtube&logoColor=white",
      alt: "YouTube",
      height: 20,
    },
    {
      href: "https://status.debate-ai.com",
      src: "https://uptime.betterstack.com/status-badges/v1/monitor/2yp1i.svg",
      alt: "Production uptime",
    },
    {
      href: "https://codecov.io/gh/debate/debate-ai.com",
      src: "https://img.shields.io/badge/%EB%AA%A8%20lines-64k-yellow",
      alt: "Lines of code",
    },
  ],
  [
    {
      href: "https://github.com/debate/debate-ai.com/stargazers",
      src: "https://img.shields.io/github/stars/debate/debate-ai.com",
      alt: "GitHub Stars",
    },
    {
      href: "https://codecov.io/gh/debate/debate-ai.com",
      src: "https://codecov.io/gh/debate/debate-ai.com/graph/badge.svg",
      alt: "Coverage",
    },
    {
      href: "https://github.com/debate/debate-ai.com/actions/workflows/test.yml",
      src: "https://github.com/debate/debate-ai.com/actions/workflows/test.yml/badge.svg?branch=master",
      alt: "CI status",
    },
    {
      href: "https://github.com/debate/debate-ai.com/graphs/contributors",
      src: "https://img.shields.io/github/contributors/debate/debate-ai.com",
      alt: "Contributors",
    },
    {
      href: "https://github.com/debate/debate-ai.com/branches",
      src: "https://img.shields.io/github/branches/debate/debate-ai.com.svg",
      alt: "Branches",
    },
    {
      href: "https://github.com/debate/debate-ai.com/pulls",
      src: "https://img.shields.io/github/issues-pr/debate/debate-ai.com?logo=github&label=PRs",
      alt: "Open Pull Requests",
    },
    {
      href: "https://github.com/debate/debate-ai.com/pulls?q=is%3Apr+is%3Aclosed",
      src: "https://img.shields.io/github/issues-pr-closed/debate/debate-ai.com?logo=github&label=PRs%20merged&color=8957e5",
      alt: "Merged Pull Requests",
    },
  ],
  [
    {
      href: "https://github.com/debate/debate-ai.com/discussions",
      src: "https://img.shields.io/github/discussions/debate/debate-ai.com",
      alt: "GitHub Discussions",
    },
    {
      href: "https://github.com/debate/debate-ai.com/graphs/contributors",
      src: "https://img.shields.io/github/commit-activity/m/debate/debate-ai.com",
      alt: "Commit activity",
    },
    {
      href: "https://github.com/debate/debate-ai.com/commits/master/",
      src: "https://img.shields.io/github/last-commit/debate/debate-ai.com.svg",
      alt: "GitHub last commit",
    },
    {
      href: "https://discord.gg/dh8UKEaYA5",
      src: "https://img.shields.io/discord/1110227955554209923.svg?label=Chat&logo=Discord&colorB=7289da&style=flat",
      alt: "Join Discord",
    },
    {
      href: "https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request",
      src: "https://img.shields.io/badge/PRs--welcome-brightgreen",
      alt: "PRs Welcome",
    },
  ],
  [
    {
      href: "https://deploy.workers.cloudflare.com/?url=https://github.com/debate/debate-ai.com",
      src: "https://deploy.workers.cloudflare.com/button",
      alt: "Deploy to Cloudflare Workers",
      height: 24,
    },
    {
      href: "https://stackblitz.com/github/debate/debate-ai.com/tree/master/packages/debate-card-parser",
      src: "https://developer.stackblitz.com/img/open_in_stackblitz.svg",
      alt: "Open in StackBlitz",
      height: 20,
    },
    {
      src: "https://img.shields.io/badge/Claude-D97757?logo=claude&logoColor=white",
      alt: "Claude",
    },
    {
      src: "https://img.shields.io/badge/Next.js-black?logo=nextdotjs&logoColor=white",
      alt: "Next.js",
    },
    {
      src: "https://img.shields.io/badge/Cloudflare-F38020?logo=cloudflareworkers&logoColor=white",
      alt: "Cloudflare Workers",
    },
    {
      src: "https://img.shields.io/badge/shadcn%2Fui-000000?logo=shadcnui&logoColor=white",
      alt: "shadcn/ui",
    },
  ],
];

/** The README's five workspace sections, each with its screenshot. */
export const README_SHOWCASE: ReadmeShowcase[] = [
  {
    name: "CARDS",
    emoji: "📚",
    expansion: "Crowdsourced Annotated Research for Debating Solutions",
    image: "https://i.imgur.com/VbJF0Bx.png",
    href: "/research/cards",
  },
  {
    name: "FIAT",
    emoji: "⚖️",
    expansion: "Forum for Issue Analysis on Topic",
    image: "https://i.imgur.com/1NBeQij.png",
    href: "/debate",
  },
  {
    name: "LEARN",
    emoji: "🎥",
    expansion: "Lectures from Educators, Archive of Rounds & Notes",
    image: "https://i.imgur.com/eIQB4Sp.png",
    href: "/videos",
  },
  {
    name: "STREAM",
    emoji: "🔎",
    expansion: "Search with Top Result Extraction & Answer Model",
    image: "https://i.imgur.com/LJ5hBjh.png",
    href: "/research",
  },
  {
    name: "REASON",
    emoji: "📝",
    expansion: "Research Editor for Annotated Summaries in Outline Notation",
    image: "https://i.imgur.com/pDvMC1Q.png",
    href: "/reason-editor",
  },
];
