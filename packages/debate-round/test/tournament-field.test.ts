import { describe, expect, it } from "vitest"
import type { FieldEntry, InviteEvent, UpcomingTournament } from "@debate/tournaments/client"
import {
  currentTournaments,
  eventsForStyle,
  fieldSchools,
  findFieldTeams,
  mergeSchoolOptions,
} from "../src/round/tournament-field"

function tourn(name: string, start: string, end: string, eventTypes = "Debate, Speech"): UpcomingTournament {
  return { id: name, tournId: name.length, webname: null, name, location: null, state: null, country: null, start, end, eventTypes }
}

function event(abbr: string, name: string): InviteEvent {
  return { id: abbr.length, abbr, name, type: "debate", fee: null }
}

function entry(id: number, name: string, school: string): FieldEntry {
  return { id, name, code: null, School: { id: school.length, name: school, code: null } }
}

describe("currentTournaments", () => {
  const now = new Date("2026-10-03T12:00:00Z")

  it("puts running tournaments first, then upcoming soonest first, and drops finished ones", () => {
    const list = [
      tourn("Later", "2026-10-20T12:00:00Z", "2026-10-22T12:00:00Z"),
      tourn("Finished", "2026-09-01T12:00:00Z", "2026-09-03T12:00:00Z"),
      tourn("Soon", "2026-10-09T12:00:00Z", "2026-10-11T12:00:00Z"),
      tourn("Yale", "2026-10-02T12:00:00Z", "2026-10-05T02:00:00Z"),
    ]
    expect(currentTournaments(list, now).map((t) => t.name)).toEqual(["Yale", "Soon", "Later"])
  })

  it("leaves out tournaments with no debate events", () => {
    const list = [tourn("Speech Only", "2026-10-02T12:00:00Z", "2026-10-05T12:00:00Z", "Speech")]
    expect(currentTournaments(list, now)).toEqual([])
  })
})

describe("eventsForStyle", () => {
  const events = [
    event("JVLD", "JV Lincoln Douglas"),
    event("VLD", "Varsity Lincoln Douglas"),
    event("CX", "Policy Debate"),
    event("VPF", "Varsity Public Forum"),
    event("DI", "Dramatic Interp"),
  ]

  it("picks the format's events, varsity first", () => {
    expect(eventsForStyle(events, "lincolnDouglas").map((e) => e.abbr)).toEqual(["VLD", "JVLD"])
    expect(eventsForStyle(events, "policy").map((e) => e.abbr)).toEqual(["CX"])
    expect(eventsForStyle(events, "publicForum").map((e) => e.abbr)).toEqual(["VPF"])
  })

  it("finds nothing for a format the tournament does not run", () => {
    expect(eventsForStyle(events, "congress")).toEqual([])
  })
})

describe("tournament field schools and teams", () => {
  const entries = [
    entry(1, "Hu & Liu", "McDowell HS"),
    entry(2, "Samuels & Annan", "Greenhill School"),
    entry(3, "Pan & Bloch", "Greenhill School"),
    entry(4, "Tran & Lee", "The Hun School"),
  ]

  it("lists each school once, in field order", () => {
    expect(fieldSchools(entries)).toEqual(["McDowell HS", "Greenhill School", "The Hun School"])
  })

  it("finds a school's entries from a typed school name", () => {
    expect(findFieldTeams(entries, "Greenhill School (TX)").map((e) => e.name)).toEqual(["Samuels & Annan", "Pan & Bloch"])
    expect(findFieldTeams(entries, "Gr")).toEqual([])
  })

  it("puts the tournament's matching schools ahead of the rest, without duplicates", () => {
    expect(mergeSchoolOptions(["Greenhill School", "McDowell HS"], ["Greenhill School (TX)", "Harker (CA)"], "green", 10)).toEqual([
      "Greenhill School",
      "Harker (CA)",
    ])
    expect(mergeSchoolOptions(["Greenhill School", "McDowell HS"], [], "", 10)).toEqual(["Greenhill School", "McDowell HS"])
  })
})
