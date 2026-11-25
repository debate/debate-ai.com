import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import {
  buildHsAllTimeTeams,
  collegeLookupFromNdt,
  hsAllTimeSchoolKey,
  hsAllTimeTeams,
  type HsAllTimeTeam,
} from "../src/leaderboard/profile/hsAllTimeTeams"
import { HsAllTimeTeamsRankings } from "../src/leaderboard/profile/ProfileHsAllTimeTeams"
import { findBarkleySchoolResults } from "../src/sync/barkley-champions"
import type { NdtPointsRow } from "../src/leaderboard/profile/ndtAllSeasons"

describe("greatest high school teams of all time", () => {
  it("scores TOC and NDCA finishes per team, with top speakers joining their pair", () => {
    const lists = buildHsAllTimeTeams({
      barkley: [],
      cal: [],
      toc: [
        { year: 2021, event: "Policy", place: "Champion", school: "Bellarmine College Preparatory (CA)", competitors: "Adarsh Hiremath & Surya Midha" },
        { year: 2021, event: "Policy", place: "Top speaker", school: "Bellarmine College Preparatory (CA)", competitors: "Surya Midha" },
        { year: 2020, event: "Public Forum", place: "Top speaker", school: "Somewhere", competitors: "Solo Speaker" },
      ],
      ndca: [{ year: 2021, place: "Champion", school: "Bellarmine College Preparatory", competitors: "Surya Midha & Adarsh Hiremath" }],
    })
    expect(lists.Policy).toHaveLength(1)
    // GOAT high school points (TOC title 10, top speaker 4, NDCA title 10) at 0.5×.
    expect(lists.Policy[0]).toMatchObject({ rank: 1, total: 12, titles: 2, lastNames: "Hiremath & Midha", school: "Bellarmine College Preparatory" })
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

  it("shows a school's wordmark logo when it has one", () => {
    const team = (school: string, schoolKey: string): HsAllTimeTeam => ({
      rank: 1,
      event: "Policy",
      school,
      schoolKey,
      sourceSchool: school,
      debaters: "Ada & Grace",
      lastNames: "Ada & Grace",
      firstYear: 2020,
      lastYear: 2020,
      total: 30,
      nationals: 30,
      collegeCredit: 0,
      titles: 1,
      finishes: [],
      college: [],
    })
    const lists = { Policy: [team("Harker", "harker"), team("Nowhere High", "nowhere")], "Lincoln-Douglas": [], "Public Forum": [] }
    const html = renderToStaticMarkup(
      <HsAllTimeTeamsRankings lists={lists} schoolKey={null} collegeLoaded={false} />,
    )
    const logos = html.match(/<img\b/g) ?? []
    expect(logos.length).toBe(1)
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
    expect(lists.Policy.find((t) => t.lastNames === "Howard & Li")?.total).toBe(5)
    const stMarks = hsAllTimeTeams().Policy.find((t) => t.lastNames === "Gulakov & Miles")
    expect(stMarks?.finishes.map((f) => `${f.year} ${f.tournament} ${f.place}`)).toEqual(
      expect.arrayContaining(["2009 Barkley Finalist", "2009 NDCA Semifinalist"]),
    )
  })

  it("counts Cal Invitational (UC Berkeley) LD and PF finals", () => {
    const lists = buildHsAllTimeTeams({ toc: [], ndca: [], barkley: [] })
    const wang = lists["Lincoln-Douglas"].find((t) => t.debaters === "Chris Wang")
    expect(wang?.finishes.map((f) => `${f.year} ${f.tournament} ${f.place}`)).toEqual(["2017 Cal Champion"])
    const cisse = lists["Lincoln-Douglas"].find((t) => t.debaters === "Sekou Cisse")
    expect(cisse?.finishes.map((f) => f.place).sort()).toEqual(["Finalist", "Top speaker"])
    expect(lists["Public Forum"].some((t) => t.lastNames === "Zhu & Chen")).toBe(true)
    expect(lists.Policy).toHaveLength(0)
  })

  it("adds each debater's own college points in full, high school part left out", () => {
    const row = (team: string, total: number, highSchool: number, highSchoolOnly?: true) =>
      ({ key: team, school: "Northwestern University (IL)", team, total, parts: { highSchool }, highSchoolOnly }) as unknown as NdtPointsRow
    const college = collegeLookupFromNdt({
      debaters: [row("Matt Fisher", 120, 20), row("Stephanie Spies", 50, 10), row("Nobody Here", 40, 40, true)],
    })
    const lists = buildHsAllTimeTeams({
      toc: [],
      barkley: [],
      cal: [],
      ndca: [{ year: 2006, place: "Quarterfinalist", school: "Glenbrook North High School (IL)", competitors: "Matt Fisher & Stephanie Spies" }],
      college,
    })
    // An NDCA quarterfinal is 2.5 × 0.5; college counts 100 + 40 in full.
    expect(lists.Policy[0]).toMatchObject({ nationals: 1.25, collegeCredit: 140, total: 141.25 })
    expect(lists.Policy[0].college.map((c) => c.debater)).toEqual(["Matt Fisher", "Stephanie Spies"])
    expect(college("Nobody Here")).toBeNull()
  })

  it("counts results before 2000 at the college list's era multiplier", () => {
    const lists = buildHsAllTimeTeams({
      barkley: [],
      cal: [],
      ndca: [],
      toc: [{ year: 1997, event: "Policy", place: "Champion", school: "Caddo Magnet (LA)", competitors: "Andy Ryan & Kamal Ghali" }],
    })
    expect(lists.Policy[0].total).toBe(3)
  })

  it("ranks college careers above high school titles", () => {
    const row = (team: string, total: number) =>
      ({ key: team, school: "University of Michigan", team, total, parts: { highSchool: 0 } }) as unknown as NdtPointsRow
    const lists = buildHsAllTimeTeams({
      barkley: [],
      cal: [],
      ndca: [],
      toc: [
        { year: 2021, event: "Policy", place: "Champion", school: "Alpha (CA)", competitors: "Ann One & Bea Two" },
        { year: 2021, event: "Policy", place: "Top speaker", school: "Alpha (CA)", competitors: "Ann One" },
        { year: 2019, event: "Policy", place: "Runner-up", school: "Beta (FL)", competitors: "Cal Three & Dee Four" },
      ],
      college: collegeLookupFromNdt({ debaters: [row("Cal Three", 85)] }),
    })
    expect(lists.Policy.map((t) => t.lastNames)).toEqual(["Three & Four", "One & Two"])
  })

  it("finds a school's Barkley Forum results by its circuit name", () => {
    const woodward = findBarkleySchoolResults("Woodward Academy (GA)")
    expect(woodward.filter((r) => r.place === "Champion").map((r) => r.year)).toEqual([2002, 2003])
    expect(findBarkleySchoolResults("Durham Academy").map((r) => r.place)).toEqual(["Finalist"])
    expect(findBarkleySchoolResults("Nowhere High")).toEqual([])
  })
})
