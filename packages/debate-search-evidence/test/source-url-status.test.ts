/**
 * @fileoverview The wording behind the source-link status icon on card search
 * results.
 */
import { describe, expect, it } from "vitest"
import { describeSourceUrlStatus } from "../src/lib/source-url-status"

/** 2026-11-04T00:00:00Z in Unix seconds. */
const NOV_4 = Date.UTC(2026, 10, 4) / 1000

describe("describeSourceUrlStatus", () => {
  it("reads a card with no saved check as not checked, never as broken", () => {
    expect(describeSourceUrlStatus(undefined)).toMatchObject({ status: "unchecked", label: "Not checked" })
    expect(describeSourceUrlStatus({ status: "bogus" as never })).toMatchObject({ status: "unchecked" })
  })

  it("says a 2xx link works, with when it was checked", () => {
    expect(describeSourceUrlStatus({ status: "valid", statusCode: 200, checkedAt: NOV_4 })).toEqual({
      status: "valid",
      label: "Link works",
      description: "Source link opened when checked on Nov 4, 2026 (HTTP 200).",
    })
  })

  it("names the HTTP status of a broken link", () => {
    expect(describeSourceUrlStatus({ status: "invalid", statusCode: 404, error: "HTTP 404" })).toEqual({
      status: "invalid",
      label: "Link broken",
      description: "Source link returned HTTP 404 when checked.",
    })
  })

  it("gives the reason a link could not be reached", () => {
    expect(describeSourceUrlStatus({ status: "error", error: "Timeout after 8000ms", checkedAt: NOV_4 })).toEqual({
      status: "error",
      label: "Link unreachable",
      description: "Source link could not be reached when checked on Nov 4, 2026: Timeout after 8000ms.",
    })
  })
})
