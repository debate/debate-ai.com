import { beforeEach, describe, expect, it } from "vitest";
import {
  buildDailyBestCardsFromStore,
  buildPersistedContributionFeed,
  buildPersistedLeaderboard,
  buildTopContributorAwardsFromStore,
  deleteContribution,
  getContribution,
  getContributionPublicationStatus,
  getTodaysBestCardFromStore,
  isContributionVisibleInPublicFeed,
  listContributions,
  listContributionsByContributor,
  recordPersistedEndorsement,
  recordPersistedEndorsementFromReviewer,
  recordPersistedLike,
  recordPersistedSave,
  saveContribution,
  sendContributionToReview,
} from "../src/state/contributions";
import type { AttributedContribution } from "../src/lib/contribution-leaderboard";
import { DEFAULT_AWARD_CATEGORY_LABELS } from "../src/lib/contributor-awards";
import { MIN_REVIEWER_CREDIBILITY, computeReviewerCredibility } from "../src/lib/community-rating";
import { approveReview, publishReview, submitForReview } from "../src/lib/peer-review";
import { getPeerReview, savePeerReview } from "../src/state/peerReviews";

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

const ALICE_CARD: AttributedContribution = {
  id: "contrib-1",
  contributorId: "alice",
  kind: "card",
  likes: 12,
  saves: 4,
  qualitySignals: [0.8, 0.9],
  reviewerEndorsements: [{ reviewerWeight: 0.7 }],
};
const BOB_SUMMARY: AttributedContribution = {
  id: "contrib-2",
  contributorId: "bob",
  kind: "summary",
  likes: 3,
  saves: 1,
  qualitySignals: [0.5],
  reviewerEndorsements: [],
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listContributions", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listContributions()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("contributions", "{not json");
    expect(listContributions()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("contributions", JSON.stringify({ not: "an array" }));
    expect(listContributions()).toEqual([]);
  });

  it("lists every saved contribution across contributors", () => {
    saveContribution(ALICE_CARD);
    saveContribution(BOB_SUMMARY);
    expect(listContributions()).toEqual([ALICE_CARD, BOB_SUMMARY]);
  });
});

describe("listContributionsByContributor", () => {
  it("returns only contributions for the given contributor", () => {
    saveContribution(BOB_SUMMARY);
    saveContribution(ALICE_CARD);
    expect(listContributionsByContributor("alice")).toEqual([ALICE_CARD]);
    expect(listContributionsByContributor("bob")).toEqual([BOB_SUMMARY]);
  });

  it("returns an empty list for a contributor with no contributions", () => {
    saveContribution(ALICE_CARD);
    expect(listContributionsByContributor("carol")).toEqual([]);
  });
});

describe("getContribution", () => {
  it("finds a saved contribution by id", () => {
    saveContribution(ALICE_CARD);
    expect(getContribution("contrib-1")).toEqual(ALICE_CARD);
  });

  it("returns undefined for an id that isn't stored", () => {
    expect(getContribution("missing")).toBeUndefined();
  });
});

describe("saveContribution", () => {
  it("upserts — saving an existing id overwrites rather than duplicating it", () => {
    saveContribution(ALICE_CARD);
    const revised: AttributedContribution = { ...ALICE_CARD, likes: 20 };
    saveContribution(revised);

    expect(listContributions()).toEqual([revised]);
    expect(getContribution("contrib-1")).toEqual(revised);
  });
});

describe("deleteContribution", () => {
  it("removes a stored contribution by id", () => {
    saveContribution(ALICE_CARD);
    saveContribution(BOB_SUMMARY);
    deleteContribution("contrib-1");

    expect(listContributions()).toEqual([BOB_SUMMARY]);
    expect(getContribution("contrib-1")).toBeUndefined();
  });

  it("is a no-op when the id isn't stored", () => {
    saveContribution(BOB_SUMMARY);
    deleteContribution("missing");
    expect(listContributions()).toEqual([BOB_SUMMARY]);
  });
});

