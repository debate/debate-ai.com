import { describe, expect, it } from "vitest"
import {
  buildParticipant,
  collegeResultsFetcher,
  fetchCollegeParticipants,
  participantName,
  seasonEndYear,
  type CollegeResultsDebater,
  type CollegeResultsSeason,
} from "../src/sync/college-participants"
import participants from "../data/college-results-participants.json"

describe("College Debate Results participants", () => {
  it("reads the year a season ends in", () => {
    expect(seasonEndYear("2020-2021")).toBe(2021)
    expect(seasonEndYear("2020")).toBeNull()
  })

  it("rejects placeholder and incomplete names", () => {
    expect(participantName({ first_name: "Grace", last_name: "Kessler" })).toBe("Grace Kessler")
    expect(participantName({ first_name: "Maneer", last_name: "?" })).toBeNull()
    expect(participantName({ first_name: "Debater", last_name: "1" })).toBeNull()
    expect(participantName({ first_name: null, last_name: "Kessler" })).toBeNull()
  })

  it("builds a participant from their seasons, with the latest school", () => {
    const debater: CollegeResultsDebater = { debater_code: "GKESSLER", first_name: "Grace", last_name: "Kessler" }
    const seasons: CollegeResultsSeason[] = [
      { season: "2023-2024", school: "Emory" },
      { season: "2020-2021", school: "FigBow\\Emory" },
    ]
    expect(buildParticipant(debater, seasons)).toEqual({
      code: "GKESSLER",
      name: "Grace Kessler",
      school: "Emory",
      firstYear: 2021,
      lastYear: 2024,
    })
    expect(buildParticipant(debater, [])).toBeNull()
  })

  it("fetches seasons only for debaters whose name is wanted", async () => {
    const calls: string[] = []
    const getJson = async <T,>(path: string): Promise<T> => {
      calls.push(path)
      if (path === "/debaters?q=") {
        return [
          { debater_code: "ANNONE", first_name: "Ann", last_name: "One" },
          { debater_code: "ZED", first_name: "Zed", last_name: "Other" },
        ] as T
      }
      return [{ season: "2016-2017", school: "Emory" }] as T
    }
    const result = await fetchCollegeParticipants(getJson, (name) => name === "Ann One")
    expect(result).toMatchObject({ listed: 2, candidates: 1 })
    expect(result.participants).toEqual([{ code: "ANNONE", name: "Ann One", school: "Emory", firstYear: 2017, lastYear: 2017 }])
    expect(calls).toEqual(["/debaters?q=", "/debaters/ANNONE/season-summary"])
  })

  it("retries a failed request", async () => {
    let attempts = 0
    const fetcher = (async () => {
      attempts += 1
      if (attempts < 2) return new Response("nope", { status: 502 })
      return new Response(JSON.stringify([1]), { status: 200 })
    }) as unknown as typeof fetch
    expect(await collegeResultsFetcher(fetcher, 2)("/x")).toEqual([1])
    expect(attempts).toBe(2)
  })

  it("bundles well-formed participants", () => {
    expect(participants.length).toBeGreaterThan(100)
    for (const p of participants) {
      expect(p.name).toMatch(/\S \S/)
      expect(p.firstYear).toBeLessThanOrEqual(p.lastYear)
      expect(p.firstYear).toBeGreaterThanOrEqual(2004)
    }
  })
})
