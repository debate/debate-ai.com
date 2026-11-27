import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { AllTimeRankingsView } from "../src/leaderboard/AllTimeRankingsView"
import { TeamSpeakerAwards } from "../src/leaderboard/TeamSpeakerAwards"
import { HsAllTimeTeamsRankings } from "../src/leaderboard/profile/ProfileHsAllTimeTeams"
import { NdtAllSeasonsRankings } from "../src/leaderboard/profile/NdtAllSeasonsDialog"
import { hsAllTimeTeams } from "../src/leaderboard/profile/hsAllTimeTeams"
import { buildHsTopSpeakers, buildNdtTopSpeakers, hsTeamSpeakers, hsTopSpeakers, ndtTeamSpeakers } from "../src/leaderboard/profile/topSpeakers"
import type { NdtSchoolHistory } from "../src/sync/ndt-school-history"

const none = { toc: [], ndca: [], barkley: [], cal: [], glenbrooks: [] }

describe("high school top speaker awards", () => {
  it("ranks debaters by top speaker awards across tournaments, matching name variants", () => {
    const lists = buildHsTopSpeakers({
      ...none,
      toc: [
        { year: 2007, event: "Policy", place: "Top speaker", school: "The Westminster Schools (GA)", competitors: "Sanjena Anshu Sathian" },
        { year: 2008, event: "Policy", place: "Top speaker", school: "Hillsboro", competitors: "Mary Thompson" },
        { year: 2005, event: "Policy", place: "Champion", school: "Hillsboro", competitors: "Mary Thompson & Pat Lee" },
      ],
      ndca: [
        { year: 2007, place: "Top speaker", school: "Westminster Schools", competitors: "Anshu Sathian" },
        { year: 2010, place: "Speaker", rank: 3, school: "Hillsboro", competitors: "Mary Thompson" },
      ],
      glenbrooks: [{ year: 2005, event: "Policy", place: "Top speaker", school: "The Westminster Schools (GA)", competitors: "Sanjena Anshu Sathian" }],
    })
    const policy = lists.Policy!
    expect(policy.map((s) => [s.rank, s.name, s.topSpeakerAwards])).toEqual([
      [1, "Sanjena Anshu Sathian", 3],
      [2, "Mary Thompson", 1],
    ])
    expect(policy[0]).toMatchObject({ school: "The Westminster Schools", firstYear: 2005, lastYear: 2007, tournaments: ["Glenbrooks", "NDCA", "TOC"] })
    expect(policy[0].awards.map((a) => `${a.year} ${a.tournament} ${a.label}`)).toEqual([
      "2005 Glenbrooks Top speaker",
      "2007 NDCA Top speaker",
      "2007 TOC Top speaker",
    ])
    // A lower speaker place is kept as an award but isn't a top speaker award.
    expect(policy[1].awards.map((a) => a.label)).toEqual(["Top speaker", "3rd speaker"])
    expect(policy[1].points).toBeGreaterThan(4)
    expect(lists["Lincoln-Douglas"]).toBeUndefined()
    expect(lists["Public Forum"]).toBeUndefined()
  })

  it("breaks ties by speaker points, tournaments, recency, then shares equal ranks", () => {
    const row = (year: number, competitors: string, school = "A") => ({ year, event: "Lincoln-Douglas" as const, place: "Top speaker" as const, school, competitors })
    const lists = buildHsTopSpeakers({
      ...none,
      toc: [row(2010, "Old Timer"), row(2020, "Recent Kid"), row(2012, "Points Guy"), row(2017, "Same Tourney"), row(2018, "Same Tourney")],
      ndca: [{ year: 2011, event: "Lincoln-Douglas", place: "Speaker", rank: 2, school: "A", competitors: "Points Guy" }],
      cal: [row(2018, "Wide Range"), row(2019, "Twin One", "B"), row(2019, "Twin Two", "C")] as never,
      barkley: [row(2014, "Wide Range")] as never,
    })
    const ld = lists["Lincoln-Douglas"]!
    expect(ld.map((s) => [s.rank, s.name])).toEqual([
      [1, "Wide Range"],
      [2, "Same Tourney"],
      [3, "Points Guy"],
      [4, "Recent Kid"],
      [5, "Twin One"],
      [5, "Twin Two"],
      [7, "Old Timer"],
    ])
  })

  it("credits both of a shared award and skips rows with only surnames", () => {
    const lists = buildHsTopSpeakers({
      ...none,
      toc: [
        { year: 1972, event: "Policy", place: "Top speaker", school: "Marquette University High School", competitors: "Jeff Clark, Mark Foley" },
        { year: 1973, event: "Policy", place: "Top speaker", school: "Marquette University High School", competitors: "Clark", partialNames: true },
      ],
    })
    expect(lists.Policy!.map((s) => s.name).sort()).toEqual(["Jeff Clark", "Mark Foley"])
    expect(lists.Policy!.every((s) => s.topSpeakerAwards === 1)).toBe(true)
  })

  it("lists every debater with awards unless a limit is given", () => {
    const toc = Array.from({ length: 12 }, (_, i) => ({
      year: 2000 + i,
      event: "Policy" as const,
      place: "Top speaker" as const,
      school: "Big School (TX)",
      competitors: `First${String.fromCharCode(65 + i)} Last${String.fromCharCode(65 + i)}`,
    }))
    expect(buildHsTopSpeakers({ ...none, toc }).Policy).toHaveLength(12)
    expect(buildHsTopSpeakers({ ...none, toc, limit: 10 }).Policy).toHaveLength(10)
  })

  it("finds a team's debaters' awards in ranking order, matching name variants", () => {
    const lists = buildHsTopSpeakers({
      ...none,
      toc: [
        { year: 2021, event: "Policy", place: "Top speaker", school: "Bellarmine College Preparatory (CA)", competitors: "Surya Midha" },
        { year: 2022, event: "Policy", place: "Top speaker", school: "Bellarmine College Preparatory (CA)", competitors: "Adarsh Hiremath" },
        { year: 2023, event: "Policy", place: "Top speaker", school: "Bellarmine College Preparatory (CA)", competitors: "Adarsh Hiremath" },
        { year: 2021, event: "Policy", place: "Top speaker", school: "Other School", competitors: "Surya Midha" },
      ],
    })
    const team = { schoolKey: lists.Policy![0].schoolKey, debaters: "Surya Midha & Adarsh Hiremath" }
    expect(hsTeamSpeakers(lists.Policy, team).map((s) => [s.name, s.topSpeakerAwards])).toEqual([
      ["Adarsh Hiremath", 2],
      ["Surya Midha", 1],
    ])
    expect(hsTeamSpeakers(lists.Policy, { ...team, debaters: "Someone Else & Nobody Here" })).toEqual([])
    expect(hsTeamSpeakers(undefined, team)).toEqual([])
  })

  it("has speaker awards for every high school event in the bundled history", () => {
    const lists = hsTopSpeakers()
    for (const event of ["Policy", "Lincoln-Douglas", "Public Forum"] as const) {
      expect(lists[event]!.length).toBeGreaterThan(10)
      expect(lists[event]![0].rank).toBe(1)
      expect(lists[event]![0].topSpeakerAwards).toBeGreaterThanOrEqual(lists[event]![9].topSpeakerAwards)
    }
  })
})

