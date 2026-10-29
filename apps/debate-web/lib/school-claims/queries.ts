/**
 * @fileoverview Reads and writes school claims, school page data and school
 * rosters over `school_claims`, `school_profiles` and `school_members`.
 *
 * A claim with a school address starts `awaiting_email`: a six-digit code is
 * emailed and only its salted SHA-256 is stored. Entering the code moves the
 * claim to `pending`; a claim backed only by an explanation starts there. A
 * moderator then approves or rejects it, and an approved claim is what makes
 * its user an owner of the school (see {@link isSchoolOwner}).
 *
 * The request rules (who may claim what, with which email) live in
 * `@debate-ai/rankings/src/schools/school-claims`; this module enforces state.
 *
 * @module lib/school-claims/queries
 */

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  CODE_TTL_MINUTES,
  MAX_CODE_ATTEMPTS,
  MAX_SCHOOL_MEMBERS,
  type ClaimStatus,
  type PendingSchoolClaim,
  type SchoolClaim,
  type SchoolMemberKind,
  type SchoolPageData,
  type SchoolRole,
} from "@debate-ai/rankings/src/schools/school-claims";

import type { getDBFromContext } from "@/lib/database/context";
import {
  schoolClaims,
  schoolMembers,
  schoolProfiles,
  user,
  type SchoolClaimRow,
} from "@/lib/database/schema";

type Db = Awaited<ReturnType<typeof getDBFromContext>>;

/** A refused claim action, with the HTTP status the route answers. */
export class SchoolClaimError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "SchoolClaimError";
  }
}

/** Claims still in play: a second one for the same school is refused. */
const OPEN_STATUSES: ClaimStatus[] = ["awaiting_email", "pending"];

/** A claim row as its claimant sees it — never the code hash. */
export function toClaim(row: SchoolClaimRow): SchoolClaim {
  return {
    id: row.id,
    schoolSlug: row.schoolSlug,
    schoolName: row.schoolName,
    isNewSchool: row.isNewSchool,
    role: row.role as SchoolRole,
    schoolEmail: row.schoolEmail,
    emailVerified: row.emailVerified,
    explanation: row.explanation,
    status: row.status as ClaimStatus,
    reviewNote: row.reviewNote,
    createdAt: row.createdAt.getTime(),
    reviewedAt: row.reviewedAt ? row.reviewedAt.getTime() : null,
  };
}

/** A fresh six-digit code. */
export function generateClaimCode(): string {
  const [value] = crypto.getRandomValues(new Uint32Array(1));
  return String(value % 1_000_000).padStart(6, "0");
}

