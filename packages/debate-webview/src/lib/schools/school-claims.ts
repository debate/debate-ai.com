/**
 * @fileoverview Claiming a school: the shapes the school-claim and school-page
 * APIs speak, the request validation those routes run, and the client calls
 * the settings tab, the school page and the admin review panel make.
 *
 * A signed-in user claims to be a school's coach or administrator (Settings →
 * My school), picking the school from the list or creating a new one. They
 * back the claim with a school email address — confirmed with an emailed
 * code — or a written explanation, and a moderator approves or rejects it in
 * `/admin`. An approved claim makes the user an owner of the school's page,
 * who can list its teams and students and set or delete its logo.
 *
 * The tables are `school_claims`, `school_profiles` and `school_members`
 * (packages/debate-videos/migrations/0004_school_claims.sql).
 *
 * @module lib/schools/school-claims
 */

import { profileSlug } from "@debate-ai/videos/src/panels/leaderboard/profile/rankingProfileHelpers"

/** The signed-in user's claims and owned schools; POST files a claim. */
export const SCHOOL_CLAIMS_PATH = "/api/school-claims"
/** Moderator review of pending claims. */
export const ADMIN_SCHOOL_CLAIMS_PATH = "/api/admin/school-claims"
/** One school page's owner-managed data: `/api/schools/<slug>`. */
export const schoolPagePath = (slug: string) => `/api/schools/${encodeURIComponent(slug)}`

/** What a claimant says they are to the school. */
export type SchoolRole = "coach" | "admin"
export const SCHOOL_ROLES: readonly { id: SchoolRole; label: string }[] = [
  { id: "coach", label: "Coach" },
  { id: "admin", label: "School administrator" },
]

/**
 * Where a claim stands. `awaiting_email` means a code went to the school
 * address and has not been entered yet; moderators only see `pending` claims.
 */
export type ClaimStatus = "awaiting_email" | "pending" | "approved" | "rejected"

/** What a roster entry is. */
export type SchoolMemberKind = "team" | "student"

/** A claim as its claimant sees it. */
export interface SchoolClaim {
  id: string
  schoolSlug: string
  schoolName: string
  isNewSchool: boolean
  role: SchoolRole
  schoolEmail: string | null
  emailVerified: boolean
  explanation: string | null
  status: ClaimStatus
  reviewNote: string | null
  /** Epoch milliseconds. */
  createdAt: number
  reviewedAt: number | null
}

/** A pending claim as a moderator reviews it. */
export interface PendingSchoolClaim extends SchoolClaim {
  userName: string
  userEmail: string
  /** Names of the school's current owners, so a second claim is visible as one. */
  currentOwners: string[]
}

/** `GET /api/school-claims`. */
export interface MySchoolClaimsResponse {
  signedIn: boolean
  claims: SchoolClaim[]
  /** Slugs and names of the schools the user owns (approved claims). */
  ownedSchools: { slug: string; name: string }[]
}

/** One team or student on a school's roster. */
export interface SchoolMember {
  id: string
  kind: SchoolMemberKind
  name: string
  email: string | null
}

/** `GET /api/schools/<slug>`: the page's owner-managed data. */
export interface SchoolPageData {
  slug: string
  /** Null when no profile row exists yet (an unclaimed, ranked-only school). */
  name: string | null
  logo: string | null
  owners: { name: string; role: SchoolRole }[]
  members: SchoolMember[]
  /** Whether the viewer may edit the roster and logo (an owner, or staff). */
  canManage: boolean
}

/** Longest school name, explanation, roster name and email accepted. */
export const MAX_SCHOOL_NAME_LENGTH = 120
export const MIN_EXPLANATION_LENGTH = 20
export const MAX_EXPLANATION_LENGTH = 2000
export const MAX_MEMBER_NAME_LENGTH = 120
export const MAX_REVIEW_NOTE_LENGTH = 500
/** Most roster entries one school holds. */
export const MAX_SCHOOL_MEMBERS = 300
/** Longest logo accepted, as a data URL: about 190 KB of image. */
export const MAX_LOGO_DATA_URL_LENGTH = 256_000
/** Minutes an emailed code stays valid, and wrong guesses allowed per code. */
export const CODE_TTL_MINUTES = 15
export const MAX_CODE_ATTEMPTS = 5

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const LOGO_PATTERN = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/

