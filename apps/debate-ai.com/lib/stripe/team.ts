import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { teamAssignments, teamStudents, user } from "@/lib/database/schema";
import { limitsFor, type TierId } from "debate-webview/lib/stripe/limits";
import { getUserTier } from "./usage";

/**
 * The Research Team plan's coaching tools: a roster of up to
 * `teamStudents` students and the lesson plans / practice drills the coach
 * assigns to all of them (or to a chosen few). Backs `/api/team/*`.
 */

export type AssignmentKind = "lesson-plan" | "practice-drill";
export const ASSIGNMENT_KINDS: readonly AssignmentKind[] = ["lesson-plan", "practice-drill"];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MAX_TITLE_CHARS = 200;
export const MAX_BODY_CHARS = 20_000;

export class TeamError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return EMAIL.test(email) && email.length <= 254 ? email : null;
}

/** The coach's tier, refusing anyone whose plan has no team roster. */
export async function requireTeamTier(db: any, userId: string): Promise<TierId> {
  const tier = await getUserTier(db, userId);
  if (limitsFor(tier).teamStudents === 0) {
    throw new TeamError("Team rosters, lesson plans and practice drills are part of the Research Team plan.", 403);
  }
  return tier;
}

export async function listStudents(db: any, ownerUserId: string): Promise<string[]> {
  const rows = await db
    .select({ email: teamStudents.studentEmail })
    .from(teamStudents)
    .where(eq(teamStudents.ownerUserId, ownerUserId))
    .orderBy(asc(teamStudents.createdAt), asc(teamStudents.studentEmail));
  return rows.map((row: { email: string }) => row.email);
}

export async function addStudent(db: any, ownerUserId: string, tier: TierId, rawEmail: unknown): Promise<string[]> {
  const email = normalizeEmail(rawEmail);
  if (!email) throw new TeamError("Enter a valid student email.", 400);
  const [owner] = await db.select({ email: user.email }).from(user).where(eq(user.id, ownerUserId)).limit(1);
  if (owner?.email?.toLowerCase() === email) throw new TeamError("You can't add yourself as a student.", 400);

  const students = await listStudents(db, ownerUserId);
  if (students.includes(email)) return students;
  const max = limitsFor(tier).teamStudents;
  if (students.length >= max) {
    throw new TeamError(`Your plan allows up to ${max} students. Remove one to add another.`, 409);
  }
  await db.insert(teamStudents).values({ ownerUserId, studentEmail: email }).onConflictDoNothing();
  return [...students, email];
}

export async function removeStudent(db: any, ownerUserId: string, rawEmail: unknown): Promise<void> {
  const email = normalizeEmail(rawEmail);
  if (!email) throw new TeamError("Enter a valid student email.", 400);
  await db
    .delete(teamStudents)
    .where(and(eq(teamStudents.ownerUserId, ownerUserId), eq(teamStudents.studentEmail, email)));
}

export interface Assignment {
  id: number;
  kind: AssignmentKind;
  title: string;
  body: string;
  /** The students it targets; `null` means everyone on the roster. */
  studentEmails: string[] | null;
  dueAt: string | null;
  createdAt: string;
}

function toAssignment(row: any): Assignment {
  const toIso = (value: unknown) => (value instanceof Date ? value.toISOString() : value == null ? null : String(value));
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    studentEmails: row.studentEmails ? (JSON.parse(row.studentEmails) as string[]) : null,
    dueAt: toIso(row.dueAt),
    createdAt: toIso(row.createdAt) ?? "",
  };
}

export async function listAssignments(db: any, ownerUserId: string): Promise<Assignment[]> {
  const rows = await db
    .select()
    .from(teamAssignments)
    .where(eq(teamAssignments.ownerUserId, ownerUserId))
    .orderBy(desc(teamAssignments.createdAt), desc(teamAssignments.id));
  return rows.map(toAssignment);
}

export interface NewAssignment {
  kind?: unknown;
  title?: unknown;
  body?: unknown;
  studentEmails?: unknown;
  dueAt?: unknown;
}

/**
 * Assigns a lesson plan or practice drill. With no `studentEmails` it goes to
 * every student on the roster (including ones added later); otherwise each
 * listed email must already be on the roster.
 */
