/**
 * @fileoverview Topic Sign-ups: the POST body parser and the panel's
 * no-topic and topic views.
 */

import { describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }))

import { cleanUrl, parseTopicAction } from "../../src/topic-signups/validation"
import { TopicSignupsPanel } from "../../src/topic-signups/ui/TopicSignupsPanel"

const TOPIC = { topic: "Resolved: Society should go nuclear.", format: "Value" }

describe("parseTopicAction", () => {
  it("parses a sign-up with defaults for unknown roles and sides", () => {
    const parsed = parseTopicAction({ ...TOPIC, action: "signup", role: "boss", side: "up", note: "  hi  " })
    expect(parsed).toEqual({
      ok: true,
      value: {
        topic: { key: "society should go nuclear", text: TOPIC.topic, format: "Value", source: null },
        action: { action: "signup", role: "debate", side: "either", note: "hi" },
      },
    })
  })

  it("needs a topic, a squad name and something in a note", () => {
    expect(parseTopicAction({ topic: "", action: "signup" }).ok).toBe(false)
    expect(parseTopicAction({ ...TOPIC, action: "create-squad", name: "" }).ok).toBe(false)
    expect(parseTopicAction({ ...TOPIC, action: "add-note", kind: "evidence" }).ok).toBe(false)
    expect(parseTopicAction({ ...TOPIC, action: "add-note", url: "ftp://x" }).ok).toBe(false)
    expect(parseTopicAction({ ...TOPIC, action: "frobnicate" }).ok).toBe(false)
  })

  it("accepts http(s) links only", () => {
    expect(cleanUrl("https://example.com/a")).toBe("https://example.com/a")
    expect(cleanUrl("javascript:alert(1)")).toBeNull()
  })
})

describe("TopicSignupsPanel", () => {
  it("without a topic, points to every topic list", () => {
    const html = renderToStaticMarkup(createElement(TopicSignupsPanel))
    expect(html).toContain("Sign up to debate a topic")
    expect(html).toContain('href="/practice/statistics"')
  })

  it("with a topic, heads the board with the resolution", () => {
    const html = renderToStaticMarkup(
      createElement(TopicSignupsPanel, { target: { text: "Society should go nuclear.", format: "Value" } }),
    )
    expect(html).toContain("Resolved: Society should go nuclear.")
    expect(html).toContain("Loading this topic")
  })
})
