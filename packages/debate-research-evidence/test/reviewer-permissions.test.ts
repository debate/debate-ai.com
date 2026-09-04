import { describe, expect, it } from "vitest";
import {
  InsufficientReviewerPermissionError,
  MIN_REVIEWER_TIER,
  approveReviewAsReviewer,
  deriveReviewerTier,
  hasReviewerPermission,
  publishReviewAsReviewer,
  rejectReviewAsReviewer,
} from "../src/lib/reviewer-permissions";
import { createCardReview, type CardReview } from "../src/lib/peer-review";
import type { ContributorStats } from "../src/lib/contribution-leaderboard";

const IN_REVIEW: CardReview = { cardId: "card-1", status: "in_review", comments: [] };
const APPROVED: CardReview = { cardId: "card-1", status: "approved", comments: [] };

const NOVICE_STATS: ContributorStats = {
  contributorId: "newbie",
  contributionCount: 1,
  totalHelpfulnessScore: 5,
  averageHelpfulnessScore: 5,
  bestContributionId: "c1",
  bestHelpfulnessScore: 5,
  popularityOnlyOutlierCount: 0,
  completedTaskCount: 0,
};

const VETERAN_STATS: ContributorStats = {
  contributorId: "vet",
  contributionCount: 15,
  totalHelpfulnessScore: 400,
  averageHelpfulnessScore: 26.7,
  bestContributionId: "c1",
  bestHelpfulnessScore: 50,
  popularityOnlyOutlierCount: 0,
  completedTaskCount: 0,
};

describe("hasReviewerPermission", () => {
  it("is satisfied when the tier meets the minimum", () => {
    expect(hasReviewerPermission("veteran")).toBe(true);
    expect(hasReviewerPermission("expert")).toBe(true);
  });

  it("is not satisfied below the minimum", () => {
    expect(hasReviewerPermission("novice")).toBe(false);
    expect(hasReviewerPermission("apprentice")).toBe(false);
  });

  it("honors a caller-supplied minimum tier", () => {
    expect(hasReviewerPermission("apprentice", "apprentice")).toBe(true);
    expect(hasReviewerPermission("novice", "apprentice")).toBe(false);
  });
});

describe("deriveReviewerTier", () => {
  it("returns novice for a reviewer with no stats at all", () => {
    expect(deriveReviewerTier("ghost", [NOVICE_STATS, VETERAN_STATS])).toBe("novice");
  });

  it("derives the tier from the reviewer's own stats", () => {
    expect(deriveReviewerTier("newbie", [NOVICE_STATS, VETERAN_STATS])).toBe("novice");
    expect(deriveReviewerTier("vet", [NOVICE_STATS, VETERAN_STATS])).toBe("veteran");
  });
});

describe("approveReviewAsReviewer", () => {
  it("approves when the reviewer meets the minimum tier", () => {
    expect(approveReviewAsReviewer(IN_REVIEW, "r1", "veteran").status).toBe("approved");
    expect(approveReviewAsReviewer(IN_REVIEW, "r1", "expert").status).toBe("approved");
  });

  it("records reviewedBy", () => {
    expect(approveReviewAsReviewer(IN_REVIEW, "r1", "veteran").reviewedBy).toBe("r1");
  });

  it("throws InsufficientReviewerPermissionError below the minimum tier, without touching the review", () => {
    expect(() => approveReviewAsReviewer(IN_REVIEW, "r1", "novice")).toThrow(InsufficientReviewerPermissionError);
    expect(() => approveReviewAsReviewer(IN_REVIEW, "r1", "apprentice")).toThrow(InsufficientReviewerPermissionError);
  });

  it("still enforces the underlying state machine once permission is granted", () => {
    const draft = createCardReview("card-2");
    expect(() => approveReviewAsReviewer(draft, "r1", "expert")).toThrow(/Cannot move a card review/);
  });

  it("still enforces the underlying self-review guard once permission is granted", () => {
    const authored: CardReview = { cardId: "card-3", status: "in_review", comments: [], authorId: "alice" };
    expect(() => approveReviewAsReviewer(authored, "alice", "expert")).toThrow(
      /cannot take this action on their own submission/,
    );
  });

  it("honors a caller-supplied minimum tier", () => {
    expect(approveReviewAsReviewer(IN_REVIEW, "r1", "apprentice", "apprentice").status).toBe("approved");
    expect(() => approveReviewAsReviewer(IN_REVIEW, "r1", "novice", "apprentice")).toThrow(
      InsufficientReviewerPermissionError,
    );
  });
});

describe("rejectReviewAsReviewer", () => {
  it("rejects when the reviewer meets the minimum tier", () => {
    expect(rejectReviewAsReviewer(IN_REVIEW, "r1", "veteran").status).toBe("rejected");
  });

  it("throws below the minimum tier", () => {
    expect(() => rejectReviewAsReviewer(IN_REVIEW, "r1", "novice")).toThrow(InsufficientReviewerPermissionError);
  });
});

describe("publishReviewAsReviewer", () => {
  it("publishes when the reviewer meets the minimum tier", () => {
    expect(publishReviewAsReviewer(APPROVED, "r1", "veteran").status).toBe("published");
  });

  it("throws below the minimum tier", () => {
    expect(() => publishReviewAsReviewer(APPROVED, "r1", "apprentice")).toThrow(InsufficientReviewerPermissionError);
  });
});

describe("MIN_REVIEWER_TIER", () => {
  it("is veteran", () => {
    expect(MIN_REVIEWER_TIER).toBe("veteran");
  });
});
