import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import {
  TOP_PICK_BADGES,
  getTopPickBadgeInfo,
  type TopPickBadgeInfo,
} from "../src/lib/topPickBadges"
import { TopPickBadge } from "../src/components/video-card/TopPickBadge"

describe("topPickBadges", () => {
  it("assigns #001 to the earliest top pick (Iowa LR vs Kansas EM)", () => {
    const earliestId = "m5x5KhnWbx4"
    const info = getTopPickBadgeInfo(earliestId)
    expect(info.badgeNumber).toBe("#001")
    expect(info.badgeIndex).toBe(1)
    expect(info.affTeam).toBe("Iowa LR")
    expect(info.negTeam).toBe("Kansas EM")
    expect(info.year).toBe(1999)
  })

  it("assigns #002 and #003 in strict chronological order", () => {
    const secondInfo = getTopPickBadgeInfo("V9MaoDDhLjs")
    expect(secondInfo.badgeNumber).toBe("#002")
    expect(secondInfo.badgeIndex).toBe(2)
    expect(secondInfo.affTeam).toBe("Fort Hays RR")
    expect(secondInfo.negTeam).toBe("Michigan State CM")

    const thirdInfo = getTopPickBadgeInfo("Rp3ewv7Axxk")
    expect(thirdInfo.badgeNumber).toBe("#003")
    expect(thirdInfo.badgeIndex).toBe(3)
  })

  it("contains all curated top pick entries formatted with # and 3 digits", () => {
    const values = Object.values(TOP_PICK_BADGES)
    expect(values.length).toBeGreaterThanOrEqual(160)

    values.forEach((item, index) => {
      expect(item.badgeIndex).toBe(index + 1)
      expect(item.badgeNumber).toMatch(/^#\d{3}$/)
    })
  })

  it("falls back gracefully when videoId is not in the precomputed registry", () => {
    const fallbackInfo = getTopPickBadgeInfo("unknown-id", {
      affTeam: "Custom Aff",
      negTeam: "Custom Neg",
      title: "Custom Title",
    })
    expect(fallbackInfo.badgeNumber).toBe("#GOAT")
    expect(fallbackInfo.affTeam).toBe("Custom Aff")
    expect(fallbackInfo.negTeam).toBe("Custom Neg")
  })
})

describe("TopPickBadge component", () => {
  it("renders trigger element with top pick aria-label and medal", () => {
    const html = renderToStaticMarkup(
      createElement(TopPickBadge, {
        videoId: "m5x5KhnWbx4",
      }),
    )

    expect(html).toContain("🎖️")
    expect(html).toContain("Top pick #001: Greatest of All Time")
  })

  it("supports size variants", () => {
    const htmlSm = renderToStaticMarkup(
      createElement(TopPickBadge, {
        videoId: "m5x5KhnWbx4",
        size: "sm",
      }),
    )
    expect(htmlSm).toContain("p-1")

    const htmlLg = renderToStaticMarkup(
      createElement(TopPickBadge, {
        videoId: "m5x5KhnWbx4",
        size: "lg",
      }),
    )
    expect(htmlLg).toContain("text-xl")
  })

  it("overrides metadata when explicit props are provided", () => {
    const html = renderToStaticMarkup(
      createElement(TopPickBadge, {
        videoId: "custom-vid",
        affTeam: "Northwestern GM",
        negTeam: "Dartmouth SV",
      }),
    )
    expect(html).toContain("Top pick #GOAT: Greatest of All Time")
  })
})
