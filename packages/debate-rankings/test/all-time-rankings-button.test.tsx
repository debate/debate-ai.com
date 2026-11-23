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

describe("rankings filter bar", () => {
  it("renders the filter bar for college division", () => {
    const html = bar("NDT")
    expect(html).toContain('role="combobox"')
    expect(html).toContain("College Policy")
    expect(html).toContain("Teams")
    expect(html).toContain("Schools")
  })

  it("renders the filter bar for high school divisions", () => {
    const html = bar("VCX")
    expect(html).toContain('role="combobox"')
    expect(html).toContain("Policy")
    expect(html).toContain("Teams")
    expect(html).toContain("Schools")
  })
})
