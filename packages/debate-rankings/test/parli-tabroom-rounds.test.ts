import { describe, expect, it } from "vitest"
import {
  applyBallotResults,
  elimStage,
  inferAdvancementResults,
  isElimLabel,
  isVarsityParliEvent,
  judgeName,
  parseCalendarDates,
  parseCircuitCalendar,
  parsePairings,
  parsePostingsIndex,
  seasonFromCalendarHeading,
  type ParliRound,
} from "../src/sync/parli-tabroom-rounds"

const CALENDAR = `<h4>2026-2027 Calendar</h4><table><tbody>
<tr><td></td><td>CA</td><td>Sat Nov 14–15, 2026</td><td>PD, NPD</td></tr>
<tr><td><a href="/index/tourn/index.mhtml?tourn_id=39001">Cal Parli Invitational</a></td><td>Berkeley, CA</td><td>Sat Nov 14–15, 2026</td><td>PD, NPD</td></tr>
<tr><td><a href="/index/tourn/index.mhtml?tourn_id=39002">Halloween Open</a></td><td>Boston, MA</td><td>Fri Oct 30–Nov 1, 2026</td><td>PD</td></tr>
</tbody></table>`

const POSTINGS = `<select id="eventSelector"><option value="5001">Open Parli</option><option value="5002">Novice Parli</option></select>
<div id="5001">
  <a href="/index/tourn/postings/round.mhtml?tourn_id=39001&round_id=7001">
    OP
    Round 1
  </a>
  <a href="/index/tourn/postings/round.mhtml?tourn_id=39001&round_id=7002">
    OP
    Semis
  </a>
</div>
<div id="5002"></div>`

const ROUND = `<table><tbody>
<tr>
  <td>Room 4</td>
  <td><a href="/x?entry_id=1">Nueva AW</a></td>
  <td><a href="/x?entry_id=2">Carlmont SC</a></td>
  <td><a href="/x?judge_id=9">Berg, Zach</a><a href="/x?judge_id=10">Li, Ann</a></td>
</tr>
<tr>
  <td>none</td>
  <td><a href="/x?entry_id=3">Albany BB</a><div>Locked Opp</div></td>
  <td><a href="/x?entry_id=4">King SS</a></td>
  <td><a href="/x?judge_id=11">Cho, Sam</a></td>
</tr>
<tr><td>Room 9</td><td><a href="/x?entry_id=5">Piedmont AS</a></td><td>BYE</td><td></td></tr>
</tbody></table>`

describe("calendar", () => {
  it("reads date ranges, including ones that span months", () => {
    expect(parseCalendarDates("Sat Nov 14–15, 2026")).toEqual({ start: "2026-11-14", end: "2026-11-15" })
    expect(parseCalendarDates("Fri Oct 30–Nov 1, 2026")).toEqual({ start: "2026-10-30", end: "2026-11-01" })
    expect(parseCalendarDates("Sat Sep 26, 2026")).toEqual({ start: "2026-09-26", end: "2026-09-26" })
    expect(parseCalendarDates("TBD")).toEqual({ start: null, end: null })
  })

  it("names the season and lists the tournaments", () => {
    expect(seasonFromCalendarHeading("2026-2027 Calendar")).toBe("2026-27")
    const { season, tournaments } = parseCircuitCalendar(CALENDAR)
    expect(season).toBe("2026-27")
    expect(tournaments.map((t) => [t.id, t.name, t.start, t.events])).toEqual([
      ["39001", "Cal Parli Invitational", "2026-11-14", ["PD", "NPD"]],
      ["39002", "Halloween Open", "2026-10-30", ["PD"]],
    ])
  })

  it("keeps varsity parli events and drops novice, JV and college ones", () => {
    expect(isVarsityParliEvent("Open Parli")).toBe(true)
    expect(isVarsityParliEvent("Varsity Parliamentary Debate")).toBe(true)
    expect(isVarsityParliEvent("Novice Parli")).toBe(false)
    expect(isVarsityParliEvent("JV Parli")).toBe(false)
    expect(isVarsityParliEvent("College Parli")).toBe(false)
    expect(isVarsityParliEvent("Lincoln Douglas")).toBe(false)
  })
})

describe("postings", () => {
  it("lists each event's rounds from the pairings index", () => {
    expect(parsePostingsIndex(POSTINGS)).toEqual([
      {
        id: "5001",
        name: "Open Parli",
        rounds: [
          { id: "7001", label: "Round 1" },
          { id: "7002", label: "Semis" },
        ],
      },
      { id: "5002", name: "Novice Parli", rounds: [] },
    ])
  })

  it("reads a round's rooms: sides, judges, locked sides, and no byes", () => {
    expect(parsePairings(ROUND)).toEqual([
      { gov: "Nueva AW", opp: "Carlmont SC", room: "Room 4", judges: ["Zach Berg", "Ann Li"] },
      { gov: "King SS", opp: "Albany BB", judges: ["Sam Cho"] },
    ])
    expect(parsePairings("<p>Not posted</p>")).toEqual([])
    expect(judgeName("Berg, Zach")).toBe("Zach Berg")
    expect(judgeName("Madonna")).toBe("Madonna")
  })
})

