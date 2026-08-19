/**
 * @fileoverview Persistent storage for a coaching program's member-to-round
 * links — the data half of the "(c) wiring a member's practice-round
 * setup/feedback (Practice Round Simulator) into the space" follow-up named
 * under idea #13 ("Coaching Programs and Group Challenges") in TODO.md.
 *
 * A `CoachingProgramConfig` only carries a roster of member ids; it has no
 * way to know which `practiceRounds.ts` record (keyed by `roundId`) belongs
 * to which member. This store persists that link — one `roundId` per
 * `(programId, memberId)` pair — so `round/coaching-program-member-round-wiring.ts`
 * can resolve a member's practice-round setup/feedback straight from the
 * already-persisted `practiceRounds.ts` store. Stores records in
 * localStorage, mirroring the existing `coachingPrograms.ts` persistence
 * convention (SSR/no-storage-safe, corrupt or missing JSON degrades to an
 * empty list rather than throwing).
 *
 * @module state/coachingProgramMemberRounds
 */

/** Links one coaching-program member to the practice round (`practiceRounds.ts` roundId) that is theirs. */
export type MemberRoundLink = {
  programId: string;
  memberId: string;
  roundId: string;
};

const STORAGE_KEY = "coachingProgramMemberRounds";

function readAll(): MemberRoundLink[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MemberRoundLink[]) : [];
  } catch {
    return [];
  }
}

function writeAll(links: MemberRoundLink[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
}

/** Lists every member-round link saved for one coaching program. */
export function listMemberRoundLinks(programId: string): MemberRoundLink[] {
  return readAll().filter((link) => link.programId === programId);
}

/** Looks up one member's linked round within a program, if any. */
export function getMemberRoundLink(programId: string, memberId: string): MemberRoundLink | undefined {
  return readAll().find((link) => link.programId === programId && link.memberId === memberId);
}

/** Saves a member's round link, overwriting any existing link for the same `(programId, memberId)` pair. */
export function saveMemberRoundLink(link: MemberRoundLink): void {
  const links = readAll();
  const index = links.findIndex(
    (existing) => existing.programId === link.programId && existing.memberId === link.memberId,
  );
  if (index === -1) {
    links.push(link);
  } else {
    links[index] = link;
  }
  writeAll(links);
}

/** Deletes a member's round link within a program; a no-op if it isn't stored. */
export function deleteMemberRoundLink(programId: string, memberId: string): void {
  writeAll(readAll().filter((link) => !(link.programId === programId && link.memberId === memberId)));
}

/** Deletes every member-round link for a coaching program (e.g. when the program itself is removed). */
export function deleteMemberRoundLinksForProgram(programId: string): void {
  writeAll(readAll().filter((link) => link.programId !== programId));
}
