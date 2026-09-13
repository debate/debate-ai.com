import { describe, expect, it } from "vitest"

import { MAX_RECENT_TOOLS, parseRecentTools, pushRecentTool } from "@/lib/recentTools"

describe("pushRecentTool", () => {
  it("adds a new href to the front of an empty list", () => {
    expect(pushRecentTool([], "/reason-editor")).toEqual(["/reason-editor"])
  })

  it("moves an already-present href to the front instead of duplicating it", () => {
    expect(pushRecentTool(["/tools", "/reason-editor", "/drills"], "/drills")).toEqual([
      "/drills",
      "/tools",
      "/reason-editor",
    ])
  })

  it("returns the same array reference when the href is already most recent", () => {
    const current = ["/reason-editor", "/tools"]
    expect(pushRecentTool(current, "/reason-editor")).toBe(current)
  })

  it("caps the list at MAX_RECENT_TOOLS, dropping the oldest entries", () => {
    const current = Array.from({ length: MAX_RECENT_TOOLS }, (_, i) => `/tool-${i}`)
    const next = pushRecentTool(current, "/new-tool")
    expect(next).toHaveLength(MAX_RECENT_TOOLS)
    expect(next[0]).toBe("/new-tool")
    expect(next).not.toContain(`/tool-${MAX_RECENT_TOOLS - 1}`)
  })

  it("ignores an invalid href, returning the list unchanged", () => {
    const current = ["/tools"]
    expect(pushRecentTool(current, "https://example.com/tools")).toBe(current)
    expect(pushRecentTool(current, "")).toBe(current)
  })
})

describe("parseRecentTools", () => {
  it("returns an empty list for null/empty input", () => {
    expect(parseRecentTools(null)).toEqual([])
    expect(parseRecentTools("")).toEqual([])
  })

  it("returns an empty list for malformed JSON", () => {
    expect(parseRecentTools("{not json")).toEqual([])
  })

  it("returns an empty list when the parsed value isn't an array", () => {
    expect(parseRecentTools(JSON.stringify({ href: "/tools" }))).toEqual([])
  })

  it("filters out invalid hrefs while keeping valid ones", () => {
    expect(parseRecentTools(JSON.stringify(["/tools", "javascript:alert(1)", "/drills"]))).toEqual([
      "/tools",
      "/drills",
    ])
  })

  it("caps the parsed list at MAX_RECENT_TOOLS", () => {
    const tooMany = Array.from({ length: MAX_RECENT_TOOLS + 3 }, (_, i) => `/tool-${i}`)
    expect(parseRecentTools(JSON.stringify(tooMany))).toHaveLength(MAX_RECENT_TOOLS)
  })
})
