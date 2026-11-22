import { describe, expect, it } from "vitest"
import { schoolInfo, websiteLabel, websiteUrl } from "../src/schools/school-info"
import { SCHOOL_INFO_ROWS } from "../src/schools/school-info-data"

describe("school info", () => {
  it("gives a top-50 school's city, state, type and website", () => {
    expect(schoolInfo("Greenhill")).toEqual({ city: "Addison", state: "TX", type: "Private", website: "https://greenhill.org" })
    expect(schoolInfo("Michigan State")).toMatchObject({ city: "East Lansing", state: "MI", type: "Public" })
  })

  it("lets the page's saved location win, keeping the bundled city only for its own state", () => {
    expect(schoolInfo("Greenhill", { city: "Dallas", state: "TX" })).toMatchObject({ city: "Dallas", state: "TX" })
    expect(schoolInfo("Greenhill", { state: "OK" })).toMatchObject({ city: null, state: "OK" })
  })

  it("falls back to inferred state and the academics lists' type", () => {
    const info = schoolInfo("Phillips Exeter Academy (NH)")
    expect(info).toMatchObject({ state: "NH", type: "Private", website: null })
  })

  it("keeps every row's state a US code or blank and websites as bare domains", () => {
    for (const [, , state, , website] of SCHOOL_INFO_ROWS) {
      expect(state === "" || /^[A-Z]{2}$/.test(state)).toBe(true)
      expect(website).not.toMatch(/^https?:/)
    }
  })

  it("formats website links", () => {
    expect(websiteUrl("hw.com")).toBe("https://hw.com")
    expect(websiteUrl("")).toBeNull()
    expect(websiteLabel("https://www.greenhill.org/")).toBe("greenhill.org")
  })
})