/**
 * Personal mail providers. A school address proves something only because the
 * school hands it out, so these are refused for email verification — a
 * claimant with only a personal address writes an explanation instead.
 */
export const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "ymail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "mail.com",
  "yandex.com",
  "zoho.com",
])

/** The `@school` handle (URL segment) for a school name. */
export function schoolSlug(name: string): string {
  return profileSlug(name)
}

/** Whether `email` is a well-formed address at a non-personal domain. */
export function isSchoolEmail(email: string): boolean {
  if (!EMAIL_PATTERN.test(email)) return false
  const domain = email.slice(email.lastIndexOf("@") + 1).toLowerCase()
  return !PERSONAL_EMAIL_DOMAINS.has(domain)
}

/** Whether `value` is a logo data URL the API stores. */
export function isLogoDataUrl(value: unknown): value is string {
  return typeof value === "string" && value.length <= MAX_LOGO_DATA_URL_LENGTH && LOGO_PATTERN.test(value)
}

/** A validated claim request. */
export type ParsedClaimBody =
  | {
      ok: true
      schoolName: string
      schoolSlug: string
      isNewSchool: boolean
      role: SchoolRole
      schoolEmail: string | null
      explanation: string | null
    }
  | { ok: false; error: string }

/**
 * Validates a `POST /api/school-claims` body:
 * `{ schoolName, isNewSchool, role, schoolEmail?, explanation? }`. A claim
 * needs a school address, an explanation, or both.
 */
export function parseClaimBody(body: unknown): ParsedClaimBody {
  if (!body || typeof body !== "object") return { ok: false, error: "Expected a JSON body." }
  const raw = body as Record<string, unknown>
  const schoolName = typeof raw.schoolName === "string" ? raw.schoolName.trim().replace(/\s+/g, " ") : ""
  if (!schoolName) return { ok: false, error: "Choose your school, or type the name of a new one." }
  if (schoolName.length > MAX_SCHOOL_NAME_LENGTH) {
    return { ok: false, error: `School names are at most ${MAX_SCHOOL_NAME_LENGTH} characters.` }
  }
  const slug = schoolSlug(schoolName)
  if (!slug) return { ok: false, error: "The school name needs at least one letter or number." }
  if (raw.role !== "coach" && raw.role !== "admin") {
    return { ok: false, error: 'role must be "coach" or "admin".' }
  }

  const email = typeof raw.schoolEmail === "string" ? raw.schoolEmail.trim().toLowerCase() : ""
  if (email && !isSchoolEmail(email)) {
    return {
      ok: false,
      error: "Use the address your school gave you, not a personal one — or write an explanation instead.",
    }
  }
  const explanation = typeof raw.explanation === "string" ? raw.explanation.trim() : ""
  if (explanation.length > MAX_EXPLANATION_LENGTH) {
    return { ok: false, error: `Explanations are at most ${MAX_EXPLANATION_LENGTH} characters.` }
  }
  if (explanation && explanation.length < MIN_EXPLANATION_LENGTH) {
    return { ok: false, error: `Say a little more — at least ${MIN_EXPLANATION_LENGTH} characters.` }
  }
  if (!email && !explanation) {
    return { ok: false, error: "Verify a school email address or explain how you're connected to the school." }
  }

  return {
    ok: true,
    schoolName,
    schoolSlug: slug,
    isNewSchool: raw.isNewSchool === true,
    role: raw.role,
    schoolEmail: email || null,
    explanation: explanation || null,
  }
}

/** A validated roster addition. */
export type ParsedMemberBody =
  | { ok: true; kind: SchoolMemberKind; name: string; email: string | null }
  | { ok: false; error: string }

/** Validates a roster addition: `{ kind, name, email? }`. */
export function parseMemberBody(body: unknown): ParsedMemberBody {
  if (!body || typeof body !== "object") return { ok: false, error: "Expected a JSON body." }
  const raw = body as Record<string, unknown>
  if (raw.kind !== "team" && raw.kind !== "student") return { ok: false, error: 'kind must be "team" or "student".' }
  const name = typeof raw.name === "string" ? raw.name.trim().replace(/\s+/g, " ") : ""
  if (!name) return { ok: false, error: "Enter a name." }
  if (name.length > MAX_MEMBER_NAME_LENGTH) {
    return { ok: false, error: `Names are at most ${MAX_MEMBER_NAME_LENGTH} characters.` }
  }
  const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : ""
  if (email && !EMAIL_PATTERN.test(email)) return { ok: false, error: "That email address doesn't look right." }
  return { ok: true, kind: raw.kind, name, email: email || null }
}

