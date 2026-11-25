/**
 * @fileoverview The link from any listed resolution to its Practice Debates
 * sign-up board, and the board key both ends agree on.
 */

import { describe, expect, it } from "vitest"
import {
  MAX_TOPIC_TEXT,
  parseTopicSignupParams,
  topicKey,
  topicSignupHref,
} from "../src/topics/topic-signup-link"

describe("topicKey", () => {
  it("ignores case, spacing, punctuation and a Resolved: prefix", () => {
    const key = topicKey("Society should go nuclear.")
    expect(key).toBe("society should go nuclear")
    expect(topicKey("  Resolved:  society should GO nuclear ")).toBe(key)
    expect(topicKey("Resolved, that society should go nuclear!")).not.toBe("")
  })

  it("is empty for text with nothing in it", () => {
    expect(topicKey(" .. ")).toBe("")
  })
})

describe("topicSignupHref / parseTopicSignupParams", () => {
  it("round-trips the topic, format and source", () => {
    const href = topicSignupHref({ text: "Resolved: The USFG should ban TikTok.", format: "PF", source: "2023-24 PF" })
    expect(href.startsWith("/practice/debates?section=topics&topic=")).toBe(true)
    const params = new URL(href, "https://x.test").searchParams
    expect(parseTopicSignupParams(params)).toEqual({
      text: "Resolved: The USFG should ban TikTok.",
      format: "PF",
      source: "2023-24 PF",
    })
  })

  it("returns null without a topic and caps long text", () => {
    expect(parseTopicSignupParams(new URLSearchParams("section=topics"))).toBeNull()
    const long = parseTopicSignupParams(new URLSearchParams({ topic: "a ".repeat(1000) }))
    expect(long?.text.length).toBeLessThanOrEqual(MAX_TOPIC_TEXT)
  })
})
