/**
 * @fileoverview How a stored live stream reads to listeners: on air only
 * while segments keep arriving, a replay once nobody has touched it for two
 * hours, and a stream switched off still offered as its replay.
 */

import { describe, expect, it } from "vitest"

import { LIVE_STALE_MS, effectiveStatus, toSummary, type LiveRoundRow } from "@/lib/live-rounds/store"

const row = (overrides: Partial<LiveRoundRow> = {}): LiveRoundRow => ({
  id: "r",
  owner_id: "o",
  title: "T",
  tournament_name: "",
  round_level: "",
  aff: "A",
  neg: "N",
  debaters: "[]",
  invitees: "[]",
  is_private: 0,
  status: "live",
  current_speech: "1AC",
  segment_count: 2,
  duration_ms: 10_000,
  last_segment_at: 1_000_000,
  created_at: 0,
  updated_at: 1_000_000,
  ...overrides,
})

describe("live stream status", () => {
  it("is on air only while segments are fresh", () => {
    expect(toSummary(row(), 1_005_000).onAirSpeech).toBe("1AC")
    expect(toSummary(row(), 1_030_000)).toMatchObject({ status: "live", onAirSpeech: null })
  })

  it("reads as a replay once stale", () => {
    expect(effectiveStatus(row(), 1_000_000 + LIVE_STALE_MS + 1)).toBe("ended")
    expect(toSummary(row(), 1_000_000 + LIVE_STALE_MS + 1).status).toBe("ended")
  })

  it("offers a switched-off stream as its replay", () => {
    expect(effectiveStatus(row({ status: "off" }), 1_000_000)).toBe("off")
    expect(toSummary(row({ status: "off" }), 1_000_000)).toMatchObject({ status: "ended", onAirSpeech: null })
  })
})
