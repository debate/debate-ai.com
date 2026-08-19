import { beforeEach, describe, expect, it } from "vitest";
import {
  buildCoachingProgramMemberRoundStatuses,
  buildMemberPracticeRoundStatusText,
} from "../src/round/coaching-program-member-round-wiring";
import { saveMemberRoundLink } from "../src/state/coachingProgramMemberRounds";
import { savePracticeRound, type PracticeRoundRecord } from "../src/state/practiceRounds";
import { buildPracticeRoundSetup } from "../src/round/practice-round-simulator";
import type { CoachingProgramConfig } from "../src/round/coaching-program";

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

const PROGRAM: CoachingProgramConfig = {
  id: "varsity",
  name: "Varsity Squad",
  memberIds: ["alice", "bob", "carol"],
};

const SETUP = buildPracticeRoundSetup({ styleKey: "lincolnDouglas", judgeParadigm: "lay" });
const ROUND: PracticeRoundRecord = { roundId: "round-1", setup: SETUP };
const ROUND_WITH_FEEDBACK: PracticeRoundRecord = {
  roundId: "round-2",
  setup: SETUP,
  feedback: {
    judgeParadigm: SETUP.judgeParadigm,
    coachingPrompts: [],
    sections: [{ title: "Judged under: Lay / Community Judge", body: "Votes on framework first." }],
  },
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("buildCoachingProgramMemberRoundStatuses", () => {
  it("resolves every roster member in roster order", () => {
    const statuses = buildCoachingProgramMemberRoundStatuses(PROGRAM);
    expect(statuses.map((s) => s.memberId)).toEqual(["alice", "bob", "carol"]);
  });

  it("returns a null roundId/record for a member with no saved link", () => {
    const statuses = buildCoachingProgramMemberRoundStatuses(PROGRAM);
    expect(statuses[0]).toEqual({ memberId: "alice", roundId: null, record: null });
  });

  it("resolves a linked member's practice-round record through the practiceRounds store", () => {
    saveMemberRoundLink({ programId: "varsity", memberId: "alice", roundId: "round-1" });
    savePracticeRound(ROUND);

    const statuses = buildCoachingProgramMemberRoundStatuses(PROGRAM);
    expect(statuses[0]).toEqual({ memberId: "alice", roundId: "round-1", record: ROUND });
  });

  it("returns a null record when the linked round was since cleared", () => {
    saveMemberRoundLink({ programId: "varsity", memberId: "alice", roundId: "round-9" });

    const statuses = buildCoachingProgramMemberRoundStatuses(PROGRAM);
    expect(statuses[0]).toEqual({ memberId: "alice", roundId: "round-9", record: null });
  });

  it("does not cross-resolve a link saved under a different programId", () => {
    saveMemberRoundLink({ programId: "jv", memberId: "alice", roundId: "round-1" });
    savePracticeRound(ROUND);

    const statuses = buildCoachingProgramMemberRoundStatuses(PROGRAM);
    expect(statuses[0]).toEqual({ memberId: "alice", roundId: null, record: null });
  });
});

describe("buildMemberPracticeRoundStatusText", () => {
  it("returns a placeholder line when nothing is linked", () => {
    expect(buildMemberPracticeRoundStatusText({ memberId: "alice", roundId: null, record: null })).toBe(
      "No practice round linked yet.",
    );
  });

  it("returns an actionable placeholder when the linked round can't be found", () => {
    expect(
      buildMemberPracticeRoundStatusText({ memberId: "alice", roundId: "round-9", record: null }),
    ).toBe('Linked round "round-9" was not found — it may have been cleared.');
  });

  it("renders the round's setup text when there's no feedback yet", () => {
    const text = buildMemberPracticeRoundStatusText({
      memberId: "alice",
      roundId: "round-1",
      record: ROUND,
    });
    expect(text).toContain("### Speech order");
    expect(text).toContain("No post-round feedback yet.");
  });

  it("renders both setup and feedback text once feedback exists", () => {
    const text = buildMemberPracticeRoundStatusText({
      memberId: "alice",
      roundId: "round-2",
      record: ROUND_WITH_FEEDBACK,
    });
    expect(text).toContain("### Speech order");
    expect(text).toContain("Judged under: Lay / Community Judge");
    expect(text).not.toContain("No post-round feedback yet.");
  });
});
