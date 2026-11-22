import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { buildHsAllTimeTeams, hsAllTimeSchoolKey, hsAllTimeTeams } from "../src/leaderboard/profile/hsAllTimeTeams"
import { HsAllTimeTeamsCard } from "../src/leaderboard/profile/ProfileHsAllTimeTeams"

describe("greatest high school teams of all time", () => {
  it("scores TOC and NDCA finishes per team, with top speakers joining their pair", () => {
    const lists = buildHsAllTimeTeams(
      [
        { year: 2021, event: "Policy", place: "Champion", school: "Bellarmine College Preparatory (CA)", competitors: "Adarsh Hiremath & Surya Midha" },
        { year: 2021, event: "Policy", place: "Top speaker", school: "Bellarmine College Preparatory (CA)", competitors: "Surya Midha" },
        { year: 2020, event: "Public Forum", place: "Top speaker", school: "Somewhere", competitors: "Solo Speaker" },
      ],
      [{ year: 2021, place: "Champion", school: "Bellarmine College Preparatory", competitors: "Surya Midha & Adarsh Hiremath" }],
    )
    expect(lists.Policy).toHaveLength(1)
    expect(lists.Policy[0]).toMatchObject({ rank: 1, total: 70, titles: 2, lastNames: "Hiremath & Midha", school: "Bellarmine College Preparatory" })
    // A pair event's speaker with no recorded pair isn't credited.
    expect(lists["Public Forum"]).toHaveLength(0)
  })

  it("ranks every event from the bundled history", () => {
    const lists = hsAllTimeTeams()
    for (const list of Object.values(lists)) {
      expect(list.length).toBeGreaterThan(10)
      expect(list[0].rank).toBe(1)
      for (let i = 1; i < list.length; i++) expect(list[i].total).toBeLessThanOrEqual(list[i - 1].total)
    }
    expect(lists["Lincoln-Douglas"].slice(0, 3).map((t) => t.debaters)).toContain("Ansh Sheth")
  })

  it("matches a school page and highlights its teams", () => {
    const lists = hsAllTimeTeams()
    const key = hsAllTimeSchoolKey("Harker", lists)
    expect(key).toBe("harker")
    const html = renderToStaticMarkup(<HsAllTimeTeamsCard lists={lists} schoolKey={key} />)
    expect(html).toContain("Greatest of all time")
    expect(html).toContain("Lincoln-Douglas")
    expect(html).toContain("data-own-team")
    expect(html).toContain("Sheth")
  })

  it("renders nothing without teams", () => {
    const html = renderToStaticMarkup(
      <HsAllTimeTeamsCard lists={{ Policy: [], "Lincoln-Douglas": [], "Public Forum": [] }} schoolKey={null} />,
    )
    expect(html).toBe("")
  })
})
