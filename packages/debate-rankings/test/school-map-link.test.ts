import { describe, expect, it } from "vitest"
import { schoolMapQuery, schoolMapUrl } from "../src/schools/school-map-link"

describe("schoolMapQuery", () => {
  it("searches the name with city and full state name", () => {
    expect(schoolMapQuery("Harker", { city: "San Jose", state: "CA" })).toBe("Harker, San Jose, California")
  })

  it("falls back to the state alone, then the name alone", () => {
    expect(schoolMapQuery("Westminster Schools", { city: null, state: "GA" })).toBe("Westminster Schools, Georgia")
    expect(schoolMapQuery("Westminster Schools")).toBe("Westminster Schools")
  })

  it("puts a street address ahead of the city and state when known", () => {
    expect(schoolMapQuery("Harker", { address: " 500 Saratoga Ave ", city: "San Jose", state: "CA" })).toBe(
      "Harker, 500 Saratoga Ave, San Jose, California",
    )
  })

  it("is null for a blank name", () => {
    expect(schoolMapQuery("  ", { state: "TX" })).toBeNull()
  })
})

describe("schoolMapUrl", () => {
  it("builds an encoded Google Maps search on the satellite layer", () => {
    const url = new URL(schoolMapUrl("Saint Mark's & Co", { state: "TX" })!)
    expect(url.origin + url.pathname).toBe("https://www.google.com/maps")
    expect(url.searchParams.get("q")).toBe("Saint Mark's & Co, Texas")
    expect(url.searchParams.get("t")).toBe("k")
  })

  it("is null for a blank name", () => {
    expect(schoolMapUrl("")).toBeNull()
  })
})
