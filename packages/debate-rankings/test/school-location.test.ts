import { describe, expect, it } from "vitest"
import { formatSchoolLocation, inferSchoolState, normalizeStateCode, schoolLocation } from "../src/schools/school-location"

describe("school location", () => {
  it("reads the state from a name tag, TOC results or the Niche list", () => {
    expect(inferSchoolState("Greenhill School (TX)")).toBe("TX")
    expect(inferSchoolState("Harvard-Westlake")).toBe("CA")
    expect(inferSchoolState("Nowhere Prep")).toBeNull()
  })

  it("prefers the page's own city and state", () => {
    expect(schoolLocation("Greenhill School (TX)", { city: " Addison ", state: "tx" })).toEqual({ city: "Addison", state: "TX" })
    expect(schoolLocation("Greenhill School (TX)", null)).toEqual({ city: null, state: "TX" })
  })

  it("formats city and full state name", () => {
    expect(formatSchoolLocation({ city: "Houston", state: "TX" })).toBe("Houston, Texas")
    expect(formatSchoolLocation({ city: null, state: "DC" })).toBe("District of Columbia")
    expect(formatSchoolLocation({ city: null, state: null })).toBeNull()
    expect(normalizeStateCode("zz")).toBeNull()
  })
})
