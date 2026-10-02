/**
 * @fileoverview Guards `StatisticsPage`'s composition: it shows the
 * research-area topic explorer passed in from the host page, puts the per-
 * season topics timeline first, and only shows the YouTube stats charts once
 * that fetch has actually resolved — the same "furniture, not a hard
 * dependency" rule `useYouTubeStats` already documents for the modal this
 * page replaces.
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

  it("always shows its own topic areas section, even with no host slot", () => {
    // The explorer now lives in this package and renders directly, so the
    // section no longer depends on the host passing `topicAreasSlot`.
    const html = renderToStaticMarkup(
      createElement(StatisticsPage, { topics: TOPICS, youtubeStats: null }),
    );
    expect(html).toContain("Topic Areas by Research Domain");
  });

  it("renders the host's topic areas section, below the year timeline", () => {
    const html = renderToStaticMarkup(
      createElement(StatisticsPage, {
        topics: TOPICS,
        youtubeStats: null,
        topicAreasSlot: createElement("div", null, "Areas slot here"),
      }),
    );
    expect(html).toContain("Areas slot here");
    // Stacked order: the per-season topics and video numbers first, then the
    // areas explorer, then the channel charts.
    expect(html.indexOf("Debate Topics by Year")).toBeLessThan(html.indexOf("Areas slot here"));
  });

  it("puts the year timeline at the top, above the charts", () => {
    const html = renderToStaticMarkup(
      createElement(StatisticsPage, { topics: TOPICS, youtubeStats: YOUTUBE_STATS }),
    );
    expect(html.indexOf("Debate Topics by Year")).toBeLessThan(
      html.indexOf("YouTube Channel Statistics"),
    );
  });

  it("lays the four totals charts out in a four-column grid", () => {
    const html = renderToStaticMarkup(
      createElement(StatisticsPage, { topics: TOPICS, youtubeStats: YOUTUBE_STATS }),
    );
    expect(html).toContain("xl:grid-cols-4");
  });
});
