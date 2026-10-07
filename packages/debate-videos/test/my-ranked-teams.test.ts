import { describe, expect, it } from "vitest"
import {
  normalizeMyRankedTeamsPatch,
  parseMyRankedTeams,
  serializeMyRankedTeams,
  validateMyRankedTeams,
} from "../src/lib/my-ranked-teams/my-ranked-teams"

describe("my ranked teams", () => {
  const valid = { role: "debater", partner: " Tarnas ", teams: { cpd: "northwestern-nahm-tarnas" } }

  it("accepts a well-formed value and trims the partner", () => {
    const result = validateMyRankedTeams(valid)
    expect(result).toEqual({ ok: true, value: { role: "debater", partner: "Tarnas", teams: { cpd: "northwestern-nahm-tarnas" } } })
  })

  it("rejects unknown divisions, bad slugs and bad roles", () => {
    expect(validateMyRankedTeams({ ...valid, teams: { nope: "a-b" } }).ok).toBe(false)
    expect(validateMyRankedTeams({ ...valid, teams: { cpd: "Not A Slug" } }).ok).toBe(false)
    expect(validateMyRankedTeams({ ...valid, role: "parent" }).ok).toBe(false)
  })

  it("only patches when the body names the field", () => {
    expect(normalizeMyRankedTeamsPatch({ debateStyle: "pf" })).toEqual({ valid: {}, errors: [] })
    expect(normalizeMyRankedTeamsPatch({ myRankedTeams: null })).toEqual({ valid: { myRankedTeams: null }, errors: [] })
    expect(normalizeMyRankedTeamsPatch({ myRankedTeams: { role: "x" } }).errors).toHaveLength(1)
  })

  it("round-trips through the column and ignores corrupt values", () => {
    const value = (validateMyRankedTeams(valid) as { ok: true; value: never }).value
    expect(parseMyRankedTeams(serializeMyRankedTeams(value))).toEqual(value)
    expect(parseMyRankedTeams("{oops")).toBeNull()
    expect(parseMyRankedTeams(null)).toBeNull()
  })
})