describe("recordPersistedLike", () => {
  it("increments and persists the stored contribution's likes", () => {
    saveContribution(ALICE_CARD);
    const updated = recordPersistedLike("contrib-1");

    expect(updated?.likes).toBe(13);
    expect(getContribution("contrib-1")?.likes).toBe(13);
  });

  it("accumulates across repeated likes", () => {
    saveContribution(ALICE_CARD);
    recordPersistedLike("contrib-1");
    recordPersistedLike("contrib-1");

    expect(getContribution("contrib-1")?.likes).toBe(14);
  });

  it("returns undefined and leaves storage untouched for an id that isn't stored", () => {
    saveContribution(ALICE_CARD);
    expect(recordPersistedLike("missing")).toBeUndefined();
    expect(getContribution("contrib-1")).toEqual(ALICE_CARD);
  });
});

describe("recordPersistedSave", () => {
  it("increments and persists the stored contribution's saves", () => {
    saveContribution(ALICE_CARD);
    const updated = recordPersistedSave("contrib-1");

    expect(updated?.saves).toBe(5);
    expect(getContribution("contrib-1")?.saves).toBe(5);
  });

  it("returns undefined and leaves storage untouched for an id that isn't stored", () => {
    saveContribution(ALICE_CARD);
    expect(recordPersistedSave("missing")).toBeUndefined();
    expect(getContribution("contrib-1")).toEqual(ALICE_CARD);
  });
});

describe("recordPersistedEndorsement", () => {
  it("appends and persists a reviewer endorsement on the stored contribution", () => {
    saveContribution(BOB_SUMMARY);
    const updated = recordPersistedEndorsement("contrib-2", 0.9);

    expect(updated?.reviewerEndorsements).toEqual([{ reviewerWeight: 0.9 }]);
    expect(getContribution("contrib-2")?.reviewerEndorsements).toEqual([{ reviewerWeight: 0.9 }]);
  });

  it("preserves existing endorsements when appending another", () => {
    saveContribution(ALICE_CARD);
    recordPersistedEndorsement("contrib-1", 0.5);

    expect(getContribution("contrib-1")?.reviewerEndorsements).toEqual([
      { reviewerWeight: 0.7 },
      { reviewerWeight: 0.5 },
    ]);
  });

  it("returns undefined and leaves storage untouched for an id that isn't stored", () => {
    saveContribution(ALICE_CARD);
    expect(recordPersistedEndorsement("missing", 0.5)).toBeUndefined();
    expect(getContribution("contrib-1")).toEqual(ALICE_CARD);
  });
});

describe("recordPersistedEndorsementFromReviewer", () => {
  it("derives the endorsement weight from the reviewer's own persisted contribution history", () => {
    saveContribution(ALICE_CARD);
    saveContribution(BOB_SUMMARY);

    const updated = recordPersistedEndorsementFromReviewer("contrib-2", "alice");
    const expectedWeight = computeReviewerCredibility(listContributionsByContributor("alice"));

    expect(updated?.reviewerEndorsements).toEqual([{ reviewerWeight: expectedWeight }]);
    expect(getContribution("contrib-2")?.reviewerEndorsements).toEqual([{ reviewerWeight: expectedWeight }]);
  });

  it("floors the weight at MIN_REVIEWER_CREDIBILITY for a reviewer with no contribution history", () => {
    saveContribution(BOB_SUMMARY);
    const updated = recordPersistedEndorsementFromReviewer("contrib-2", "brand-new-reviewer");

    expect(updated?.reviewerEndorsements).toEqual([{ reviewerWeight: MIN_REVIEWER_CREDIBILITY }]);
  });

  it("returns undefined and leaves storage untouched for an id that isn't stored", () => {
    saveContribution(ALICE_CARD);
    expect(recordPersistedEndorsementFromReviewer("missing", "alice")).toBeUndefined();
    expect(getContribution("contrib-1")).toEqual(ALICE_CARD);
  });
});

