/**
 * @fileoverview The school trademark notice behind the info icon on profile
 * logos: its wording names the school, disclaims affiliation and endorsement,
 * and links to the full clause on the legal page; `TeamLabel` only draws the
 * icon when asked and when the school has a logo.
 */

import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import { SCHOOL_TRADEMARKS_HREF, schoolTrademarkDisclaimer } from "../src/leaderboard/TrademarkInfo"
import { TeamLabel } from "../src/leaderboard/team-label/TeamLabel"

describe("schoolTrademarkDisclaimer", () => {
  it("names the school and disclaims affiliation and endorsement", () => {
    const text = schoolTrademarkDisclaimer("Harker").join(" ")
    expect(text).toContain("trademarks of Harker are the property of Harker")
    expect(text).toContain("used here solely to identify and refer to the institution")
    expect(text).toContain("not affiliated with, sponsored by, endorsed by, or officially connected with Harker")
    expect(text).toContain("does not imply its approval of Debate AI")
  })

  it("links to the trademark section of the legal page", () => {
    expect(SCHOOL_TRADEMARKS_HREF).toBe("/legal/privacy#school-trademarks")
  })
})

describe("TeamLabel trademarkInfo", () => {
  const render = (props: Record<string, unknown>) =>
    renderToStaticMarkup(createElement(TeamLabel, { debaters: "Kim & Lee", ...props }))

  it("adds the info icon beside a logo link only when asked", () => {
    const html = render({ school: "Harker", schoolHref: "/@harker", trademarkInfo: true })
    expect(html).toContain('aria-label="Trademark notice for Harker"')
    // The button follows the link instead of sitting inside it.
    expect(html).toMatch(/<\/a><button[^>]*data-trademark-info/)
    expect(render({ school: "Harker", schoolHref: "/@harker" })).not.toContain("data-trademark-info")
  })

  it("leaves a school with no logo without the icon", () => {
    expect(render({ school: "Nowhere Unknown High", trademarkInfo: true })).not.toContain("data-trademark-info")
  })
})