describe("NDT top speaker awards", () => {
  const school = (name: string, speakerAwards: NdtSchoolHistory["speakerAwards"]): NdtSchoolHistory => ({
    school: name,
    years: [],
    elims: [],
    championships: [],
    atLargeBids: [],
    copelandWinners: [],
    speakerAwards,
    coachingAwards: [],
  })

  it("ranks by first place awards, then speaker points", () => {
    const list = buildNdtTopSpeakers([
      school("Baylor University (TX)", [
        { year: 1986, speaker: "Lyn Robbins", rank: 1 },
        { year: 1987, speaker: "Lyn Robbins", rank: 1 },
        { year: 1985, speaker: "Lyn Robbins", rank: 3 },
        { year: 1990, speaker: "One Hit", rank: 1 },
        { year: 1991, speaker: "Many Places", rank: 2 },
        { year: 1992, speaker: "Many Places", rank: 4 },
        { year: 1993, speaker: "Many Places", rank: 6 },
      ]),
    ])
    expect(list.map((s) => [s.rank, s.name, s.topSpeakerAwards, s.points])).toEqual([
      [1, "Lyn Robbins", 2, 25],
      [2, "One Hit", 1, 10],
      [3, "Many Places", 0, 13],
    ])
    expect(list[0].awards.map((a) => `${a.year} ${a.label}`)).toEqual(["1985 3rd speaker", "1986 Top speaker", "1987 Top speaker"])
  })

  it("is empty without speaker awards", () => {
    expect(buildNdtTopSpeakers([school("Nowhere", [])])).toEqual([])
  })
})