describe("elimination labels", () => {
  it("places rounds in a bracket, across tournaments' spellings", () => {
    expect(elimStage("Finals")).toEqual({ fromFinal: 0, track: "v" })
    expect(elimStage("Quarterfinals")).toEqual({ fromFinal: 2, track: "v" })
    expect(elimStage("Open Octos")).toEqual({ fromFinal: 3, track: "v" })
    expect(elimStage("VS")).toEqual({ fromFinal: 1, track: "v" })
    expect(elimStage("NQ")).toEqual({ fromFinal: 2, track: "n" })
    expect(elimStage("Novice Semis")).toEqual({ fromFinal: 1, track: "n" })
    expect(elimStage("O1")).toBeNull()
    expect(elimStage("Round 5")).toBeNull()
    expect(isElimLabel("Triples")).toBe(true)
    expect(isElimLabel("Round 1")).toBe(false)
  })
})

const pairing = (gov: string, opp: string, extra = {}) => ({ gov, opp, judges: [], ...extra })

describe("advancement results", () => {
  const rounds = (): ParliRound[] => [
    { id: "1", label: "Round 1", elim: false, pairings: [pairing("A", "B")] },
    { id: "2", label: "Quarters", elim: true, pairings: [pairing("A", "B"), pairing("C", "D"), pairing("E", "F")] },
    { id: "3", label: "Semis", elim: true, pairings: [pairing("A", "C")] },
    { id: "4", label: "Finals", elim: true, pairings: [pairing("A", "X")] },
    { id: "5", label: "NQ", elim: true, pairings: [pairing("N1", "N2")] },
    { id: "6", label: "NS", elim: true, pairings: [pairing("N2", "N3")] },
  ]

  it("reads who won an elim from who reached the next round of the same bracket", () => {
    const r = rounds()
    expect(inferAdvancementResults(r)).toBe(4)
    const quarters = r[1].pairings
    expect(quarters[0]).toMatchObject({ winner: "gov", resultSource: "advancement" })
    expect(quarters[1]).toMatchObject({ winner: "gov" })
    expect(quarters[2].winner).toBeUndefined()
    expect(r[2].pairings[0].winner).toBe("gov")
    expect(r[3].pairings[0].winner).toBeUndefined()
    expect(r[0].pairings[0].winner).toBeUndefined()
    expect(r[4].pairings[0]).toMatchObject({ winner: "opp" })
  })

  it("leaves a pairing alone when both or neither team advanced, or ballots already decided it", () => {
    const r: ParliRound[] = [
      { id: "1", label: "Semis", elim: true, pairings: [pairing("A", "B"), pairing("C", "D", { winner: "opp", resultSource: "ballots" })] },
      { id: "2", label: "Finals", elim: true, pairings: [pairing("A", "B")] },
    ]
    expect(inferAdvancementResults(r)).toBe(0)
    expect(r[0].pairings[1]).toMatchObject({ winner: "opp", resultSource: "ballots" })
  })
})

describe("ballot results", () => {
  const round = (): ParliRound => ({
    id: "1",
    label: "Round 1",
    elim: false,
    pairings: [pairing("Nueva AW", "Carlmont SC"), pairing("King SS", "Albany BB")],
  })

  it("gives each pairing the side with more judges' wins", () => {
    const r = round()
    const filled = applyBallotResults(r, {
      Sections: {
        "1": {
          Entries: {
            "10": { code: "Nueva AW", side: 1, Ballots: { "1": { winloss: "W" }, "2": { winloss: "L" }, "3": { winloss: "W" } } },
            "11": { code: "Carlmont SC", side: 2, Ballots: { "1": { winloss: "L" }, "2": { winloss: "W" }, "3": { winloss: "L" } } },
          },
        },
        "2": {
          Entries: {
            "12": { code: "King SS", side: "Gov", Ballots: { "1": { winloss: "L" } } },
            "13": { code: "Albany BB", side: "Opp", Ballots: { "1": { winloss: "W" } } },
          },
        },
        "3": { bye: 1, Entries: {} },
      },
    })
    expect(filled).toBe(2)
    expect(r.pairings[0]).toMatchObject({ winner: "gov", votes: "2-1", resultSource: "ballots" })
    expect(r.pairings[1]).toMatchObject({ winner: "opp", votes: "1-0" })
  })

  it("skips ties and rounds with no ballots", () => {
    const r = round()
    expect(
      applyBallotResults(r, {
        Sections: {
          "1": {
            Entries: {
              "10": { code: "Nueva AW", side: 1, Ballots: { "1": { winloss: "W" }, "2": { winloss: "L" } } },
              "11": { code: "Carlmont SC", side: 2, Ballots: { "1": { winloss: "L" }, "2": { winloss: "W" } } },
            },
          },
          "2": { Entries: { "12": { code: "King SS", side: 1 }, "13": { code: "Albany BB", side: 2 } } },
        },
      }),
    ).toBe(0)
    expect(r.pairings.every((p) => p.winner === undefined)).toBe(true)
  })
})
