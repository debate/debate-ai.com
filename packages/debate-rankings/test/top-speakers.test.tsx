import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { AllTimeRankingsView } from "../src/leaderboard/AllTimeRankingsView"
import { TopSpeakersList } from "../src/leaderboard/TopSpeakersList"
import { buildHsAllTimeTeams } from "../src/leaderboard/profile/hsAllTimeTeams"
import { buildHsTopSpeakers, buildNdtTopSpeakers, hsTopSpeakers, TOP_SPEAKERS_LIMIT } from "../src/leaderboard/profile/topSpeakers"
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

  it("limits the list to ten and links speakers to their team when it is known", () => {
    const toc = Array.from({ length: 12 }, (_, i) => ({
      year: 2000 + i,
      event: "Policy" as const,
      place: "Top speaker" as const,
      school: "Big School (TX)",
      competitors: `First${String.fromCharCode(65 + i)} Last${String.fromCharCode(65 + i)}`,
    }))
    expect(buildHsTopSpeakers({ ...none, toc }).Policy).toHaveLength(TOP_SPEAKERS_LIMIT)

    const sources = {
      ...none,
      toc: [
        { year: 2021, event: "Policy" as const, place: "Champion" as const, school: "Bellarmine College Preparatory (CA)", competitors: "Adarsh Hiremath & Surya Midha" },
        { year: 2021, event: "Policy" as const, place: "Top speaker" as const, school: "Bellarmine College Preparatory (CA)", competitors: "Surya Midha" },
      ],
    }
    const teams = buildHsAllTimeTeams(sources)
    expect(buildHsTopSpeakers({ ...sources, teams }).Policy![0].teamName).toBe("Adarsh Hiremath & Surya Midha")
    expect(buildHsTopSpeakers(sources).Policy![0].teamName).toBeUndefined()
  })

  it("has speaker awards for every high school event in the bundled history", () => {
    const lists = hsTopSpeakers()
    for (const event of ["Policy", "Lincoln-Douglas", "Public Forum"] as const) {
      expect(lists[event]!.length).toBe(TOP_SPEAKERS_LIMIT)
      expect(lists[event]![0].rank).toBe(1)
      expect(lists[event]![0].topSpeakerAwards).toBeGreaterThanOrEqual(lists[event]![9].topSpeakerAwards)
    }
    // Lincoln-Douglas debaters are a team of one, so each links to their own page.
    expect(lists["Lincoln-Douglas"]!.every((s) => s.teamName === s.name)).toBe(true)
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

describe("Top 10 speaker awards card", () => {
  it("lists each debater with awards, links their team, school and logo", () => {
    const html = renderToStaticMarkup(
      <TopSpeakersList
        format="high school Policy"
        speakers={[
          {
            rank: 1,
            name: "Surya Midha",
            school: "Bellarmine College Preparatory",
            teamName: "Adarsh Hiremath & Surya Midha",
            topSpeakerAwards: 2,
            points: 8,
            tournaments: ["TOC", "NDCA"],
            firstYear: 2021,
            lastYear: 2021,
            awards: [
              { tournament: "NDCA", year: 2021, rank: 1, label: "Top speaker", points: 4 },
              { tournament: "TOC", year: 2021, rank: 1, label: "Top speaker", points: 4 },
            ],
          },
        ]}
      />,
    )
    expect(html).toContain("Top 10 speaker awards · high school Policy")
    expect(html).toContain("Surya Midha")
    expect(html).toContain("2021 NDCA · 2021 TOC")
    expect(html).toContain("top speakers")
    expect(html).toContain('href="/@bellarmine-college-preparatory"')
    expect(html).toMatch(/href="\/@[a-z-]*midha[a-z-]*"/)
  })

  it("renders nothing for a format without awards", () => {
    expect(renderToStaticMarkup(<TopSpeakersList format="x" speakers={[]} />)).toBe("")
    expect(renderToStaticMarkup(<TopSpeakersList format="x" speakers={undefined} />)).toBe("")
  })

  it("shows on each high school event's all-time Teams view, and not on Schools", () => {
    for (const division of ["VCX", "VLD", "VPF"] as const) {
      const html = renderToStaticMarkup(<AllTimeRankingsView division={division} />)
      expect(html).toContain("Top 10 speaker awards")
      expect(html.match(/data-top-speaker="true"/g)).toHaveLength(TOP_SPEAKERS_LIMIT)
    }
    expect(renderToStaticMarkup(<AllTimeRankingsView division="VCX" view="schools" />)).not.toContain("Top 10 speaker awards")
  })
})
