import JSZip from "jszip"
import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/database/context", () => ({ getCloudflareContext: () => undefined }))

import type { CaselistClient } from "@debate-ai/research-evidence/src/caselist/caselist-api"
import {
  type CaselistFileBucket,
  caselistFileKey,
  debatersKey,
  findTeamPages,
  parseCaselistPageUrl,
  readStoredTeamCaselist,
  readStoredTeamFileText,
  resetCaselistTeamTables,
  syncTeamFile,
  syncTeamPages,
  teamFileDocumentId,
} from "../team-caselist-sync"

const FILE_26 = "ndtceda26/Emory/GaYo/Emory-GaYo-Aff-1.-Northwestern-Round-1.docx"
const FILE_25 = "ndtceda25/Emory/GaYo/Emory-GaYo-Neg-Kentucky-Round-3.docx"

async function docxBytes(): Promise<ArrayBuffer> {
  const zip = new JSZip()
  zip.file(
    "word/document.xml",
    `<w:document><w:body><w:p><w:pPr><w:pStyle w:val="Heading4"/></w:pPr><w:r><w:t>Warming is real</w:t></w:r></w:p><w:p><w:r><w:t>Smith 24 evidence</w:t></w:r></w:p></w:body></w:document>`,
  )
  return zip.generateAsync({ type: "arraybuffer" })
}

function fakeClient(): CaselistClient & { calls: string[] } {
  const calls: string[] = []
  const log = <T>(name: string, value: T) => {
    calls.push(name)
    return Promise.resolve(value)
  }
  const team = (caselist: string) => ({
    team_id: caselist === "ndtceda26" ? 1 : 2,
    school_id: 1,
    name: "GaYo",
    display_name: "Emory GaYo",
    debater1_last: "Gannon",
    debater2_last: "Young",
  })
  return {
    calls,
    token: () => Promise.resolve("t"),
    caselists: () =>
      log("caselists", [
        { caselist_id: 1, name: "ndtceda26", display_name: "NDT/CEDA College 2026-27", year: 2026, event: "cx", level: "college", team_size: 2, archived: false },
        { caselist_id: 2, name: "ndtceda25", display_name: "NDT/CEDA College 2025-26", year: 2025, event: "cx", level: "college", team_size: 2, archived: true },
        { caselist_id: 3, name: "hspolicy26", display_name: "HS Policy 2026-27", year: 2026, event: "cx", level: "hs", team_size: 2, archived: false },
      ]),
    schools: (caselist) => log(`schools:${caselist}`, [{ school_id: 1, caselist_id: 1, name: "Emory", display_name: "Emory", state: "GA" }]),
    teams: (caselist, school) => log(`teams:${caselist}/${school}`, [team(caselist)]),
    team: (caselist) => log(`team:${caselist}`, team(caselist)),
    rounds: (caselist) =>
      log(
        `rounds:${caselist}`,
        caselist === "ndtceda26"
          ? [{ round_id: 11, team_id: 1, side: "A", tournament: "Northwestern", round: "1", opponent: "Kansas", judge: "J", report: "1AC: Space", opensource: FILE_26, video: null, created_at: "2026-10-01" }]
          : [{ round_id: 21, team_id: 2, side: "N", tournament: "Kentucky", round: "3", opponent: null, judge: null, report: null, opensource: FILE_25, video: null, created_at: "2025-09-10" }],
      ),
    cites: (caselist) =>
      log(`cites:${caselist}`, caselist === "ndtceda26" ? [{ cite_id: 5, round_id: 11, title: "1AC - Space", cites: "**Smith 24**", created_at: "2026-10-01" }] : []),
    downloads: () => Promise.reject(new Error("unused")),
    download: async (path) => {
      calls.push(`download:${path}`)
      return new Response(await docxBytes())
    },
  }
}

