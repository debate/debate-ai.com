/**
 * @fileoverview Pins the `/docs/<topic code>/<file path>` address of a Topic
 * Starter: the code scheme read off `debate-topics.json`, the paths that are
 * the editor rather than the help docs, and the copy of the code's shape that
 * `@debate-ai/videos` keeps for its sidebar check.
 */

import { describe, it, expect } from "vitest"
import { isTopicStarterDocsPath } from "@debate-ai/videos"
import {
  TOPIC_CATALOG,
  buildTopicCatalog,
  findTopicByCode,
  topicsForFormat,
  yearsForFormat,
} from "../../../src/lib/reason-docs/topic-codes"
import {
  DEFAULT_TOPIC_CODE,
  isTopicCode,
  parseTopicDocsPath,
  topicDocsHref,
} from "../../../src/lib/reason-docs/topic-doc-paths"

describe("topic codes", () => {
  it("codes each format by year, lettering the seasonal ones in order", () => {
    const [policy, ndt, ld1, ld2, pf1] = buildTopicCatalog([
      {
        year: 2027,
        policy_topic_name: "National Health Insurance",
        policy_topic: "Resolved: health.",
        ndt_topic: "Resolved: arms.",
        ld_topics: [
          { start_month: "September", topic_name: "Space", topic: "Resolved: space." },
          { start_month: "November", topic_name: "De-Extinction", topic: "Resolved: de-extinction." },
        ],
        pf_topics: [{ start_month: "September", topic_name: "Data Centers", topic: "Resolved: data." }],
      },
    ])
    expect([policy, ndt, ld1, ld2, pf1].map((item) => item?.code)).toEqual(["vcx27", "ndt27", "ld27a", "ld27b", "pf27a"])
    expect(ld2).toMatchObject({ format: "ld", year: 2027, month: "November", name: "De-Extinction" })
  })

  it("gives every resolution in the data a unique, well-formed code", () => {
    const codes = TOPIC_CATALOG.map((item) => item.code)
    expect(new Set(codes).size).toBe(codes.length)
    for (const code of codes) expect(isTopicCode(code)).toBe(true)
  })

  it("lists every topic of a format, newest year first", () => {
    const years = yearsForFormat("ld")
    expect(years).toEqual([...years].sort((a, b) => b - a))
    expect(topicsForFormat("ld").every((item) => item.format === "ld")).toBe(true)
  })

  it("defaults to the newest high-school policy topic", () => {
    // Move DEFAULT_TOPIC_CODE along when debate-topics.json gains a year.
    expect(DEFAULT_TOPIC_CODE).toBe(topicsForFormat("vcx")[0]?.code)
    expect(findTopicByCode(DEFAULT_TOPIC_CODE)?.name).toBeTruthy()
  })
})

describe("parseTopicDocsPath", () => {
  it("reads the code and file path off a topic starter address", () => {
    expect(parseTopicDocsPath("/docs/vcx27/neg/cp/aca-expansion-cp-cndi-2026")).toEqual({
      code: "vcx27",
      ref: "neg/cp/aca-expansion-cp-cndi-2026",
    })
    expect(parseTopicDocsPath("/docs/ld27a/")).toEqual({ code: "ld27a", ref: null })
  })

  it("leaves the help docs alone", () => {
    for (const path of ["/docs", "/docs/features/drill-sets", "/docs/learn", "/docs/vcx2027/x", "/reason-editor", null]) {
      expect(parseTopicDocsPath(path)).toBeNull()
    }
  })

  it("round-trips topicDocsHref", () => {
    const href = topicDocsHref("pf27b", "aff/case one")
    expect(href).toBe("/docs/pf27b/aff/case%20one")
    expect(parseTopicDocsPath(href)).toEqual({ code: "pf27b", ref: "aff/case one" })
  })

  it("agrees with @debate-ai/videos' copy of the code shape", () => {
    for (const path of ["/docs/vcx27", "/docs/ndt26/x", "/docs/ld27e/a/b", "/docs/pf25c", "/docs", "/docs/features", "/docs/vcx2027"]) {
      expect(isTopicStarterDocsPath(path)).toBe(parseTopicDocsPath(path) != null)
    }
  })
})
