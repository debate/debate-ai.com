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
import { teamHref } from "../src/leaderboard/profile/rankingProfileHelpers"
import { findBarkleySchoolResults } from "../src/sync/barkley-champions"
import type { NdtPointsRow } from "../src/leaderboard/profile/ndtAllSeasons"

describe("greatest high school teams of all time", () => {
  it("scores TOC and NDCA finishes per team, with top speakers joining their pair", () => {
    const lists = buildHsAllTimeTeams({
      barkley: [],
      cal: [],
      glenbrooks: [],
      toc: [
        { year: 2021, event: "Policy", place: "Champion", school: "Bellarmine College Preparatory (CA)", competitors: "Adarsh Hiremath & Surya Midha" },
        { year: 2021, event: "Policy", place: "Top speaker", school: "Bellarmine College Preparatory (CA)", competitors: "Surya Midha" },
        { year: 2020, event: "Public Forum", place: "Top speaker", school: "Somewhere", competitors: "Solo Speaker" },
      ],
      ndca: [{ year: 2021, place: "Champion", school: "Bellarmine College Preparatory", competitors: "Surya Midha & Adarsh Hiremath" }],
    })
    expect(lists.Policy).toHaveLength(1)
    // GOAT high school points (TOC title 10, top speaker 4, NDCA title 10) at 1.5×.
    expect(lists.Policy[0]).toMatchObject({ rank: 1, total: 36, titles: 2, lastNames: "Hiremath & Midha", school: "Bellarmine College Preparatory" })
    // A pair event's speaker with no recorded pair isn't credited.
    expect(lists["Public Forum"]).toHaveLength(0)
  })

  it("merges a team whose debater a source names without a first name", () => {
    const lists = buildHsAllTimeTeams({
      barkley: [],
      cal: [],
      glenbrooks: [],
      toc: [
        { year: 2007, event: "Policy", place: "Runner-up", school: "The Westminster Schools (GA)", competitors: "Stephen Weil & Sanjena Anshu Sathian" },
        { year: 2007, event: "Policy", place: "Top speaker", school: "The Westminster Schools (GA)", competitors: "Stephen Weil" },
      ],
      ndca: [
        { year: 2007, place: "Champion", school: "Westminster Schools", competitors: "Anshu Sathian & Stephen Weil" },
        { year: 2007, place: "Top speaker", school: "Westminster Schools", competitors: "Anshu Sathian" },
      ],
    })
    expect(lists.Policy).toHaveLength(1)
    expect(lists.Policy[0]).toMatchObject({ debaters: "Stephen Weil & Sanjena Anshu Sathian", school: "The Westminster Schools", titles: 1 })
    expect(lists.Policy[0].finishes.map((f) => `${f.tournament} ${f.place}`).sort()).toEqual([
      "NDCA Champion",
      "NDCA Top speaker",
      "TOC Runner-up",
      "TOC Top speaker",
    ])
  })

  it("keeps different debaters apart: other first names, other schools", () => {
    const lists = buildHsAllTimeTeams({
      barkley: [],
      cal: [],
      glenbrooks: [],
      ndca: [],
      toc: [
        { year: 2010, event: "Policy", place: "Champion", school: "Harvard-Westlake (CA)", competitors: "Ann Lee & Bo Park" },
        { year: 2011, event: "Policy", place: "Champion", school: "Harvard-Westlake (CA)", competitors: "Cy Lee & Bo Park" },
        { year: 2012, event: "Policy", place: "Champion", school: "Harvard (MA)", competitors: "Ann Lee & Bo Park" },
      ],
    })
    expect(lists.Policy).toHaveLength(3)
  })

  it("ranks the 2007 Westminster team once in the bundled history", () => {
    const westminster = hsAllTimeTeams().Policy.filter((t) => t.schoolKey === "westminster" && /Weil/.test(t.debaters) && /Sathian/.test(t.debaters))
    expect(westminster).toHaveLength(1)
    expect(westminster[0].debaters).toBe("Stephen Weil & Sanjena Anshu Sathian")
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

  it("links every listed team name to its team page, footnotes and college partners intact", () => {
    const lists = hsAllTimeTeams()
    const html = renderToStaticMarkup(
      <HsAllTimeTeamsRankings lists={lists} schoolKey={null} collegeLoaded={false} event="Policy" />,
    )
    const shown = lists.Policy.slice(0, 100)
    expect(shown).toHaveLength(100)
    const rows = html.split("<li ").slice(1)
    expect(rows).toHaveLength(100)
    shown.forEach((team, i) => {
      const href = teamHref({ school: team.school, name: team.debaters })
      expect(rows[i]).toContain(`href="${href}"`)
      expect(rows[i]).toMatch(new RegExp(`<a [^>]*href="${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>${team.debaters.replace(/&/g, "&amp;")}</a>`))
    })
    const noted = shown.find((team) => team.notes.length > 0)
    expect(noted).toBeDefined()
    expect(html).toContain(noted!.notes.join(" · ").replace(/&/g, "&amp;"))
  })

  it("links the pinned best-of-school row too", () => {
    const lists = hsAllTimeTeams()
    const best = lists.Policy.find((team) => team.rank > 3 && lists.Policy.find((t) => t.schoolKey === team.schoolKey) === team)!
    expect(best).toBeDefined()
    const html = renderToStaticMarkup(
      <HsAllTimeTeamsRankings lists={lists} schoolKey={best.schoolKey} collegeLoaded={false} event="Policy" limit={3} />,
    )
    expect(html).toContain("This school&#x27;s best in Policy")
    const pinned = html.split("This school&#x27;s best in Policy")[1]
    expect(pinned).toContain(`href="${teamHref({ school: best.school, name: best.debaters })}"`)
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
      notes: [],
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
    const lists = buildHsAllTimeTeams({ toc: [], ndca: [], glenbrooks: [] })
    const krishnan = lists["Lincoln-Douglas"].find((t) => t.debaters === "Shruthi Krishnan")
    expect(krishnan?.finishes.map((f) => f.tournament)).toEqual(["Barkley"])
    expect(lists.Policy.find((t) => t.lastNames === "Howard & Li")?.total).toBe(15)
    const stMarks = hsAllTimeTeams().Policy.find((t) => t.lastNames === "Gulakov & Miles")
    expect(stMarks?.finishes.map((f) => `${f.year} ${f.tournament} ${f.place}`)).toEqual(
      expect.arrayContaining(["2009 Barkley Finalist", "2009 NDCA Semifinalist"]),
    )
  })

  it("counts Glenbrooks Policy, LD and PF finals, merging name variants with the TOC", () => {
    const lists = buildHsAllTimeTeams({ ndca: [], barkley: [], cal: [] })
    // "Anshu Sathian" at the Glenbrooks is "Sanjena Anshu Sathian" at the TOC: one team.
    const westminster = lists.Policy.filter((t) => t.lastNames === "Jegadeesh & Sathian" || t.lastNames === "Sathian & Jegadeesh")
    expect(westminster).toHaveLength(1)
    expect(westminster[0].finishes.map((f) => `${f.year} ${f.tournament} ${f.place}`)).toEqual(
      expect.arrayContaining(["2008 Glenbrooks Champion", "2009 TOC Champion"]),
    )
    const nebel = lists["Lincoln-Douglas"].find((t) => t.debaters === "Jake Nebel")
    expect(nebel?.finishes.filter((f) => f.tournament === "Glenbrooks").map((f) => f.year)).toEqual([2007, 2008])
    expect(lists["Public Forum"].some((t) => t.lastNames === "Oestericher & Silver")).toBe(true)
    // Team codes and surname-only rows credit no one.
    expect(lists.Policy.some((t) => t.lastNames === "Andrew & Balakrishnan")).toBe(false)
  })

  it("counts Cal Invitational (UC Berkeley) LD and PF finals", () => {
    const lists = buildHsAllTimeTeams({ toc: [], ndca: [], barkley: [], glenbrooks: [] })
    const wang = lists["Lincoln-Douglas"].find((t) => t.debaters === "Chris Wang")
    expect(wang?.finishes.map((f) => `${f.year} ${f.tournament} ${f.place}`)).toEqual(["2017 Cal Champion"])
    const cisse = lists["Lincoln-Douglas"].find((t) => t.debaters === "Sekou Cisse")
    expect(cisse?.finishes.map((f) => f.place).sort()).toEqual(["Finalist", "Top speaker"])
    expect(lists["Public Forum"].some((t) => t.lastNames === "Zhu & Chen")).toBe(true)
    expect(lists.Policy).toHaveLength(0)
  })

  it("adds each debater's own college points at the college share, high school part left out", () => {
    const row = (team: string, total: number, highSchool: number, highSchoolOnly?: true) =>
      ({ key: team, school: "Northwestern University (IL)", team, total, parts: { highSchool }, highSchoolOnly }) as unknown as NdtPointsRow
    const college = collegeLookupFromNdt({
      debaters: [row("Matt Fisher", 120, 20), row("Stephanie Spies", 50, 10), row("Nobody Here", 40, 40, true)],
    })
    const lists = buildHsAllTimeTeams({
      toc: [],
      barkley: [],
      cal: [],
      glenbrooks: [],
      ndca: [{ year: 2006, place: "Quarterfinalist", school: "Glenbrook North High School (IL)", competitors: "Matt Fisher & Stephanie Spies" }],
      college,
    })
    // An NDCA quarterfinal is 2.5 × 1.5; college counts (100 + 40) × 0.35.
    expect(lists.Policy[0]).toMatchObject({ nationals: 3.75, collegeCredit: 49, total: 52.75 })
    expect(lists.Policy[0].college.map((c) => c.debater)).toEqual(["Matt Fisher", "Stephanie Spies"])
    expect(college("Nobody Here")).toBeNull()
  })

  it("counts results before 2000 at the college list's era multiplier", () => {
    const lists = buildHsAllTimeTeams({
      barkley: [],
      cal: [],
      glenbrooks: [],
      ndca: [],
      toc: [{ year: 1997, event: "Policy", place: "Champion", school: "Caddo Magnet (LA)", competitors: "Andy Ryan & Kamal Ghali" }],
    })
    // Champion 10 × 1.5 × 0.6 era.
    expect(lists.Policy[0].total).toBe(9)
  })

  it("lets a strong high school title outweigh a modest college career", () => {
    const row = (team: string, total: number) =>
      ({ key: team, school: "University of Michigan", team, total, parts: { highSchool: 0 } }) as unknown as NdtPointsRow
    const lists = buildHsAllTimeTeams({
      barkley: [],
      cal: [],
      glenbrooks: [],
      ndca: [],
      toc: [
        { year: 2021, event: "Policy", place: "Champion", school: "Alpha (CA)", competitors: "Ann One & Bea Two" },
        { year: 2021, event: "Policy", place: "Top speaker", school: "Alpha (CA)", competitors: "Ann One" },
        { year: 2019, event: "Policy", place: "Runner-up", school: "Beta (FL)", competitors: "Cal Three & Dee Four" },
      ],
      college: collegeLookupFromNdt({ debaters: [row("Cal Three", 14)] }),
    })
    // TOC title+speaker 21 vs runner-up 9 + college 4.9 → Alpha ranks first.
    expect(lists.Policy.map((t) => t.lastNames)).toEqual(["One & Two", "Three & Four"])
  })

  it("merges Deshpande/Desphande and reversed Batra/Miles spellings", () => {
    const lists = hsAllTimeTeams()
    const deshpande = lists.Policy.filter((t) => /Deshpande|Desphande/i.test(t.debaters) && /Weil/.test(t.debaters))
    expect(deshpande).toHaveLength(1)
    expect(deshpande[0].debaters).toMatch(/Deshpande/)
    expect(deshpande[0].finishes.some((f) => f.year === 2004)).toBe(true)
    expect(deshpande[0].finishes.some((f) => f.year === 2005)).toBe(true)
    const batraMiles = lists.Policy.filter((t) => /Batra/i.test(t.debaters) && /Miles/i.test(t.debaters))
    expect(batraMiles).toHaveLength(1)
    expect(batraMiles[0].finishes.map((f) => `${f.year} ${f.tournament} ${f.place}`).sort()).toEqual([
      "2010 Glenbrooks Champion",
      "2010 TOC Runner-up",
    ])
  })

  it("folds a debater's 3rd+ partnership into the top two with footnotes", () => {
    const lists = hsAllTimeTeams()
    const weil = lists.Policy.filter((t) => t.schoolKey === "westminster" && /Weil/.test(t.debaters))
    expect(weil.length).toBe(2)
    expect(weil.some((t) => /McLaurin/.test(t.debaters))).toBe(false)
    expect(weil.every((t) => t.notes.some((n) => /McLaurin/.test(n) && /Glenbrooks Champion/.test(n)))).toBe(true)
  })

  it("finds a school's Barkley Forum results by its circuit name", () => {
    const woodward = findBarkleySchoolResults("Woodward Academy (GA)")
    expect(woodward.filter((r) => r.place === "Champion").map((r) => r.year)).toEqual([2002, 2003])
    expect(findBarkleySchoolResults("Durham Academy").map((r) => r.place)).toEqual(["Finalist"])
    expect(findBarkleySchoolResults("Nowhere High")).toEqual([])
  })
})