function fakeBucket(): CaselistFileBucket & { objects: Map<string, string | ArrayBuffer | Uint8Array> } {
  const objects = new Map<string, string | ArrayBuffer | Uint8Array>()
  return {
    objects,
    put: async (key, value) => {
      objects.set(key, value)
    },
    get: async (key) => {
      const value = objects.get(key)
      if (value === undefined) return null
      return {
        text: async () => (typeof value === "string" ? value : new TextDecoder().decode(value)),
        arrayBuffer: async () => (typeof value === "string" ? new TextEncoder().encode(value).buffer : (value as ArrayBuffer)),
      }
    },
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const freshDb = () => drizzle(createClient({ url: ":memory:" })) as any

beforeEach(() => resetCaselistTeamTables())

describe("finding a team's pages", () => {
  it("parses openCaselist team page URLs", () => {
    expect(parseCaselistPageUrl("https://opencaselist.com/ndtceda26/Emory/GaYo")).toEqual({ caselist: "ndtceda26", school: "Emory", team: "GaYo" })
    expect(parseCaselistPageUrl("https://example.com/ndtceda26/Emory/GaYo")).toBeNull()
    expect(parseCaselistPageUrl("https://opencaselist.com/ndtceda26/Emory")).toBeNull()
  })

  it("searches every season of the dataset's format, and no other format", async () => {
    const client = fakeClient()
    const pages = await findTeamPages(client, { dataset: "cpd", school: "Emory", team: "Young & Gannon" })
    expect(pages.map((page) => page.caselist.name)).toEqual(["ndtceda26", "ndtceda25"])
    expect(client.calls).not.toContain("schools:hspolicy26")
  })

  it("takes a pasted page and finds the same debaters in earlier seasons", async () => {
    const pages = await findTeamPages(fakeClient(), { url: "https://opencaselist.com/ndtceda26/Emory/GaYo" })
    expect(pages.map((page) => page.caselist.name)).toEqual(["ndtceda26", "ndtceda25"])
  })

  it("folds and sorts surnames into one key", () => {
    expect(debatersKey(["Young", "Gannon"])).toBe(debatersKey(["gannon", "YOUNG"]))
  })
})

describe("syncing a team", () => {
  it("saves pages, rounds and cites, then stores each file in R2 and D1", async () => {
    const db = freshDb()
    const client = fakeClient()
    const bucket = fakeBucket()

    const result = await syncTeamPages(db, client, { dataset: "cpd", school: "Emory", team: "Gannon & Young" }, "admin@x", { now: 100 })
    expect(result.pages.map((page) => [page.caselist, page.rounds, page.cites, page.files, page.storedFiles])).toEqual([
      ["ndtceda26", 1, 1, 1, 0],
      ["ndtceda25", 1, 0, 1, 0],
    ])
    expect(result.pendingFiles).toEqual([FILE_26, FILE_25])
    expect(client.calls.some((call) => call.startsWith("download:"))).toBe(false)

    const file = await syncTeamFile(db, bucket, client, FILE_26)
    expect(file).toMatchObject({ converted: true, cardCount: 1, documentId: teamFileDocumentId(FILE_26) })
    expect(bucket.objects.has(caselistFileKey(FILE_26))).toBe(true)
    expect(String(bucket.objects.get(`caselist-docs/${file.documentId}.html`))).toContain("Warming is real")

    const text = await readStoredTeamFileText(db, bucket, FILE_26)
    expect(text?.html).toContain("Smith 24 evidence")

    const again = await syncTeamPages(db, client, { url: "https://opencaselist.com/ndtceda26/Emory/GaYo" }, "admin@x")
    expect(again.pendingFiles).toEqual([FILE_25])
    expect(again.pages[0].storedFiles).toBe(1)
  })

  it("answers the team profile from the stored pages, every season", async () => {
    const db = freshDb()
    const client = fakeClient()
    await syncTeamPages(db, client, { url: "https://opencaselist.com/ndtceda26/Emory/GaYo" }, "admin@x")
    await syncTeamFile(db, fakeBucket(), client, FILE_26)

    const payload = await readStoredTeamCaselist(db, { dataset: "cpd", school: "Emory University", team: "Gannon & Young" })
    expect(payload?.stored).toBe(true)
    expect(payload?.seasons?.map((season) => season.caselist.name)).toEqual(["ndtceda26", "ndtceda25"])
    expect(payload?.caselist?.name).toBe("ndtceda26")
    expect(payload?.rounds[0]).toMatchObject({ roundLabel: "R1", sideLabel: "Aff", report: "1AC: Space" })
    expect(payload?.rounds[0].file?.textUrl).toContain("/api/caselist-team/text?path=")
    expect(payload?.seasons?.[1].rounds[0].file?.textUrl).toBeUndefined()
    expect(payload?.cites[0]).toMatchObject({ title: "1AC - Space", tournament: "Northwestern" })

    expect(await readStoredTeamCaselist(db, { dataset: "hscx", school: "Emory", team: "Gannon & Young" })).toBeNull()
    expect(await readStoredTeamCaselist(db, { dataset: "cpd", school: "Emory", team: "Smith & Jones" })).toBeNull()
  })
})