/** Whether `code` has the shape of an emailed code: six digits. */
export function isClaimCode(code: unknown): code is string {
  return typeof code === "string" && /^\d{6}$/.test(code.trim())
}

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null
  if (!response.ok || !data) throw new Error(data?.error || fallback)
  return data
}

function sendJson(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
}

/** The signed-in user's claims and owned schools. */
export async function fetchMySchoolClaims(): Promise<MySchoolClaimsResponse> {
  return readJson(await fetch(SCHOOL_CLAIMS_PATH, { cache: "no-store" }), "Couldn't load your school claims.")
}

/** Every school name the claim dropdown offers: the ranking lists plus created schools. */
export async function fetchSchoolNames(): Promise<string[]> {
  const data = await readJson<{ all: string[] }>(await fetch("/api/schools"), "Couldn't load the school list.")
  return data.all
}

/** Files a claim; a claim with a school address comes back `awaiting_email`. */
export async function submitSchoolClaim(body: {
  schoolName: string
  isNewSchool: boolean
  role: SchoolRole
  schoolEmail?: string
  explanation?: string
}): Promise<{ claim: SchoolClaim; delivery: "emailed" | "logged" }> {
  return readJson(await fetch(SCHOOL_CLAIMS_PATH, sendJson("POST", body)), "Couldn't file your claim.")
}

/** Enters the emailed code, or asks for a new one. */
export async function updateSchoolClaim(
  id: string,
  body: { action: "verify"; code: string } | { action: "resend" },
): Promise<{ claim: SchoolClaim }> {
  return readJson(
    await fetch(`${SCHOOL_CLAIMS_PATH}/${encodeURIComponent(id)}`, sendJson("PATCH", body)),
    "Couldn't update your claim.",
  )
}

/** Withdraws a claim that is not yet approved. */
export async function withdrawSchoolClaim(id: string): Promise<void> {
  await readJson(
    await fetch(`${SCHOOL_CLAIMS_PATH}/${encodeURIComponent(id)}`, { method: "DELETE" }),
    "Couldn't withdraw your claim.",
  )
}

/** Pending claims, for moderators. */
export async function fetchPendingSchoolClaims(): Promise<{ claims: PendingSchoolClaim[] }> {
  return readJson(await fetch(ADMIN_SCHOOL_CLAIMS_PATH, { cache: "no-store" }), "Couldn't load school claims.")
}

/** Approves or rejects a pending claim. */
export async function reviewSchoolClaim(body: {
  id: string
  decision: "approve" | "reject"
  note?: string
}): Promise<{ claim: SchoolClaim }> {
  return readJson(await fetch(ADMIN_SCHOOL_CLAIMS_PATH, sendJson("PATCH", body)), "Couldn't review the claim.")
}

/** A school page's logo, owners and roster. */
export async function fetchSchoolPage(slug: string): Promise<SchoolPageData> {
  return readJson(await fetch(schoolPagePath(slug), { cache: "no-store" }), "Couldn't load the school.")
}

/** Sets the logo (a data URL) or deletes it (`null`). */
export async function setSchoolLogo(slug: string, logo: string | null): Promise<SchoolPageData> {
  return readJson(await fetch(schoolPagePath(slug), sendJson("PATCH", { logo })), "Couldn't save the logo.")
}

/** Adds a team or student to the roster. */
export async function addSchoolMember(
  slug: string,
  body: { kind: SchoolMemberKind; name: string; email?: string },
): Promise<SchoolPageData> {
  return readJson(await fetch(`${schoolPagePath(slug)}/members`, sendJson("POST", body)), "Couldn't add to the roster.")
}

/** Removes a roster entry. */
export async function removeSchoolMember(slug: string, id: string): Promise<SchoolPageData> {
  return readJson(
    await fetch(`${schoolPagePath(slug)}/members?id=${encodeURIComponent(id)}`, { method: "DELETE" }),
    "Couldn't remove from the roster.",
  )
}
