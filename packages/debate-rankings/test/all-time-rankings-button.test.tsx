import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { LeaderboardFilterBar } from "../src/leaderboard/LeaderboardFilterBar"

function bar(division: "NDT" | "VCX") {
  return renderToStaticMarkup(
    <LeaderboardFilterBar
      division={division}
      view="teams"
      year="2026"
      years={["2026", "2025"]}
      onChangeDivision={() => {}}
      onChangeView={() => {}}
      onChangeYear={() => {}}
    />,
  )
}

describe("rankings All time button", () => {
  it("sits after the season picker and opens a dialog", () => {
    const html = bar("NDT")
    expect(html).toContain("All time")
    expect(html.indexOf("All time")).toBeGreaterThan(html.indexOf("role=\"combobox\""))
    expect(html.indexOf("role=\"combobox\"")).toBeGreaterThan(-1)
    expect(html).toContain('aria-haspopup="dialog"')
    expect(html).toContain("<dialog")
    expect(html).toContain("Greatest college teams of all time")
  })

  it("names the high school list on high school divisions", () => {
    expect(bar("VCX")).toContain("Greatest high school teams of all time")
  })
})