describe("buildPersistedLeaderboard", () => {
  it("returns an empty leaderboard when nothing is stored", () => {
    expect(buildPersistedLeaderboard()).toEqual([]);
  });

  it("ranks every persisted contributor by total helpfulness score", () => {
    saveContribution(ALICE_CARD);
    saveContribution(BOB_SUMMARY);

    const leaderboard = buildPersistedLeaderboard();

    expect(leaderboard).toHaveLength(2);
    expect(leaderboard[0].contributorId).toBe("alice");
    expect(leaderboard[1].contributorId).toBe("bob");
  });

  it("reflects a like recorded after the contribution was saved", () => {
    saveContribution(BOB_SUMMARY);
    const before = buildPersistedLeaderboard()[0];

    recordPersistedLike("contrib-2");
    recordPersistedLike("contrib-2");
    const after = buildPersistedLeaderboard()[0];

    expect(after.totalHelpfulnessScore).toBeGreaterThan(before.totalHelpfulnessScore);
  });
});

describe("buildPersistedContributionFeed", () => {
  it("returns an empty feed when nothing is stored", () => {
    expect(buildPersistedContributionFeed()).toEqual([]);
  });

  it("ranks every persisted contribution by helpfulness score, carrying its own fields", () => {
    saveContribution(BOB_SUMMARY);
    saveContribution(ALICE_CARD);

    const feed = buildPersistedContributionFeed();

    expect(feed).toHaveLength(2);
    expect(feed[0].id).toBe("contrib-1");
    expect(feed[0].contributorId).toBe("alice");
    expect(feed[0].likes).toBe(12);
    expect(feed[0].publicationStatus).toBe("no_review");
    expect(feed[1].id).toBe("contrib-2");
    expect(feed[0].helpfulnessScore).toBeGreaterThan(feed[1].helpfulnessScore);
  });

  it("reflects a like recorded after the contribution was saved", () => {
    saveContribution(BOB_SUMMARY);
    const before = buildPersistedContributionFeed()[0];

    recordPersistedLike("contrib-2");
    const after = buildPersistedContributionFeed()[0];

    expect(after.helpfulnessScore).toBeGreaterThan(before.helpfulnessScore);
    expect(after.likes).toBe(4);
  });

  it("flags a high-popularity, low-quality, low-reviewer contribution as a popularity-only outlier", () => {
    const outlier: AttributedContribution = {
      id: "contrib-3",
      contributorId: "carol",
      kind: "highlight",
      likes: 50,
      saves: 0,
      qualitySignals: [0],
      reviewerEndorsements: [],
    };
    saveContribution(outlier);

    const [entry] = buildPersistedContributionFeed();

    expect(entry.isPopularityOnlyOutlier).toBe(true);
  });

  it("does not flag a well-reviewed contribution as a popularity-only outlier", () => {
    saveContribution(ALICE_CARD);

    const [entry] = buildPersistedContributionFeed();

    expect(entry.isPopularityOnlyOutlier).toBe(false);
  });
});

describe("buildTopContributorAwardsFromStore", () => {
  it("returns an empty award list when nothing is stored", () => {
    expect(buildTopContributorAwardsFromStore()).toEqual([]);
  });

  it("selects the top-scoring contributor per kind from every persisted contribution", () => {
    saveContribution(ALICE_CARD);
    saveContribution(BOB_SUMMARY);

    const awards = buildTopContributorAwardsFromStore();

    expect(awards).toHaveLength(2);
    expect(awards[0]).toMatchObject({ kind: "card", contributorId: "alice", label: "Best Evidence Finder" });
    expect(awards[1]).toMatchObject({ kind: "summary", contributorId: "bob", label: "Best Explainer" });
  });

  it("reflects a like recorded after the contribution was saved", () => {
    saveContribution(ALICE_CARD);
    const before = buildTopContributorAwardsFromStore()[0];

    recordPersistedLike("contrib-1");
    const after = buildTopContributorAwardsFromStore()[0];

    expect(after.totalHelpfulnessScore).toBeGreaterThan(before.totalHelpfulnessScore);
  });

  it("supports overriding a category's award label", () => {
    saveContribution(ALICE_CARD);

    const [award] = buildTopContributorAwardsFromStore({
      ...DEFAULT_AWARD_CATEGORY_LABELS,
      card: "Best Card",
    });

    expect(award.label).toBe("Best Card");
  });
});