export async function createAssignment(
  db: any,
  ownerUserId: string,
  tier: TierId,
  input: NewAssignment,
): Promise<Assignment> {
  const kind = input.kind as AssignmentKind;
  if (!ASSIGNMENT_KINDS.includes(kind)) throw new TeamError("`kind` must be `lesson-plan` or `practice-drill`.", 400);
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) throw new TeamError("Give the assignment a title.", 400);
  if (title.length > MAX_TITLE_CHARS) throw new TeamError("Title is too long.", 413);
  const body = typeof input.body === "string" ? input.body : "";
  if (body.length > MAX_BODY_CHARS) throw new TeamError("Assignment is too long.", 413);

  let studentEmails: string[] | null = null;
  if (Array.isArray(input.studentEmails) && input.studentEmails.length > 0) {
    const roster = new Set(await listStudents(db, ownerUserId));
    studentEmails = [...new Set(input.studentEmails.map(normalizeEmail))].filter((e): e is string => !!e);
    const missing = studentEmails.filter((email) => !roster.has(email));
    if (missing.length || studentEmails.length === 0) {
      throw new TeamError(`Not on your roster: ${missing.join(", ") || "no valid emails"}.`, 400);
    }
  }

  let dueAt: Date | null = null;
  if (input.dueAt != null && input.dueAt !== "") {
    dueAt = new Date(String(input.dueAt));
    if (Number.isNaN(dueAt.getTime())) throw new TeamError("`dueAt` must be a date.", 400);
  }

  const limits = limitsFor(tier);
  const max = kind === "lesson-plan" ? limits.lessonPlans : limits.practiceDrills;
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(teamAssignments)
    .where(and(eq(teamAssignments.ownerUserId, ownerUserId), eq(teamAssignments.kind, kind)));
  if (Number(count) >= max) {
    const what = kind === "lesson-plan" ? "lesson plans" : "practice drills";
    throw new TeamError(`Your plan allows up to ${max} ${what}. Delete an old one to add another.`, 409);
  }

  const [row] = await db
    .insert(teamAssignments)
    .values({
      ownerUserId,
      kind,
      title,
      body,
      studentEmails: studentEmails ? JSON.stringify(studentEmails) : null,
      dueAt,
    })
    .returning();
  return toAssignment(row);
}

export async function deleteAssignment(db: any, ownerUserId: string, id: unknown): Promise<void> {
  const assignmentId = Number(id);
  if (!Number.isInteger(assignmentId)) throw new TeamError("`id` must be an assignment id.", 400);
  await db
    .delete(teamAssignments)
    .where(and(eq(teamAssignments.ownerUserId, ownerUserId), eq(teamAssignments.id, assignmentId)));
}

export interface StudentAssignment extends Assignment {
  coachName: string | null;
}

/**
 * Everything assigned to the student with this email across the rosters
 * they're on. Assignments from a coach whose Research Team plan has lapsed
 * are hidden until it's renewed.
 */
export async function assignmentsForStudent(db: any, rawEmail: string): Promise<StudentAssignment[]> {
  const email = normalizeEmail(rawEmail);
  if (!email) return [];
  const coaches = await db
    .select({ ownerUserId: teamStudents.ownerUserId, name: user.name })
    .from(teamStudents)
    .innerJoin(user, eq(user.id, teamStudents.ownerUserId))
    .where(eq(teamStudents.studentEmail, email));
  const active: { ownerUserId: string; name: string | null }[] = [];
  for (const coach of coaches) {
    if (limitsFor(await getUserTier(db, coach.ownerUserId)).teamStudents > 0) active.push(coach);
  }
  if (active.length === 0) return [];

  const names = new Map(active.map((coach) => [coach.ownerUserId, coach.name]));
  const rows = await db
    .select()
    .from(teamAssignments)
    .where(inArray(teamAssignments.ownerUserId, [...names.keys()]))
    .orderBy(desc(teamAssignments.createdAt), desc(teamAssignments.id));
  return rows
    .map((row: any) => ({ ...toAssignment(row), coachName: names.get(row.ownerUserId) ?? null }))
    .filter((a: StudentAssignment) => a.studentEmails === null || a.studentEmails.includes(email));
}
