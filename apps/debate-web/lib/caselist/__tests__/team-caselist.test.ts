import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/database/context", () => ({ getCloudflareContext: () => undefined }))

import type { CaselistClient } from "@debate-ai/research-evidence/src/caselist/caselist-api"
import { isOpenSourcePath, lookupTeamCaselist, openSourceFileUrl } from "../team-caselist"

function fakeClient(): CaselistClient & { calls: string[] } {
  const calls: string[] = []
  const log = <T>(name: string, value: T) => {
    calls.push(name)
    return Promise.resolve(value)
  }
  return {
    calls,
    token: () => Promise.resolve("t"),
    caselists: () =>
      log("caselists", [
        { caselist_id: 1, name: "hspf24", display_name: "HS PF 2024-25", year: 2024, event: "pf", level: "hs", team_size: 2, archived: true },
        { caselist_id: 2, name: "hspf25", display_name: "HS PF 2025-26", year: 2025, event: "pf", level: "hs", team_size: 2, archived: false },
        { caselist_id: 3, name: "hsld25", display_name: "HS LD 2025-26", year: 2025, event: "ld", level: "hs", team_size: 1, archived: false },
      ]),
    schools: (caselist) =>
      log(`schools:${caselist}`, caselist === "hspf24" ? [{ school_id: 1, caselist_id: 1, name: "Harker", display_name: "Harker", state: "CA" }] : []),
    teams: (caselist, school) =>
      log(`teams:${caselist}/${school}`, [
        { team_id: 1, school_id: 1, name: "LiLe", display_name: "Harker LiLe", debater1_last: "Lin", debater2_last: "Lee" },
      ]),
    team: () => Promise.reject(new Error("unused")),
    rounds: () =>
      log("rounds", [
        { round_id: 7, team_id: 1, side: "A", tournament: "Blake", round: "2", opponent: "X", judge: "J", report: " AC: Space ", opensource: "hspf24/Harker/LiLe/hspf24-Harker-LiLe-Pro-Blake-Round2.docx", video: null, created_at: "2024-10-01" },
        { round_id: 8, team_id: 1, side: "N", tournament: "Glenbrooks", round: "14", opponent: null, judge: null, report: null, opensource: "../etc/passwd", video: null, created_at: "2024-11-20" },
      ]),
    cites: () => log("cites", [{ cite_id: 3, round_id: 7, title: "AC - Space", cites: "**Smith 21**", created_at: "2024-10-01" }]),
    download: () => Promise.reject(new Error("unused")),
  }
}

describe("lookupTeamCaselist", () => {
  it("searches this season then last season for the dataset's format", async () => {
    const client = fakeClient()
    const payload = await lookupTeamCaselist(client, { dataset: "hspf", school: "The Harker School", team: "Lee & Lin" })
    expect(client.calls).toContain("schools:hspf25")
    expect(client.calls).not.toContain("schools:hsld25")
    expect(payload.found).toBe(true)
    expect(payload.caselist?.name).toBe("hspf24")
    expect(payload.pageUrl).toBe("https://opencaselist.com/hspf24/Harker/LiLe")
  })

  it("labels rounds, keeps only safe file paths and joins cites to their round", async () => {
    const payload = await lookupTeamCaselist(fakeClient(), { dataset: "hspf", school: "Harker", team: "Lin & Lee" })
    expect(payload.rounds.map((r) => [r.roundLabel, r.sideLabel])).toEqual([
      ["Semis", "Con"],
      ["R2", "Pro"],
    ])
    expect(payload.rounds[0].file).toBeNull()
    expect(payload.rounds[1].file?.name).toBe("hspf24-Harker-LiLe-Pro-Blake-Round2.docx")
    expect(payload.rounds[1].report).toBe("AC: Space")
    expect(payload.cites[0]).toMatchObject({ title: "AC - Space", sideLabel: "Pro", tournament: "Blake", roundLabel: "R2" })
  })

  it("reports not found, and rejects unknown datasets", async () => {
    expect((await lookupTeamCaselist(fakeClient(), { dataset: "hspf", school: "Nowhere", team: "A & B" })).found).toBe(false)
    expect((await lookupTeamCaselist(fakeClient(), { dataset: "nope", school: "Harker", team: "A & B" })).error).toMatch(/Unknown/)
  })
})

describe("open-source paths", () => {
  it("accepts only caselist/school/team/file paths", () => {
    expect(isOpenSourcePath("hspf24/Harker/LiLe/a.docx")).toBe(true)
    expect(isOpenSourcePath("../hspf24/Harker/LiLe/a.docx")).toBe(false)
    expect(isOpenSourcePath("weekly/hspf24/hspf24-all.zip")).toBe(false)
    expect(openSourceFileUrl("hspf24/A B/LiLe/a.docx")).toBe("/api/caselist-team/file?path=hspf24%2FA%20B%2FLiLe%2Fa.docx")
  })
})
