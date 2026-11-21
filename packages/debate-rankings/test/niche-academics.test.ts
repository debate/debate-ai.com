import { describe, expect, it } from "vitest"
import { NICHE_ACADEMICS, findNicheAcademicsRank, nicheNameKey } from "../src/schools/niche-academics"

describe("Niche academics rank", () => {
  it("holds the 200 schools in list order", () => {
    expect(NICHE_ACADEMICS).toHaveLength(200)
    expect(NICHE_ACADEMICS[0]).toMatchObject({ position: 1, name: "North Carolina School of Science and Mathematics", type: "Public" })
    expect(NICHE_ACADEMICS[12]).toMatchObject({ name: "Stanford Online High School", type: "Private, online" })
    expect(NICHE_ACADEMICS[199]).toMatchObject({ position: 200, name: "Cary Academy" })
  })

  it("matches debate spellings of a school", () => {
    expect(findNicheAcademicsRank("Whitney Young")?.position).toBe(64)
    expect(findNicheAcademicsRank("Walter Payton")?.position).toBe(36)
    expect(findNicheAcademicsRank("Harvard-Westlake School (CA)")?.position).toBe(10)
    expect(findNicheAcademicsRank("Bronx Science")?.position).toBe(57)
    expect(findNicheAcademicsRank("Lycee Francais de New York")?.position).toBe(174)
    expect(findNicheAcademicsRank("Strake Jesuit")?.position).toBe(162)
  })

  it("gives nothing for a school off the list", () => {
    expect(findNicheAcademicsRank("Harker")).toBeNull()
    expect(findNicheAcademicsRank("")).toBeNull()
  })

  it("keys names on their identifying words", () => {
    expect(nicheNameKey("The Hockaday School")).toBe("hockaday")
  })
})
