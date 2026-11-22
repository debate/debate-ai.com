import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import {
  buildHsAllTimeTeams,
  collegeLookupFromNdt,
  hsAllTimeSchoolKey,
  hsAllTimeTeams,
} from "../src/leaderboard/profile/hsAllTimeTeams"
import { HsAllTimeTeamsRankings } from "../src/leaderboard/profile/ProfileHsAllTimeTeams"
import { findBarkleySchoolResults } from "../src/sync/barkley-champions"
import type { NdtPointsRow } from "../src/leaderboard/profile/ndtAllSeasons"

describe("greatest high school teams of all time", () => {
  it("scores TOC and NDCA finishes per team, with top speakers joining their pair", () => {
    const lists = buildHsAllTimeTeams({
      barkley: [],
      toc: [
        { year: 2021, event: "Policy", place: "Champion", school: "Bellarmine College Preparatory (CA)", competitors: "Adarsh Hiremath & Surya Midha" },
        { year: 2021, event: "Policy", place: "Top speaker", school: "Bellarmine College Preparatory (CA)", competitors: "Surya Midha" },
        { year: 2020, event: "Public Forum", place: "Top speaker", school: "Somewhere", competitors: "Solo Speaker" },
      ],
      ndca: [{ year: 2021, place: "Champion", school: "Bellarmine College Preparatory", competitors: "Surya Midha & Adarsh Hiremath" }],
    })
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
    const html = renderToStaticMarkup(
      <HsAllTimeTeamsRankings lists={lists} schoolKey={key} collegeLoaded={false} initialEvent="Lincoln-Douglas" />,
    )
    expect(html).toContain("Greatest of all time")
    expect(html).toContain("Top 100 teams")
    expect(html).toContain("Greatest Lincoln-Douglas teams of all time")
    expect(html).toContain("data-own-team")
    expect(html).toContain("Sheth")
  })

  it("renders nothing without teams", () => {
    const html = renderToStaticMarkup(
      <HsAllTimeTeamsRankings
        lists={{ Policy: [], "Lincoln-Douglas": [], "Public Forum": [] }}
        schoolKey={null}
        collegeLoaded={false}
      />,
    )
    expect(html).toBe("")
  })

  it("counts Barkley Forum titles", () => {
    const lists = buildHsAllTimeTeams({ toc: [], ndca: [] })
    const krishnan = lists["Lincoln-Douglas"].find((t) => t.debaters === "Shruthi Krishnan")
    expect(krishnan?.finishes.map((f) => f.tournament)).toEqual(["Barkley"])
    expect(lists.Policy.find((t) => t.lastNames === "Howard & Li")?.total).toBe(30)
  })

  it("adds a quarter of each debater's own college points, high school part left out", () => {
    const row = (team: string, total: number, highSchool: number, highSchoolOnly?: true) =>
      ({ key: team, school: "Northwestern University (IL)", team, total, parts: { highSchool }, highSchoolOnly }) as unknown as NdtPointsRow
    const college = collegeLookupFromNdt({
      debaters: [row("Matt Fisher", 120, 20), row("Stephanie Spies", 50, 10), row("Nobody Here", 40, 40, true)],
    })
    const lists = buildHsAllTimeTeams({
      toc: [],
      barkley: [],
      ndca: [{ year: 2006, place: "Quarterfinalist", school: "Glenbrook North High School (IL)", competitors: "Matt Fisher & Stephanie Spies" }],
      college,
    })
    expect(lists.Policy[0]).toMatchObject({ nationals: 6, collegeCredit: 35, total: 41 })
    expect(lists.Policy[0].college.map((c) => c.debater)).toEqual(["Matt Fisher", "Stephanie Spies"])
    expect(college("Nobody Here")).toBeNull()
  })

  it("finds a school's Barkley Forum results by its circuit name", () => {
    const woodward = findBarkleySchoolResults("Woodward Academy (GA)")
    expect(woodward.filter((r) => r.place === "Champion").map((r) => r.year)).toEqual([2002, 2003])
    expect(findBarkleySchoolResults("Durham Academy").map((r) => r.place)).toEqual(["Finalist"])
    expect(findBarkleySchoolResults("Nowhere High")).toEqual([])
  })
})
