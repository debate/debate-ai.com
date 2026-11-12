import { describe, expect, it } from "vitest"
import {
  describeClose,
  describeSource,
  formatPercent,
  formatPoints,
  KIND_LABELS,
} from "../src/format"

describe("formatPercent", () => {
  it("formats whole percentages", () => {
    expect(formatPercent(0.5)).toBe("50%")
    expect(formatPercent(0)).toBe("0%")
    expect(formatPercent(1)).toBe("100%")
  })

  it("shows <1% for tiny positive values", () => {
    expect(formatPercent(0.001)).toBe("<1%")
    expect(formatPercent(0.004)).toBe("<1%")
  })

  it("shows >99% for near-certain values", () => {
    expect(formatPercent(0.999)).toBe(">99%")
    expect(formatPercent(0.996)).toBe(">99%")
  })

  it("rounds other values", () => {
    expect(formatPercent(0.333)).toBe("33%")
    expect(formatPercent(0.666)).toBe("67%")
  })
})

describe("formatPoints", () => {
  it("formats points with thousands separators", () => {
    expect(formatPoints(1000)).toBe("1,000 pts")
    expect(formatPoints(500)).toBe("500 pts")
    expect(formatPoints(1234567)).toBe("1,234,567 pts")
  })

  it("floors fractional points", () => {
    expect(formatPoints(99.9)).toBe("99 pts")
  })
})

describe("describeClose", () => {
  const now = 1_000_000

  it("says betting closed when past", () => {
    expect(describeClose(now - 1, now)).toBe("betting closed")
    expect(describeClose(now, now)).toBe("betting closed")
  })

  it("says closes in minutes", () => {
    expect(describeClose(now + 60, now)).toBe("closes in 1m")
    expect(describeClose(now + 3599, now)).toBe("closes in 59m")
  })

  it("says closes in hours", () => {
    expect(describeClose(now + 3600, now)).toBe("closes in 1h")
    expect(describeClose(now + 47 * 3600, now)).toBe("closes in 47h")
  })

  it("says closes in days", () => {
    expect(describeClose(now + 48 * 3600, now)).toBe("closes in 2d")
    expect(describeClose(now + 5 * 86400, now)).toBe("closes in 5d")
  })
})

describe("describeSource", () => {
  it("describes a tabroom panel source", () => {
    expect(describeSource({ type: "tabroom-panel" })).toBe("Settles itself from the hosted round's ballots.")
  })

  it("describes a tabroom event source", () => {
    expect(describeSource({ type: "tabroom-event" })).toBe("Settles itself from the hosted event's final results.")
  })

  it("describes a rating source", () => {
    expect(describeSource({ type: "rating", name: "Harvard", school: "MA", baseline: 85.5 })).toBe(
      "Settles itself at close against Harvard (MA)'s rating of 85.5 when it opened.",
    )
  })

  it("describes an argument source", () => {
    expect(describeSource({ type: "argument" })).toBe(
      "Settled after the later speech by someone in the round who holds no wager on it, or a moderator.",
    )
  })

  it("describes a creator-settled source", () => {
    expect(describeSource({ type: "manual" })).toBe("Settled by its creator or a moderator.")
  })
})

describe("KIND_LABELS", () => {
  it("has labels for all market kinds", () => {
    expect(KIND_LABELS.debate).toBe("Debate")
    expect(KIND_LABELS.tournament).toBe("Tournament winner")
    expect(KIND_LABELS.rating).toBe("Rating move")
    expect(KIND_LABELS.argument).toBe("Argument")
  })
})