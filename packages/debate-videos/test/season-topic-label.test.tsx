/**
 * @fileoverview The topic name beside a season row in the videos list: the
 * curated short name (or a cut-down resolution) shows, the full text waits
 * in a tooltip, and a season keyed "23-24" reads the 2023 topics entry.
 */

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { TopicType, VideoType } from "../src/types/videos";
import { getSeasonTopicItems, shortTopicName } from "@debate-ai/data-sync/src/topics/debate-topics";
import { buildVideoSlots } from "../src/components/videos/grid/video-stacks";
import { buildVideoTree } from "../src/components/videos/grid/video-tree";
import { VideoTreeRows, type VideoTreeRowContext } from "../src/components/videos/grid/VideoTreeRows";

const TOPICS: TopicType[] = [
  {
    year: 2023,
    ndt_topic_name: "Legal Personhood",
    ndt_topic: "The United States Federal Government should grant legal personhood to one or more of the following.",
    policy_topic: "The United States federal government should significantly increase its security cooperation with NATO.",
    ld_topics: [
      { start_month: "September", topic_name: "Whistleblowing", topic: "Whistleblowing is a moral duty." },
      { start_month: "November", topic_name: "Term Limits", topic: "Term limits ought to be imposed." },
    ],
  },
];

function round(id: string, style: 1 | 2 | 3 | 4, season = 2024): VideoType {
  return [
    id, id, "2024-02-14", "Channel", 10, "", style, "Harvard 2024", "Finals",
    "Aff Team", "Neg Team", true, "2-1", null, null, false, null, season,
  ];
}

function renderSeason(videos: VideoType[], topics?: TopicType[]) {
  const [season] = buildVideoTree(buildVideoSlots(videos, null, false), "round");
  const context: VideoTreeRowContext = {
    isRoundMode: true,
    showThumbnails: false,
    favorites: new Set(),
    hiddenVideos: new Set(),
    stackSelection: {},
    onStackSelect: () => {},
    onToggleFavorite: () => {},
    onHideVideo: () => {},
    onUnhideVideo: () => {},
    topics,
  };
  return renderToStaticMarkup(
    <table>
      <tbody>
        <VideoTreeRows node={season} depth={0} collapseDepth={1} context={context} />
      </tbody>
    </table>,
  );
}

describe("shortTopicName", () => {
  it("prefers the curated title", () => {
    expect(shortTopicName({ title: "Legal Personhood", text: "Long text" })).toBe("Legal Personhood");
  });

  it("cuts an untitled resolution at a word boundary", () => {
    const label = shortTopicName({
      text: "Resolved: The United States ought to guarantee the right to housing.",
    });
    expect(label).toBe("The United States ought to…");
  });

  it("keeps a short untitled resolution whole", () => {
    expect(shortTopicName({ text: "Resolved: Ban guns." })).toBe("Ban guns.");
  });
});

describe("getSeasonTopicItems", () => {
  it("reads the entry for the year the season starts", () => {
    expect(getSeasonTopicItems(TOPICS, 2024, 4).map((t) => t.title)).toEqual(["Legal Personhood"]);
    expect(getSeasonTopicItems(TOPICS, 2023, 4)).toEqual([]);
  });

  it("lists every LD topic of the season", () => {
    expect(getSeasonTopicItems(TOPICS, 2024, 3).map((t) => t.title)).toEqual([
      "Whistleblowing",
      "Term Limits",
    ]);
  });
});

describe("season row topic", () => {
  it("shows the topic name beside the season label", () => {
    const html = renderSeason([round("a", 4)], TOPICS);
    expect(html).toContain("23-24");
    expect(html).toContain(">Legal Personhood</span>");
  });

  it("joins a season's LD topic names", () => {
    expect(renderSeason([round("a", 3)], TOPICS)).toContain(">Whistleblowing · Term Limits</span>");
  });

  it("names no topic when the season mixes formats", () => {
    expect(renderSeason([round("a", 4), round("b", 3)], TOPICS)).not.toContain("Legal Personhood");
  });

  it("names no topic without topic data", () => {
    expect(renderSeason([round("a", 4)])).not.toContain("Legal Personhood");
  });
});
