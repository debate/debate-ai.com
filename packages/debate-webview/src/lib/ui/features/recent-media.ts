/**
 * @fileoverview Recent media surfaces for the features page.
 *
 * Two compact horizontal lists sit below the README's GitHub badges:
 * `LATEST_VIDEOS` — the ten most recently uploaded videos — and
 * `POPULAR_CARDS_WEEK` — the ten debate cards with the most reads in the
 * recent week. Both scroll left-to-right through a `Marquee` track so they
 * stay a single line tall and never crowd the homepage.
 *
 * @module features/recent-media
 */

export interface RecentVideo {
  id: string;
  /** The round's generated name (year, tournament, round, teams), or a
   * lecture's own title — never the raw YouTube upload title for a round. */
  title: string;
  channel: string;
  thumbnail: string;
  uploaded: string;
  /** The video's page in the site's library, never YouTube. */
  watchUrl: string;
  duration: string;
}

/**
 * Placeholder shown until `/api/homepage/latest-videos` answers: the ten most
 * recently uploaded videos, newest first. They link to the video library.
 */
export const LATEST_VIDEOS: RecentVideo[] = [
  {
    id: "XB0tzpBUEKQ",
    title: "Debate AI video intro",
    channel: "Debate AI",
    thumbnail: "https://i.imgur.com/mVdcP7Y.png",
    uploaded: "3 days ago",
    watchUrl: "/videos",
    duration: "4:12",
  },
  {
    id: "9bZkp7q19f0",
    title: "Public Forum rebuttal drill — flow like a pro",
    channel: "Debate AI",
    thumbnail: "https://i.imgur.com/1NBeQij.png",
    uploaded: "5 days ago",
    watchUrl: "/videos",
    duration: "6:40",
  },
  {
    id: "kffacxfA7G4",
    title: "Lincoln Douglas value criterion masterclass",
    channel: "Debate AI",
    thumbnail: "https://i.imgur.com/eIQB4Sp.png",
    uploaded: "1 week ago",
    watchUrl: "/videos",
    duration: "8:15",
  },
  {
    id: "dQw4w9WgXcQ",
    title: "Policy cross-examination: the three questions that win rounds",
    channel: "Debate AI",
    thumbnail: "https://i.imgur.com/LJ5hBjh.png",
    uploaded: "1 week ago",
    watchUrl: "/videos",
    duration: "7:03",
  },
  {
    id: "oHg5SJYRHA0",
    title: "Building a CARDS research outline in under ten minutes",
    channel: "Debate AI",
    thumbnail: "https://i.imgur.com/VbJF0Bx.png",
    uploaded: "2 weeks ago",
    watchUrl: "/videos",
    duration: "5:50",
  },
  {
    id: "jNQXAC9IVRw",
    title: "PF case construction: claims, warrants, impacts",
    channel: "Debate AI",
    thumbnail: "https://i.imgur.com/pDvMC1Q.png",
    uploaded: "2 weeks ago",
    watchUrl: "/videos",
    duration: "9:22",
  },
  {
    id: "YQHsXM4C9vI",
    title: "LD framework debate: how to win the value",
    channel: "Debate AI",
    thumbnail: "https://i.imgur.com/eIQB4Sp.png",
    uploaded: "3 weeks ago",
    watchUrl: "/videos",
    duration: "7:48",
  },
  {
    id: "kJQP7kiw5Fk",
    title: "Policy advantage solvency workshop",
    channel: "Debate AI",
    thumbnail: "https://i.imgur.com/1NBeQij.png",
    uploaded: "3 weeks ago",
    watchUrl: "/videos",
    duration: "10:05",
  },
  {
    id: "V32k1Xg2yXk",
    title: "Reading the judge: adapting mid-round",
    channel: "Debate AI",
    thumbnail: "https://i.imgur.com/LJ5hBjh.png",
    uploaded: "1 month ago",
    watchUrl: "/videos",
    duration: "4:56",
  },
  {
    id: "mzM0eY2v7Rs",
    title: "Topic analysis: this month's PF resolution",
    channel: "Debate AI",
    thumbnail: "https://i.imgur.com/mVdcP7Y.png",
    uploaded: "1 month ago",
    watchUrl: "/videos",
    duration: "12:30",
  },
];

export interface PopularCard {
  id: string;
  title: string;
  topic: string;
  format: "PF" | "LD" | "Policy";
  reads: number;
  href: string;
}

/** The ten debate cards with the most reads in the recent week. */
export const POPULAR_CARDS_WEEK: PopularCard[] = [
  {
    id: "cards-1",
    title: "US-China tech decoupling aff",
    topic: "Emerging Technology",
    format: "Policy",
    reads: 1240,
    href: "/research/cards",
  },
  {
    id: "cards-2",
    title: "Free speech on campus neg",
    topic: "Civil Liberties",
    format: "PF",
    reads: 1080,
    href: "/research/cards",
  },
  {
    id: "cards-3",
    title: "Climate reparations case",
    topic: "Environment",
    format: "Policy",
    reads: 990,
    href: "/research/cards",
  },
  {
    id: "cards-4",
    title: "Nuclear deterrence disadvantage",
    topic: "International Relations",
    format: "LD",
    reads: 940,
    href: "/research/cards",
  },
  {
    id: "cards-5",
    title: "AI-generated evidence ethics",
    topic: "Technology",
    format: "PF",
    reads: 870,
    href: "/research/cards",
  },
  {
    id: "cards-6",
    title: "Universal basic income aff",
    topic: "Economics",
    format: "LD",
    reads: 810,
    href: "/research/cards",
  },
  {
    id: "cards-7",
    title: "Supreme Court term limits neg",
    topic: "Government",
    format: "Policy",
    reads: 760,
    href: "/research/cards",
  },
  {
    id: "cards-8",
    title: "Space militarization advantage",
    topic: "International Relations",
    format: "PF",
    reads: 720,
    href: "/research/cards",
  },
  {
    id: "cards-9",
    title: "Student debt forgiveness case",
    topic: "Economics",
    format: "LD",
    reads: 690,
    href: "/research/cards",
  },
  {
    id: "cards-10",
    title: "Social media regulation neg",
    topic: "Civil Liberties",
    format: "PF",
    reads: 640,
    href: "/research/cards",
  },
];
