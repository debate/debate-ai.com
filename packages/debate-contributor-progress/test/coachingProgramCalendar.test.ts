import { beforeEach, describe, expect, it } from "vitest";
import { buildPersistedCoachingProgramCalendar } from "../src/state/coachingProgramCalendar";
import { saveCoachingProgram } from "debate-team-collaboration/src/state/coachingPrograms";
import { saveGroupChallenge } from "debate-team-collaboration/src/state/groupChallenges";
import { saveSprintNote } from "debate-team-collaboration/src/state/sprintNotes";
import type { CoachingProgramConfig } from "debate-team-collaboration/src/round/coaching-program";
import type { GroupChallenge } from "debate-team-collaboration/src/lib/group-challenges";
import type { SprintNote } from "debate-team-collaboration/src/lib/team-collaboration-mode";

/** Minimal in-memory `localStorage` mock — this package's Vitest environment is `node`, with no DOM. */
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

const VARSITY: CoachingProgramConfig = { id: "varsity", name: "Varsity Squad", memberIds: ["alice", "bob"] };

const REBUTTAL_CHALLENGE: GroupChallenge = {
  id: "challenge-1",
  title: "Win 3 rebuttal exercises",
  goal: { kind: "win_target", targetCount: 3 },
  memberIds: ["alice", "bob"],
  startsAt: Date.UTC(2026, 8, 1),
  endsAt: Date.UTC(2026, 8, 8),
};

const WARMING_NOTE: SprintNote = {
  id: "note-1",
  topic: "Warming",
  authorId: "alice",
  text: "Need more impact cards.",
  status: "open",
  createdAt: Date.UTC(2026, 8, 3),
  updatedAt: Date.UTC(2026, 8, 3),
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("buildPersistedCoachingProgramCalendar", () => {
  it("returns undefined for a programId with no stored config", () => {
    expect(buildPersistedCoachingProgramCalendar("missing", "")).toBeUndefined();
  });

  it("returns an empty schedule for a program with no challenges or matching notes", () => {
    saveCoachingProgram(VARSITY);
    expect(buildPersistedCoachingProgramCalendar("varsity", "")).toEqual([]);
  });

  it("includes the program's roster-scoped challenge windows", () => {
    saveCoachingProgram(VARSITY);
    saveGroupChallenge(REBUTTAL_CHALLENGE);

    const calendar = buildPersistedCoachingProgramCalendar("varsity", "");
    expect(calendar).toHaveLength(2);
    expect(calendar!.map((event) => event.kind)).toEqual(["challenge-start", "challenge-end"]);
  });

  it("excludes a challenge scoped to a different roster entirely", () => {
    saveCoachingProgram({ id: "jv", name: "JV Squad", memberIds: ["carol"] });
    saveGroupChallenge(REBUTTAL_CHALLENGE); // scoped to alice/bob, not carol

    expect(buildPersistedCoachingProgramCalendar("jv", "")).toEqual([]);
  });

  it("includes the given topic's sprint notes when a topic is supplied", () => {
    saveCoachingProgram(VARSITY);
    saveSprintNote(WARMING_NOTE);

    const calendar = buildPersistedCoachingProgramCalendar("varsity", "Warming");
    expect(calendar).toHaveLength(1);
    expect(calendar![0]).toMatchObject({ kind: "sprint-note", dayKey: "2026-09-03" });
  });

  it("omits sprint notes when no topic is supplied, even though notes exist", () => {
    saveCoachingProgram(VARSITY);
    saveSprintNote(WARMING_NOTE);

    expect(buildPersistedCoachingProgramCalendar("varsity", "")).toEqual([]);
  });

  it("omits a different topic's notes", () => {
    saveCoachingProgram(VARSITY);
    saveSprintNote(WARMING_NOTE);

    expect(buildPersistedCoachingProgramCalendar("varsity", "Immigration")).toEqual([]);
  });
});
