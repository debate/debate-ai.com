import { describe, expect, it } from "vitest"
import { slugifyOrganizationName } from "../../../src/lib/nav/organization-slug"

describe("slugifyOrganizationName", () => {
  it("hyphenates and lowercases the name, then adds a random tail", () => {
    expect(slugifyOrganizationName("Lincoln High Debate!", () => 0)).toBe("lincoln-high-debate-000000")
  })

  it("strips accents and trims stray hyphens", () => {
    expect(slugifyOrganizationName("  Équipe  de débat ", () => 0)).toBe("equipe-de-debat-000000")
  })

  it("falls back to org- for a name with no letters or digits", () => {
    expect(slugifyOrganizationName("🎉🎉", () => 0)).toBe("org-000000")
  })

  it("gives two orgs with the same name different slugs", () => {
    expect(slugifyOrganizationName("Team", () => 0.1)).not.toBe(slugifyOrganizationName("Team", () => 0.2))
  })
})
