/**
 * @fileoverview Pins the school-claim request rules: a claim needs a school
 * (picked or created), a role, and a school address at a non-personal domain
 * or an explanation; roster entries and logos are validated before storage.
 */

import { describe, expect, it } from "vitest"
import {
  MAX_LOGO_DATA_URL_LENGTH,
  isClaimCode,
  isLogoDataUrl,
  isSchoolEmail,
  parseClaimBody,
  parseMemberBody,
  schoolSlug,
} from "../../src/schools/school-claims"

describe("parseClaimBody", () => {
  it("accepts a listed school with a school email, slugging the name", () => {
    expect(parseClaimBody({ schoolName: "  The Harker  School ", role: "coach", schoolEmail: "Coach@Harker.org" })).toEqual({
      ok: true,
      schoolName: "The Harker School",
      schoolSlug: "the-harker-school",
      isNewSchool: false,
      role: "coach",
      schoolEmail: "coach@harker.org",
      explanation: null,
    })
  })

  it("accepts a new school backed by an explanation", () => {
    const parsed = parseClaimBody({
      schoolName: "Lincoln High",
      isNewSchool: true,
      role: "admin",
      explanation: "I am the activities director and run the speech program.",
    })
    expect(parsed).toMatchObject({ ok: true, isNewSchool: true, role: "admin", schoolEmail: null })
  })

  it("refuses personal email domains, short explanations, and claims with neither", () => {
    expect(parseClaimBody({ schoolName: "Lincoln", role: "coach", schoolEmail: "me@gmail.com" }).ok).toBe(false)
    expect(parseClaimBody({ schoolName: "Lincoln", role: "coach", explanation: "trust me" }).ok).toBe(false)
    expect(parseClaimBody({ schoolName: "Lincoln", role: "coach" }).ok).toBe(false)
  })

  it("refuses a missing school, a bad role, and a name with no letters", () => {
    expect(parseClaimBody({ role: "coach", schoolEmail: "a@school.edu" }).ok).toBe(false)
    expect(parseClaimBody({ schoolName: "Lincoln", role: "owner", schoolEmail: "a@school.edu" }).ok).toBe(false)
    expect(parseClaimBody({ schoolName: "!!!", role: "coach", schoolEmail: "a@school.edu" }).ok).toBe(false)
    expect(parseClaimBody(null).ok).toBe(false)
  })
})

describe("school email, code, logo and roster checks", () => {
  it("tells school addresses from personal ones", () => {
    expect(isSchoolEmail("coach@lhs.k12.ca.us")).toBe(true)
    expect(isSchoolEmail("coach@outlook.com")).toBe(false)
    expect(isSchoolEmail("not an email")).toBe(false)
  })

  it("takes six-digit codes only", () => {
    expect(isClaimCode("012345")).toBe(true)
    expect(isClaimCode("12345")).toBe(false)
    expect(isClaimCode(123456)).toBe(false)
  })

  it("takes image data URLs under the cap", () => {
    expect(isLogoDataUrl("data:image/png;base64,iVBORw0KGgo=")).toBe(true)
    expect(isLogoDataUrl("data:text/html;base64,PGgxPg==")).toBe(false)
    expect(isLogoDataUrl(`data:image/png;base64,${"A".repeat(MAX_LOGO_DATA_URL_LENGTH)}`)).toBe(false)
    expect(isLogoDataUrl("https://example.com/logo.png")).toBe(false)
  })

  it("validates roster entries", () => {
    expect(parseMemberBody({ kind: "team", name: " Lee  & Lin " })).toEqual({ ok: true, kind: "team", name: "Lee & Lin", email: null })
    expect(parseMemberBody({ kind: "student", name: "Ana", email: "ANA@lhs.org" })).toMatchObject({ ok: true, email: "ana@lhs.org" })
    expect(parseMemberBody({ kind: "coach", name: "Ana" }).ok).toBe(false)
    expect(parseMemberBody({ kind: "student", name: "Ana", email: "nope" }).ok).toBe(false)
  })

  it("slugs school names the way the rankings link them", () => {
    expect(schoolSlug("Montgomery Blair")).toBe("montgomery-blair")
  })
})
