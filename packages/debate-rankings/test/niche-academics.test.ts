import { describe, expect, it } from "vitest"
import { NICHE_ACADEMICS, NICHE_ACADEMICS_STATE_COUNTS, findNicheAcademicsRank, nicheNameKey } from "../src/schools/niche-academics"

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

  it("ranks each school within its state", () => {
    expect(findNicheAcademicsRank("Harvard-Westlake School (CA)")?.stateRank).toBe(1)
    expect(findNicheAcademicsRank("College Prep")).toMatchObject({ state: "CA", stateRank: 4 })
    expect(NICHE_ACADEMICS[0]).toMatchObject({ state: "NC", stateRank: 1 })
  })

  it("keeps a same-named school from another state off the list", () => {
    expect(findNicheAcademicsRank("Episcopal High School")?.state).toBe("VA")
    expect(findNicheAcademicsRank("Episcopal High School (TX)")).toBeNull()
    expect(findNicheAcademicsRank("Collegiate School", "VA")).toBeNull()
    expect(findNicheAcademicsRank("Collegiate School", "NY")?.position).toBe(92)
    expect(findNicheAcademicsRank("St. Mark's School (MA)")?.position).toBe(114)
    expect(findNicheAcademicsRank("St. Mark's School (TX)")?.position).toBe(123)
    expect(findNicheAcademicsRank("St. Mark's School of Texas")?.position).toBe(123)
  })

  it("never gives Harvard the Harvard-Westlake rank", () => {
    expect(findNicheAcademicsRank("Harvard")).toBeNull()
    expect(findNicheAcademicsRank("Harvard University")).toBeNull()
  })

  it("counts the listed schools per state", () => {
    expect(NICHE_ACADEMICS_STATE_COUNTS.get("NC")).toBe(4)
    expect([...NICHE_ACADEMICS_STATE_COUNTS.values()].reduce((a, b) => a + b, 0)).toBe(200)
  })

  it("gives nothing for a school off the list", () => {
    expect(findNicheAcademicsRank("Harker")).toBeNull()
    expect(findNicheAcademicsRank("")).toBeNull()
  })

  it("keys names on their identifying words", () => {
    expect(nicheNameKey("The Hockaday School")).toBe("hockaday")
  })
})
