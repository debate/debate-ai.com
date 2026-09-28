/**
 * @fileoverview Guards `StatisticsPage`'s composition: it always shows the
 * topics explorer, and only shows the YouTube stats charts once that fetch
 * has actually resolved — the same "furniture, not a hard dependency" rule
 * `useYouTubeStats` already documents for the modal this page replaces.
 */

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { StatisticsPage } from "../src/panels/statistics/StatisticsPage";
import type { DebateTopicYear } from "../src/lib/debate-topics";

const TOPICS: DebateTopicYear[] = [
  { year: 2024, policy_topic_name: "Healthcare", policy_topic: "Healthcare resolution text." },
];

const YOUTUBE_STATS = {
  summary: { totalViews: 100, totalVideos: 10, totalChannels: 2, totalDebateStyles: 4 },
  byChannel: [{ channel: "Test Channel", totalViews: 100, videoCount: 10, avgViewsPerVideo: 10 }],
  byDebateStyle: [],
  byYear: [{ year: "2024", totalViews: 100, videoCount: 10, avgViewsPerVideo: 10 }],
};

describe("StatisticsPage", () => {
  it("shows the topics explorer without a youtube stats fetch", () => {
    const html = renderToStaticMarkup(
      createElement(StatisticsPage, { topics: TOPICS, youtubeStats: null }),
    );
    expect(html).toContain("Healthcare");
    expect(html).not.toContain("YouTube Channel Statistics");
  });

  it("shows the youtube stats charts once the fetch resolves", () => {
    const html = renderToStaticMarkup(
      createElement(StatisticsPage, { topics: TOPICS, youtubeStats: YOUTUBE_STATS }),
    );
    expect(html).toContain("Healthcare");
    expect(html).toContain("YouTube Channel Statistics");
    expect(html).toContain("Test Channel");
  });
});
