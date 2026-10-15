/**
 * @fileoverview The school-claim queries against a real SQLite database: an
 * emailed code moves a claim to review, wrong and expired codes are refused,
 * approval makes the claimant an owner and gives a created school a page,
 * and the roster and logo belong to that page.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  SchoolClaimError,
  addSchoolMember,
  createClaim,
  getSchoolPage,
  hashClaimCode,
  isSchoolOwner,
  listMyClaims,
  listPendingClaims,
  listProfileSchoolNames,
  removeSchoolMember,
  resendClaimCode,
  reviewClaim,
  setSchoolLogo,
  verifyClaimCode,
  withdrawClaim,
} from "@/lib/school-claims/queries";
import { freshSchemaDb } from "@/lib/database/__tests__/schema-sql";

type Db = Awaited<ReturnType<typeof freshSchemaDb>>;
let db: never;

async function addUser(raw: Db, id: string) {
  await raw.$client.execute({
    sql: "INSERT INTO user (id, name, email, created_at, updated_at) VALUES (?, ?, ?, unixepoch(), unixepoch())",
    args: [id, `User ${id}`, `${id}@example.test`],
  });
}

const harker = { schoolName: "Harker", schoolSlug: "harker", isNewSchool: false, role: "coach" as const };

describe("school claim queries", () => {
  beforeEach(async () => {
    const raw = await freshSchemaDb();
    await addUser(raw, "u1");
    await addUser(raw, "u2");
    db = raw as never;
  });

  it("emails a code, then a matching code sends the claim to review", async () => {
    const { claim, code } = await createClaim(db, { userId: "u1", ...harker, schoolEmail: "c@harker.org", explanation: null });
    expect(claim.status).toBe("awaiting_email");
    expect(code).toMatch(/^\d{6}$/);
    expect(await listPendingClaims(db)).toEqual([]);

    const verified = await verifyClaimCode(db, { userId: "u1", id: claim.id, code: code! });
    expect(verified).toMatchObject({ status: "pending", emailVerified: true });
    const pending = await listPendingClaims(db);
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ userName: "User u1", userEmail: "u1@example.test", currentOwners: [] });
  });

  it("refuses a wrong code, an expired code, and another user's claim", async () => {
    const now = new Date("2026-10-13T12:00:00Z");
    const { claim, code } = await createClaim(db, { userId: "u1", ...harker, schoolEmail: "c@harker.org", explanation: null, now });
    const wrong = code === "000000" ? "111111" : "000000";
    await expect(verifyClaimCode(db, { userId: "u1", id: claim.id, code: wrong, now })).rejects.toThrow("doesn't match");
    await expect(verifyClaimCode(db, { userId: "u2", id: claim.id, code: code!, now })).rejects.toThrow(SchoolClaimError);
    const later = new Date(now.getTime() + 16 * 60_000);
    await expect(verifyClaimCode(db, { userId: "u1", id: claim.id, code: code!, now: later })).rejects.toThrow("expired");

    const resent = await resendClaimCode(db, { userId: "u1", id: claim.id, now: later });
    expect(await verifyClaimCode(db, { userId: "u1", id: claim.id, code: resent.code, now: later })).toMatchObject({ status: "pending" });
  });

  it("never stores the code itself", async () => {
    const { claim, code } = await createClaim(db, { userId: "u1", ...harker, schoolEmail: "c@harker.org", explanation: null });
    const raw = db as unknown as Db;
    const { rows } = await raw.$client.execute({ sql: "SELECT code_hash FROM school_claims WHERE id = ?", args: [claim.id] });
    expect(rows[0].code_hash).toBe(await hashClaimCode(claim.id, code!));
    expect(rows[0].code_hash).not.toContain(code!);
  });

  it("refuses a second open claim on the same school, and allows one after withdrawing", async () => {
    const first = await createClaim(db, { userId: "u1", ...harker, schoolEmail: null, explanation: "I coach the team there." });
    expect(first.claim.status).toBe("pending");
    await expect(createClaim(db, { userId: "u1", ...harker, schoolEmail: null, explanation: "I coach the team there." })).rejects.toThrow(
      "already have a claim",
    );
    await withdrawClaim(db, "u1", first.claim.id);
    await expect(createClaim(db, { userId: "u1", ...harker, schoolEmail: null, explanation: "I coach the team there." })).resolves.toBeTruthy();
  });

  it("approval makes the claimant an owner and gives a created school a page", async () => {
    const { claim } = await createClaim(db, {
      userId: "u1",
      schoolName: "Lincoln High",
      schoolSlug: "lincoln-high",
      isNewSchool: true,
      role: "admin",
      schoolEmail: null,
      explanation: "I'm the activities director.",
    });
    expect(await isSchoolOwner(db, "u1", "lincoln-high")).toBe(false);
    const { claim: approved, userId } = await reviewClaim(db, { id: claim.id, decision: "approve", note: "Welcome", reviewer: "mod@example.test" });
    expect(userId).toBe("u1");
    expect(approved).toMatchObject({ status: "approved", reviewNote: "Welcome" });
    expect(await isSchoolOwner(db, "u1", "lincoln-high")).toBe(true);
    expect(await listProfileSchoolNames(db)).toEqual(["Lincoln High"]);
    expect((await listMyClaims(db, "u1")).ownedSchools).toEqual([{ slug: "lincoln-high", name: "Lincoln High" }]);
    await expect(reviewClaim(db, { id: claim.id, decision: "reject", note: null, reviewer: "mod@example.test" })).rejects.toThrow(
      "isn't waiting",
    );
    await expect(withdrawClaim(db, "u1", claim.id)).rejects.toThrow(SchoolClaimError);

    // A second claim on the now-owned school names its owner to the moderator.
    await createClaim(db, { userId: "u2", ...harker, schoolName: "Lincoln High", schoolSlug: "lincoln-high", schoolEmail: null, explanation: "Assistant coach here." });
    expect((await listPendingClaims(db))[0].currentOwners).toEqual(["User u1"]);
  });

  it("a rejected claim makes no owner", async () => {
    const { claim } = await createClaim(db, { userId: "u1", ...harker, schoolEmail: null, explanation: "I coach the team there." });
    await reviewClaim(db, { id: claim.id, decision: "reject", note: null, reviewer: "mod@example.test" });
    expect(await isSchoolOwner(db, "u1", "harker")).toBe(false);
    expect(await listProfileSchoolNames(db)).toEqual([]);
  });

  it("keeps a school's roster and logo, hiding student emails from non-managers", async () => {
    const { claim } = await createClaim(db, { userId: "u1", ...harker, schoolEmail: null, explanation: "I coach the team there." });
    await reviewClaim(db, { id: claim.id, decision: "approve", note: null, reviewer: "mod@example.test" });

    await addSchoolMember(db, { slug: "harker", kind: "team", name: "Lee & Lin", email: null, addedBy: "u1" });
    await addSchoolMember(db, { slug: "harker", kind: "team", name: "lee & lin", email: null, addedBy: "u1" });
    await addSchoolMember(db, { slug: "harker", kind: "student", name: "Ana", email: "ana@harker.org", addedBy: "u1" });
    await setSchoolLogo(db, "harker", "data:image/png;base64,iVBORw0KGgo=");

    const owner = await getSchoolPage(db, "harker", { userId: "u1", isStaff: false });
    expect(owner).toMatchObject({
      name: "Harker",
      logo: "data:image/png;base64,iVBORw0KGgo=",
      owners: [{ name: "User u1", role: "coach" }],
      canManage: true,
    });
    expect(owner.members.map((m) => [m.kind, m.name, m.email])).toEqual([
      ["student", "Ana", "ana@harker.org"],
      ["team", "Lee & Lin", null],
    ]);

    const visitor = await getSchoolPage(db, "harker", { userId: "u2", isStaff: false });
    expect(visitor.canManage).toBe(false);
    expect(visitor.members.find((m) => m.kind === "student")?.email).toBeNull();

    await setSchoolLogo(db, "harker", null);
    await removeSchoolMember(db, "harker", owner.members[0].id);
    const after = await getSchoolPage(db, "harker", { userId: null, isStaff: false });
    expect(after.logo).toBeNull();
    expect(after.members.map((m) => m.name)).toEqual(["Lee & Lin"]);
  });
});