const DAY_ONE = Date.parse("2026-08-10T12:00:00.000Z");
const DAY_ONE_LATER = Date.parse("2026-08-10T23:00:00.000Z");
const DAY_TWO = Date.parse("2026-08-11T09:00:00.000Z");

const WEAK_CARD_DAY_ONE: AttributedContribution = {
  ...ALICE_CARD,
  id: "weak-card-day-one",
  contributorId: "carol",
  likes: 0,
  saves: 0,
  qualitySignals: [0.1],
  reviewerEndorsements: [],
  submittedAt: DAY_ONE,
};
const STRONG_CARD_DAY_ONE: AttributedContribution = {
  ...ALICE_CARD,
  id: "strong-card-day-one",
  contributorId: "alice",
  submittedAt: DAY_ONE_LATER,
};
const CARD_DAY_TWO: AttributedContribution = {
  ...ALICE_CARD,
  id: "card-day-two",
  contributorId: "dave",
  submittedAt: DAY_TWO,
};
const CARD_WITHOUT_TIMESTAMP: AttributedContribution = {
  ...ALICE_CARD,
  id: "card-no-timestamp",
  contributorId: "erin",
};
const SUMMARY_WITH_TIMESTAMP: AttributedContribution = {
  ...BOB_SUMMARY,
  id: "summary-with-timestamp",
  submittedAt: DAY_ONE,
};

describe("buildDailyBestCardsFromStore", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(buildDailyBestCardsFromStore()).toEqual([]);
  });

  it("picks one winner per represented day from persisted card contributions", () => {
    saveContribution(WEAK_CARD_DAY_ONE);
    saveContribution(STRONG_CARD_DAY_ONE);
    saveContribution(CARD_DAY_TWO);

    const results = buildDailyBestCardsFromStore();

    expect(results.map((r) => r.dayKey)).toEqual(["2026-08-10", "2026-08-11"]);
    expect(results[0].contribution.id).toBe("strong-card-day-one");
    expect(results[1].contribution.id).toBe("card-day-two");
  });

  it("excludes non-card contributions and cards without a submittedAt timestamp", () => {
    saveContribution(STRONG_CARD_DAY_ONE);
    saveContribution(SUMMARY_WITH_TIMESTAMP);
    saveContribution(CARD_WITHOUT_TIMESTAMP);

    const results = buildDailyBestCardsFromStore();

    expect(results).toHaveLength(1);
    expect(results[0].contribution.id).toBe("strong-card-day-one");
  });
});

describe("getTodaysBestCardFromStore", () => {
  it("returns the winner for the UTC day of `now`", () => {
    saveContribution(WEAK_CARD_DAY_ONE);
    saveContribution(STRONG_CARD_DAY_ONE);
    saveContribution(CARD_DAY_TWO);

    const result = getTodaysBestCardFromStore(DAY_ONE_LATER);

    expect(result?.dayKey).toBe("2026-08-10");
    expect(result?.contribution.id).toBe("strong-card-day-one");
  });

  it("returns null when no card was submitted that day", () => {
    saveContribution(STRONG_CARD_DAY_ONE);

    expect(getTodaysBestCardFromStore(DAY_TWO)).toBeNull();
  });
});

