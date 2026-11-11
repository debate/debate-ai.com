/**
 * @fileoverview The "25-26" topic season under the year badge on a round's
 * watch page, and the resolution its hover shows for the round's level.
 */

import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { getSeasonTopicItems } from "@debate-ai/rankings/src/topics/debate-topics"
import type { TopicType } from "../src/types/videos"
import { WatchSeasonTopic } from "../src/components/videos/watch/WatchSeasonTopic"

const TOPICS: TopicType[] = [
  {
    year: 2025,
    ndt_topic_name: "Nuclear Forces",
    ndt_topic: "Resolved: The United States should change its nuclear forces.",
    policy_topic: "Resolved: The United States federal government should significantly strengthen its protection of domestic intellectual property rights.",
  },
]

describe("WatchSeasonTopic", () => {
  it("labels the season the round was debated in", () => {
    const html = renderToStaticMarkup(<WatchSeasonTopic seasonYear={2026} style={4} topics={TOPICS} />)
    expect(html).toContain("25-26")
    expect(html).toContain('aria-label="25-26 season topic"')
  })

  it("still shows the season before the topics load", () => {
    const html = renderToStaticMarkup(<WatchSeasonTopic seasonYear={2026} style={4} />)
    expect(html).toContain("25-26")
    expect(html).toContain('aria-label="25-26 season"')
  })

  it("renders nothing for a legacy round with no season", () => {
    expect(renderToStaticMarkup(<WatchSeasonTopic seasonYear={0} style={4} topics={TOPICS} />)).toBe("")
  })

  it("hovers the college resolution for college rounds and the HS one for high school", () => {
    expect(getSeasonTopicItems(TOPICS, 2026, 4)[0]?.text).toContain("nuclear forces")
    expect(getSeasonTopicItems(TOPICS, 2026, 1)[0]?.text).toContain("intellectual property")
  })
})