describe("NDT team speaker awards", () => {
  it("matches a team's debaters at their school", () => {
    const list = buildNdtTopSpeakers([
      {
        school: "Baylor University (TX)",
        years: [],
        elims: [],
        championships: [],
        atLargeBids: [],
        copelandWinners: [],
        speakerAwards: [{ year: 1986, speaker: "Lyn Robbins", rank: 1 }],
        coachingAwards: [],
      },
    ])
    expect(ndtTeamSpeakers(list, { school: "Baylor University (TX)", team: "Lyn Robbins & Pat Lee" }).map((s) => s.name)).toEqual(["Lyn Robbins"])
    expect(ndtTeamSpeakers(list, { school: "Baylor University (TX)", team: "Lyn Robbins" })).toHaveLength(1)
    expect(ndtTeamSpeakers(list, { school: "Other (TX)", team: "Lyn Robbins & Pat Lee" })).toEqual([])
    expect(ndtTeamSpeakers(list, { school: "Baylor University (TX)", team: "" })).toEqual([])
  })
})

describe("team speaker awards on the GOAT listings", () => {
  const speaker = {
    rank: 1,
    name: "Surya Midha",
    school: "Bellarmine College Preparatory",
    schoolKey: "bellarmine",
    topSpeakerAwards: 2,
    points: 8,
    tournaments: ["TOC", "NDCA"] as ("TOC" | "NDCA")[],
    firstYear: 2021,
    lastYear: 2021,
    awards: [
      { tournament: "NDCA" as const, year: 2021, rank: 1, label: "Top speaker", points: 4 },
      { tournament: "TOC" as const, year: 2021, rank: 1, label: "Top speaker", points: 4 },
    ],
  }

  it("lists the debater's awards, count and a link to the team", () => {
    const html = renderToStaticMarkup(<TeamSpeakerAwards speakers={[speaker]} href="/@team-page" />)
    expect(html).toContain("Surya Midha")
    expect(html).toContain("2021 NDCA · 2021 TOC")
    expect(html).toContain("2 top speakers")
    expect(html).toContain('href="/@team-page"')
  })

  it("shows lower places and renders nothing without awards", () => {
    const lower = { ...speaker, topSpeakerAwards: 0, awards: [{ tournament: "TOC" as const, year: 2019, rank: 3, label: "3rd speaker", points: 2 }] }
    expect(renderToStaticMarkup(<TeamSpeakerAwards speakers={[lower]} />)).toContain("2019 TOC 3rd, 1 speaker award")
    expect(renderToStaticMarkup(<TeamSpeakerAwards speakers={[]} href="/x" />)).toBe("")
  })

  it("is inline on each high school event's team rows, with no separate section", () => {
    for (const division of ["VCX", "VLD", "VPF"] as const) {
      const html = renderToStaticMarkup(<AllTimeRankingsView division={division} />)
      expect(html).not.toContain("Top 10 speaker awards")
      expect(html).not.toContain("data-top-speaker=")
      expect(html).toContain("data-team-speakers")
      expect(html).toContain("top speaker")
    }
    expect(renderToStaticMarkup(<AllTimeRankingsView division="VCX" view="schools" />)).not.toContain("data-team-speakers")
  })

  it("links each team row's school and shows speakers only on teams that have them", () => {
    const lists = hsAllTimeTeams()
    const html = renderToStaticMarkup(
      <HsAllTimeTeamsRankings lists={lists} schoolKey={null} collegeLoaded event="Policy" limit={5} />,
    )
    expect(html.match(/<li[ >]/g)).toHaveLength(5)
    expect(html).toMatch(/href="\/@[^"]+"[^>]*>[^<]+<\/a> · /)
  })

  it("is inline on the NDT team rows", () => {
    const history: NdtSchoolHistory[] = [
      {
        school: "Baylor University (TX)",
        years: [],
        elims: [{ year: 1986, team: "Lyn Robbins & Pat Lee", round: "Finals" }],
        championships: [],
        atLargeBids: [],
        copelandWinners: [],
        speakerAwards: [{ year: 1986, speaker: "Lyn Robbins", rank: 1 }],
        coachingAwards: [],
      },
    ]
    const html = renderToStaticMarkup(<NdtAllSeasonsRankings history={history} titleId="t" tab="teams" />)
    expect(html).toContain("data-team-speakers")
    expect(html).toContain("1986 NDT")
    expect(html).toContain("1 top speaker")
  })
})