describe("getContributionPublicationStatus", () => {
  it('returns "no_review" for a contribution that was never sent to review', () => {
    saveContribution(ALICE_CARD);
    expect(getContributionPublicationStatus("contrib-1")).toBe("no_review");
  });

  it('returns "no_review" for an id with no stored contribution at all', () => {
    expect(getContributionPublicationStatus("does-not-exist")).toBe("no_review");
  });

  it("reflects the underlying CardReview's status once one exists", () => {
    saveContribution(ALICE_CARD);
    savePeerReview(submitForReview({ cardId: "contrib-1", status: "draft", comments: [] }));

    expect(getContributionPublicationStatus("contrib-1")).toBe("in_review");
  });
});

describe("sendContributionToReview", () => {
  it("creates a draft CardReview keyed by the contribution's id", () => {
    saveContribution(ALICE_CARD);

    const review = sendContributionToReview("contrib-1");

    expect(review).toEqual({ cardId: "contrib-1", status: "draft", comments: [] });
    expect(getPeerReview("contrib-1")).toEqual(review);
  });

  it("is a no-op for an id with no stored contribution", () => {
    expect(sendContributionToReview("does-not-exist")).toBeUndefined();
    expect(getPeerReview("does-not-exist")).toBeUndefined();
  });

  it("is idempotent — does not reset an existing review back to draft", () => {
    saveContribution(ALICE_CARD);
    const inReview = submitForReview({ cardId: "contrib-1", status: "draft", comments: [] });
    savePeerReview(inReview);

    const result = sendContributionToReview("contrib-1");

    expect(result).toEqual(inReview);
    expect(getPeerReview("contrib-1")?.status).toBe("in_review");
  });
});

describe("isContributionVisibleInPublicFeed", () => {
  it("is true for a contribution never sent to review", () => {
    saveContribution(ALICE_CARD);
    expect(isContributionVisibleInPublicFeed("contrib-1")).toBe(true);
  });

  it("is true once a review reaches published", () => {
    saveContribution(ALICE_CARD);
    let review = submitForReview({ cardId: "contrib-1", status: "draft", comments: [] });
    review = approveReview(review);
    review = publishReview(review);
    savePeerReview(review);

    expect(isContributionVisibleInPublicFeed("contrib-1")).toBe(true);
  });

  it("is false while a review is still in progress", () => {
    saveContribution(ALICE_CARD);
    savePeerReview(submitForReview({ cardId: "contrib-1", status: "draft", comments: [] }));

    expect(isContributionVisibleInPublicFeed("contrib-1")).toBe(false);
  });
});

describe("buildPersistedContributionFeed publicOnly filtering", () => {
  it("hides a contribution whose review hasn't been published yet", () => {
    saveContribution(ALICE_CARD);
    saveContribution(BOB_SUMMARY);
    savePeerReview(submitForReview({ cardId: "contrib-1", status: "draft", comments: [] }));

    const publicFeed = buildPersistedContributionFeed(undefined, { publicOnly: true });

    expect(publicFeed.map((entry) => entry.id)).toEqual(["contrib-2"]);
  });

  it("keeps a never-reviewed and a published contribution visible", () => {
    saveContribution(ALICE_CARD);
    saveContribution(BOB_SUMMARY);
    let review = submitForReview({ cardId: "contrib-1", status: "draft", comments: [] });
    review = approveReview(review);
    review = publishReview(review);
    savePeerReview(review);

    const publicFeed = buildPersistedContributionFeed(undefined, { publicOnly: true });

    expect(publicFeed.map((entry) => entry.id).sort()).toEqual(["contrib-1", "contrib-2"]);
  });

  it("without publicOnly, returns every contribution regardless of review status", () => {
    saveContribution(ALICE_CARD);
    saveContribution(BOB_SUMMARY);
    savePeerReview(submitForReview({ cardId: "contrib-1", status: "draft", comments: [] }));

    const fullFeed = buildPersistedContributionFeed();

    expect(fullFeed).toHaveLength(2);
  });
});
