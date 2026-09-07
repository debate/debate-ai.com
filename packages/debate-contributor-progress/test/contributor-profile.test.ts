import { beforeEach, describe, expect, it } from "vitest";
import type { AttributedContribution } from "debate-research-evidence/src/lib/contribution-leaderboard";
import { recordPersistedEndorsement, saveContribution } from "debate-research-evidence/src/state/contributions";
import { announceContributorAwards } from "../src/state/contributorAwardAnnouncements";
import { buildContributorProfileFromStore } from "../src/lib/contributor-profile";

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

function contribution(
  id: string,
  contributorId: string,
  overrides: Partial<AttributedContribution> = {},
): AttributedContribution {
  return {
    id,
    contributorId,
    kind: "card",
    likes: 5,
    saves: 2,
    qualitySignals: [0.9],
    reviewerEndorsements: [],
    ...overrides,
  };
}

describe("buildContributorProfileFromStore", () => {
  beforeEach(() => {
    (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
  });

  it("returns an all-zero, non-existent profile for a contributor with no activity anywhere", () => {
    const profile = buildContributorProfileFromStore("ghost", "2026-09-06");

    expect(profile.exists).toBe(false);
    expect(profile.rank).toBeNull();
    expect(profile.stats.contributionCount).toBe(0);
    expect(profile.unlockStatus.tier).toBe("novice");
    expect(profile.currentAwards).toEqual([]);
    expect(profile.hallOfFame).toBeNull();
    expect(profile.endorsementsReceived).toEqual([]);
    expect(profile.endorsementsGiven).toEqual([]);
  });

  it("ranks a contributor against the rest of the leaderboard and surfaces their stats and tier", () => {
    saveContribution(contribution("c1", "alice"));
    saveContribution(contribution("c2", "alice"));
    saveContribution(contribution("c3", "bob", { likes: 1, saves: 0, qualitySignals: [0.1] }));

    const profile = buildContributorProfileFromStore("alice", "2026-09-06");

    expect(profile.exists).toBe(true);
    expect(profile.rank).toBe(1);
    expect(profile.stats.contributionCount).toBe(2);
    expect(profile.stats.totalHelpfulnessScore).toBeGreaterThan(0);
    expect(profile.unlockStatus.tier).toBeDefined();
  });

  it("surfaces the categories a contributor currently leads", () => {
    saveContribution(contribution("c1", "alice", { kind: "card" }));
    saveContribution(contribution("c2", "alice", { kind: "summary" }));

    const profile = buildContributorProfileFromStore("alice", "2026-09-06");

    expect(profile.currentAwards.map((award) => award.kind).sort()).toEqual(["card", "summary"]);
  });

  it("aggregates announced award wins into an all-time hall-of-fame record", () => {
    saveContribution(contribution("c1", "alice", { kind: "card" }));
    announceContributorAwards(Date.parse("2026-09-01T00:00:00Z"));

    saveContribution(contribution("c2", "alice", { kind: "card", likes: 50, saves: 20, qualitySignals: [1] }));
    announceContributorAwards(Date.parse("2026-09-02T00:00:00Z"));

    const profile = buildContributorProfileFromStore("alice", "2026-09-06");

    expect(profile.hallOfFame).not.toBeNull();
    expect(profile.hallOfFame?.totalWins).toBe(2);
    expect(profile.hallOfFame?.winsByKind.card).toBe(2);
  });

  it("lists endorsements received and given for a contributor, newest first", () => {
    saveContribution(contribution("c1", "alice"));
    saveContribution(contribution("c2", "bob"));

    recordPersistedEndorsement("c1", 1, "bob", 1000);
    recordPersistedEndorsement("c2", 1, "alice", 2000);

    const aliceProfile = buildContributorProfileFromStore("alice", "2026-09-06");
    expect(aliceProfile.endorsementsReceived).toHaveLength(1);
    expect(aliceProfile.endorsementsReceived[0].reviewerId).toBe("bob");
    expect(aliceProfile.endorsementsGiven).toHaveLength(1);
    expect(aliceProfile.endorsementsGiven[0].contributionContributorId).toBe("bob");
    expect(aliceProfile.exists).toBe(true);
  });

  it("treats a contributor with only endorsement activity (no scored contribution) as existing but unranked", () => {
    saveContribution(contribution("c1", "bob"));
    recordPersistedEndorsement("c1", 1, "carol", 1000);

    const profile = buildContributorProfileFromStore("carol", "2026-09-06");

    expect(profile.rank).toBeNull();
    expect(profile.exists).toBe(true);
    expect(profile.endorsementsGiven).toHaveLength(1);
  });
});
