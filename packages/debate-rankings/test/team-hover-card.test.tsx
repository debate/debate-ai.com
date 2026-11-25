// @vitest-environment jsdom
/**
 * @fileoverview The team stats hover card: how it names a team for the
 * all-time lookups, its badges, its high school all-time match, and that a
 * label only becomes a hover trigger when asked (and the rank badge then
 * drops its own tooltip).
 */

import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import type { HsAllTimeEvent, HsAllTimeTeam } from "../src/leaderboard/profile/hsAllTimeTeams"
import { TeamCodeLabel } from "../src/leaderboard/team-label/TeamLabel"
import {
  findHsAllTimeTeam,
  teamHoverBadges,
  teamHoverCode,
  teamHoverYear,
} from "../src/leaderboard/team-label/teamHoverStats"

const hsTeam = (over: Partial<HsAllTimeTeam>): HsAllTimeTeam => ({
  rank: 5,
  event: "Policy",
  school: "Glenbrook North",
  schoolKey: "glenbrook north",
  sourceSchool: "Glenbrook North (IL)",
  debaters: "Ann Lee & Bo Kim",
  lastNames: "Lee & Kim",
  firstYear: 2010,
  lastYear: 2012,
  total: 100,
  nationals: 100,
  collegeCredit: 0,
  titles: 1,
  finishes: [{ tournament: "TOC", year: 2012, place: "Champion", points: 50 }],
  college: [],
  ...over,
})

describe("teamHoverCode", () => {
  it("keeps a code label", () => {
    expect(teamHoverCode({ label: "Harker LL" })).toBe("Harker LL")
  })
  it("builds school + initials from the rankings row", () => {
    expect(teamHoverCode({ ranking: { school: "Northwestern", name: "Miles & Vail" } })).toBe("Northwestern MV")
  })
  it("uses label initials as given", () => {
    expect(teamHoverCode({ school: "Harker", debaters: "LL" })).toBe("Harker LL")
  })
  it("is null with nothing to go on", () => {
    expect(teamHoverCode({ school: "Harker" })).toBeNull()
  })
})

describe("teamHoverYear", () => {
  it("prefers the round year, then a past row's season", () => {
    expect(teamHoverYear({ year: 2019, ranking: { school: "a", name: "b", season: 2015 } })).toBe(2019)
    expect(teamHoverYear({ ranking: { school: "a", name: "b", season: 2015 } })).toBe(2015)
    expect(teamHoverYear({})).toBeNull()
  })
})

describe("teamHoverBadges", () => {
  it("crowns #1 and gives the GOAT medal to an all-time top pair", () => {
    const badges = teamHoverBadges({
      ranking: { school: "a", name: "b", rank: 1, tocBids: ["x", "y"] },
      ndt: { school: "a", team: { name: "b", rank: 3, of: 900, total: 10, mode: "teams" }, debaters: [] },
    })
    expect(badges.map((b) => b.label)).toEqual(["👑 #1 team", "🎖️ GOAT #3", "2 TOC bids"])
  })
  it("names a GOAT debater when the pair is not top-ranked", () => {
    const badges = teamHoverBadges({
      ndt: { school: "a", team: { name: "b", rank: 200, of: 900, total: 1, mode: "strict" }, debaters: [{ name: "Ann Lee", rank: 2, of: 2000, total: 9 }] },
    })
    expect(badges.map((b) => b.label)).toEqual(["🎖️ GOAT debater #2"])
  })
  it("adds high school titles and a top-10 badge", () => {
    const badges = teamHoverBadges({ ranking: { school: "a", name: "b", rank: 7 }, hs: hsTeam({ rank: 40, titles: 2 }) })
    expect(badges.map((b) => b.label)).toEqual(["Top 10", "🏆 2 titles"])
  })
})

describe("findHsAllTimeTeam", () => {
  const lists = (teams: HsAllTimeTeam[]) =>
    ({ Policy: teams, "Lincoln-Douglas": [], "Public Forum": [] }) as Record<HsAllTimeEvent, HsAllTimeTeam[]>

  it("matches by school and initials in either order", () => {
    const team = hsTeam({})
    expect(findHsAllTimeTeam(lists([team]), { label: "Glenbrook North KL" })).toBe(team)
  })
  it("skips a pair from a different era when the year is known", () => {
    expect(findHsAllTimeTeam(lists([hsTeam({})]), { label: "Glenbrook North LK", year: 2024 })).toBeNull()
  })
  it("never looks up a college", () => {
    expect(findHsAllTimeTeam(lists([hsTeam({ school: "Harvard University", schoolKey: "harvard university", sourceSchool: "Harvard University" })]), { label: "Harvard University LK" })).toBeNull()
  })
})

describe("TeamCodeLabel hover card", () => {
  const ranking = { school: "Harker", name: "Le & Luo", rank: 4, adjustedRating: 90, matches: 30 }
  it("makes the pill a hover trigger and drops the rank badge's own tooltip", () => {
    const html = renderToStaticMarkup(<TeamCodeLabel label="Harker LL" ranking={ranking} side="aff" showRank />)
    expect(html).toContain('data-state="closed"')
    expect(html.match(/data-state=/g)).toHaveLength(1)
    expect(html).toContain("#4")
  })
  it("can be turned off, keeping the badge tooltip", () => {
    const html = renderToStaticMarkup(<TeamCodeLabel label="Harker LL" ranking={ranking} side="aff" showRank hoverCard={false} />)
    expect(html.match(/data-state=/g)).toHaveLength(1)
    expect(html).toMatch(/data-team-rank=""[^>]*data-state|data-state[^>]*data-team-rank/)
  })
})