/** SHA-256 of the code salted with its claim id, hex encoded. */
export async function hashClaimCode(claimId: string, code: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${claimId}:${code.trim()}`));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function getClaimRow(db: Db, id: string): Promise<SchoolClaimRow | undefined> {
  const [row] = await db.select().from(schoolClaims).where(eq(schoolClaims.id, id)).limit(1);
  return row;
}

async function getOwnClaim(db: Db, userId: string, id: string): Promise<SchoolClaimRow> {
  const row = await getClaimRow(db, id);
  if (!row || row.userId !== userId) throw new SchoolClaimError("No such claim.", 404);
  return row;
}

/** Whether `userId` holds an approved claim on the school. */
export async function isSchoolOwner(db: Db, userId: string, slug: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schoolClaims.id })
    .from(schoolClaims)
    .where(and(eq(schoolClaims.userId, userId), eq(schoolClaims.schoolSlug, slug), eq(schoolClaims.status, "approved")))
    .limit(1);
  return Boolean(row);
}

/** The user's claims, newest first, and the schools those approved make them own. */
export async function listMyClaims(db: Db, userId: string) {
  const rows = await db
    .select()
    .from(schoolClaims)
    .where(eq(schoolClaims.userId, userId))
    .orderBy(desc(schoolClaims.createdAt));
  const claims = rows.map(toClaim);
  const owned = new Map<string, string>();
  for (const claim of claims) {
    if (claim.status === "approved" && !owned.has(claim.schoolSlug)) owned.set(claim.schoolSlug, claim.schoolName);
  }
  return { claims, ownedSchools: Array.from(owned, ([slug, name]) => ({ slug, name })) };
}

/** Names of every school a user created, for the claim dropdown. */
export async function listProfileSchoolNames(db: Db): Promise<string[]> {
  const rows = await db.select({ name: schoolProfiles.name }).from(schoolProfiles);
  return rows.map((row: { name: string }) => row.name);
}

/**
 * Files a claim. With a school address it starts `awaiting_email` and hands
 * back the code to email; without one it goes straight to `pending`.
 */
export async function createClaim(
  db: Db,
  input: {
    userId: string;
    schoolName: string;
    schoolSlug: string;
    isNewSchool: boolean;
    role: SchoolRole;
    schoolEmail: string | null;
    explanation: string | null;
    now?: Date;
  },
): Promise<{ claim: SchoolClaim; code: string | null }> {
  const now = input.now ?? new Date();
  const existing = await db
    .select({ status: schoolClaims.status })
    .from(schoolClaims)
    .where(and(eq(schoolClaims.userId, input.userId), eq(schoolClaims.schoolSlug, input.schoolSlug)));
  if (existing.some((row: { status: string }) => row.status === "approved")) {
    throw new SchoolClaimError("You already own this school's page.", 409);
  }
  if (existing.some((row: { status: string }) => OPEN_STATUSES.includes(row.status as ClaimStatus))) {
    throw new SchoolClaimError("You already have a claim on this school waiting — finish or withdraw it first.", 409);
  }

  // A school picked from the list keeps the list's spelling; a school that
  // already has a page (someone created it) keeps that page's name.
  const [profile] = await db
    .select({ name: schoolProfiles.name })
    .from(schoolProfiles)
    .where(eq(schoolProfiles.slug, input.schoolSlug))
    .limit(1);

  const id = crypto.randomUUID();
  const code = input.schoolEmail ? generateClaimCode() : null;
  const row = {
    id,
    userId: input.userId,
    schoolSlug: input.schoolSlug,
    schoolName: profile?.name ?? input.schoolName,
    isNewSchool: input.isNewSchool && !profile,
    role: input.role,
    schoolEmail: input.schoolEmail,
    emailVerified: false,
    codeHash: code ? await hashClaimCode(id, code) : null,
    codeExpiresAt: code ? new Date(now.getTime() + CODE_TTL_MINUTES * 60_000) : null,
    codeAttempts: 0,
    explanation: input.explanation,
    status: (code ? "awaiting_email" : "pending") as ClaimStatus,
    createdAt: now,
  };
  await db.insert(schoolClaims).values(row);
  return { claim: toClaim((await getClaimRow(db, id))!), code };
}

/** Checks an emailed code; a match verifies the address and sends the claim to review. */
export async function verifyClaimCode(
  db: Db,
  input: { userId: string; id: string; code: string; now?: Date },
): Promise<SchoolClaim> {
  const now = input.now ?? new Date();
  const row = await getOwnClaim(db, input.userId, input.id);
  if (row.status !== "awaiting_email" || !row.codeHash) {
    throw new SchoolClaimError("This claim isn't waiting on a code.", 409);
  }
  if (!row.codeExpiresAt || row.codeExpiresAt.getTime() < now.getTime()) {
    throw new SchoolClaimError("That code has expired — send a new one.", 410);
  }
  if (row.codeAttempts >= MAX_CODE_ATTEMPTS) {
    throw new SchoolClaimError("Too many wrong codes — send a new one.", 429);
  }
  if ((await hashClaimCode(row.id, input.code)) !== row.codeHash) {
    await db
      .update(schoolClaims)
      .set({ codeAttempts: row.codeAttempts + 1 })
      .where(eq(schoolClaims.id, row.id));
    throw new SchoolClaimError("That code doesn't match.", 400);
  }
  await db
    .update(schoolClaims)
    .set({ emailVerified: true, status: "pending", codeHash: null, codeExpiresAt: null })
    .where(eq(schoolClaims.id, row.id));
  return toClaim((await getClaimRow(db, row.id))!);
}

/** Issues a new code for a claim still waiting on one, and returns it to email. */
export async function resendClaimCode(
  db: Db,
  input: { userId: string; id: string; now?: Date },
): Promise<{ claim: SchoolClaim; code: string; email: string }> {
  const now = input.now ?? new Date();
  const row = await getOwnClaim(db, input.userId, input.id);
  if (row.status !== "awaiting_email" || !row.schoolEmail) {
    throw new SchoolClaimError("This claim isn't waiting on a code.", 409);
  }
  const code = generateClaimCode();
  await db
    .update(schoolClaims)
    .set({
      codeHash: await hashClaimCode(row.id, code),
      codeExpiresAt: new Date(now.getTime() + CODE_TTL_MINUTES * 60_000),
      codeAttempts: 0,
    })
    .where(eq(schoolClaims.id, row.id));
  return { claim: toClaim((await getClaimRow(db, row.id))!), code, email: row.schoolEmail };
}

/** Deletes a claim that is not approved. An approved one is ownership, removed by staff. */
export async function withdrawClaim(db: Db, userId: string, id: string): Promise<void> {
  const row = await getOwnClaim(db, userId, id);
  if (row.status === "approved") throw new SchoolClaimError("An approved claim can't be withdrawn here.", 409);
  await db.delete(schoolClaims).where(eq(schoolClaims.id, row.id));
}

async function ownersOf(db: Db, slugs: string[]): Promise<Map<string, { name: string; role: SchoolRole }[]>> {
  const owners = new Map<string, { name: string; role: SchoolRole }[]>();
  if (slugs.length === 0) return owners;
  const rows = await db
    .select({ slug: schoolClaims.schoolSlug, role: schoolClaims.role, name: user.name })
    .from(schoolClaims)
    .innerJoin(user, eq(user.id, schoolClaims.userId))
    .where(and(inArray(schoolClaims.schoolSlug, slugs), eq(schoolClaims.status, "approved")))
    .orderBy(asc(schoolClaims.reviewedAt));
  for (const row of rows as { slug: string; role: string; name: string }[]) {
    const list = owners.get(row.slug) ?? [];
    list.push({ name: row.name, role: row.role as SchoolRole });
    owners.set(row.slug, list);
  }
  return owners;
}

/** Claims waiting on a moderator, oldest first, with who filed them and who owns the school now. */
export async function listPendingClaims(db: Db): Promise<PendingSchoolClaim[]> {
  const rows = await db
    .select({ claim: schoolClaims, userName: user.name, userEmail: user.email })
    .from(schoolClaims)
    .innerJoin(user, eq(user.id, schoolClaims.userId))
    .where(eq(schoolClaims.status, "pending"))
    .orderBy(asc(schoolClaims.createdAt));
  const typed = rows as { claim: SchoolClaimRow; userName: string; userEmail: string }[];
  const owners = await ownersOf(db, [...new Set(typed.map((row) => row.claim.schoolSlug))]);
  return typed.map((row) => ({
    ...toClaim(row.claim),
    userName: row.userName,
    userEmail: row.userEmail,
    currentOwners: (owners.get(row.claim.schoolSlug) ?? []).map((owner) => owner.name),
  }));
}

/**
 * Approves or rejects a pending claim. Approving gives the school a profile
 * row when it has none, so a school the claimant created gets a page.
 */
export async function reviewClaim(
  db: Db,
  input: { id: string; decision: "approve" | "reject"; note: string | null; reviewer: string; now?: Date },
): Promise<{ claim: SchoolClaim; userId: string }> {
  const now = input.now ?? new Date();
  const row = await getClaimRow(db, input.id);
  if (!row) throw new SchoolClaimError("No such claim.", 404);
  if (row.status !== "pending") throw new SchoolClaimError("This claim isn't waiting on review.", 409);

  await db
    .update(schoolClaims)
    .set({
      status: input.decision === "approve" ? "approved" : "rejected",
      reviewedBy: input.reviewer,
      reviewNote: input.note,
      reviewedAt: now,
    })
    .where(eq(schoolClaims.id, row.id));

  if (input.decision === "approve") {
    await db
      .insert(schoolProfiles)
      .values({
        slug: row.schoolSlug,
        name: row.schoolName,
        createdBy: row.isNewSchool ? row.userId : null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: schoolProfiles.slug });
  }
  return { claim: toClaim((await getClaimRow(db, row.id))!), userId: row.userId };
}

/** A school page's logo, owners and roster, and whether the viewer may manage them. */
export async function getSchoolPage(
  db: Db,
  slug: string,
  viewer: { userId: string | null; isStaff: boolean },
): Promise<SchoolPageData> {
  const [profile] = await db.select().from(schoolProfiles).where(eq(schoolProfiles.slug, slug)).limit(1);
  const owners = (await ownersOf(db, [slug])).get(slug) ?? [];
  const members = await db
    .select({ id: schoolMembers.id, kind: schoolMembers.kind, name: schoolMembers.name, email: schoolMembers.email })
    .from(schoolMembers)
    .where(eq(schoolMembers.schoolSlug, slug))
    .orderBy(asc(schoolMembers.kind), asc(schoolMembers.name));
  const isOwner = viewer.userId ? await isSchoolOwner(db, viewer.userId, slug) : false;
  const canManage = isOwner || viewer.isStaff;
  return {
    slug,
    name: profile?.name ?? null,
    logo: profile?.logo ?? null,
    owners,
    // A student's contact address is for the people who run the roster only.
    members: (members as { id: string; kind: string; name: string; email: string | null }[]).map((member) => ({
      id: member.id,
      kind: member.kind as SchoolMemberKind,
      name: member.name,
      email: canManage ? member.email : null,
    })),
    canManage,
  };
}

/** The name a profile row is created with: an approved claim's spelling. */
async function profileNameFor(db: Db, slug: string): Promise<string> {
  const [claim] = await db
    .select({ name: schoolClaims.schoolName })
    .from(schoolClaims)
    .where(and(eq(schoolClaims.schoolSlug, slug), eq(schoolClaims.status, "approved")))
    .limit(1);
  return claim?.name ?? slug;
}

/** Sets (a data URL) or deletes (`null`) a school's logo. */
export async function setSchoolLogo(db: Db, slug: string, logo: string | null, now = new Date()): Promise<void> {
  const name = await profileNameFor(db, slug);
  await db
    .insert(schoolProfiles)
    .values({ slug, name, logo, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: schoolProfiles.slug, set: { logo, updatedAt: now } });
}

/** Adds a team or student to a school's roster; a repeat of the same name and kind is a no-op. */
export async function addSchoolMember(
  db: Db,
  input: { slug: string; kind: SchoolMemberKind; name: string; email: string | null; addedBy: string },
): Promise<void> {
  const rows = await db
    .select({ kind: schoolMembers.kind, name: schoolMembers.name })
    .from(schoolMembers)
    .where(eq(schoolMembers.schoolSlug, input.slug));
  const typed = rows as { kind: string; name: string }[];
  if (typed.some((row) => row.kind === input.kind && row.name.toLowerCase() === input.name.toLowerCase())) return;
  if (typed.length >= MAX_SCHOOL_MEMBERS) {
    throw new SchoolClaimError(`A school's roster holds at most ${MAX_SCHOOL_MEMBERS} entries.`, 409);
  }
  await db.insert(schoolMembers).values({
    id: crypto.randomUUID(),
    schoolSlug: input.slug,
    kind: input.kind,
    name: input.name,
    email: input.email,
    addedBy: input.addedBy,
    createdAt: new Date(),
  });
}

/** Removes one roster entry of a school. */
export async function removeSchoolMember(db: Db, slug: string, id: string): Promise<void> {
  await db.delete(schoolMembers).where(and(eq(schoolMembers.schoolSlug, slug), eq(schoolMembers.id, id)));
}
