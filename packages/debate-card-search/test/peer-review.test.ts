import { describe, expect, it, vi } from "vitest";
import {
  InvalidReviewTransitionError,
  ReviewerIdRequiredError,
  SelfReviewNotAllowedError,
  STALE_REVIEW_THRESHOLD_DAYS,
  UnresolvedBlockingCommentsError,
  addReviewComment,
  approveReview,
  buildReviewerWorkload,
  buildReviewSummary,
  canTransitionReviewStatus,
  createCardReview,
  getReviewAgeDays,
  getUnresolvedBlockingComments,
  isCardLive,
  isReadyToPublish,
  isReviewStale,
  publishReview,
  rejectReview,
  requestChanges,
  resolveReviewComment,
  reviseRejectedReview,
  submitForReview,
  type CardReview,
} from "../src/lib/peer-review";

describe("createCardReview", () => {
  it("starts a new review in draft with no comments", () => {
    const review = createCardReview("card-1");
    expect(review).toMatchObject({ cardId: "card-1", status: "draft", comments: [] });
    expect(typeof review.statusChangedAt).toBe("number");
  });
});

describe("canTransitionReviewStatus", () => {
  it("allows the documented happy-path transitions", () => {
    expect(canTransitionReviewStatus("draft", "in_review")).toBe(true);
    expect(canTransitionReviewStatus("in_review", "approved")).toBe(true);
    expect(canTransitionReviewStatus("in_review", "changes_requested")).toBe(true);
    expect(canTransitionReviewStatus("in_review", "rejected")).toBe(true);
    expect(canTransitionReviewStatus("changes_requested", "in_review")).toBe(true);
    expect(canTransitionReviewStatus("approved", "published")).toBe(true);
    expect(canTransitionReviewStatus("rejected", "draft")).toBe(true);
  });

  it("rejects illegal jumps", () => {
    expect(canTransitionReviewStatus("draft", "approved")).toBe(false);
    expect(canTransitionReviewStatus("published", "draft")).toBe(false);
    expect(canTransitionReviewStatus("approved", "in_review")).toBe(false);
    expect(canTransitionReviewStatus("draft", "draft")).toBe(false);
  });
});

describe("submitForReview", () => {
  it("moves a draft into in_review", () => {
    const review = submitForReview(createCardReview("card-1"));
    expect(review.status).toBe("in_review");
  });

  it("re-submits a changes_requested review back into in_review", () => {
    const review: CardReview = { cardId: "card-1", status: "changes_requested", comments: [] };
    expect(submitForReview(review).status).toBe("in_review");
  });

  it("throws InvalidReviewTransitionError from a status with no in_review path", () => {
    const published: CardReview = { cardId: "card-1", status: "published", comments: [] };
    expect(() => submitForReview(published)).toThrow(InvalidReviewTransitionError);
  });
});

describe("addReviewComment", () => {
  it("appends a suggestion comment without changing status", () => {
    const review = submitForReview(createCardReview("card-1"));
    const updated = addReviewComment(review, {
      id: "c1",
      reviewerId: "r1",
      body: "Consider a stronger tag line.",
      severity: "suggestion",
    });
    expect(updated.status).toBe("in_review");
    expect(updated.comments).toEqual([
      { id: "c1", reviewerId: "r1", body: "Consider a stronger tag line.", severity: "suggestion", resolved: false },
    ]);
  });

  it("moves an in_review card to changes_requested when a blocking comment is added", () => {
    const review = submitForReview(createCardReview("card-1"));
    const updated = addReviewComment(review, {
      id: "c1",
      reviewerId: "r1",
      body: "Citation is missing a page number.",
      severity: "blocking",
    });
    expect(updated.status).toBe("changes_requested");
    expect(updated.comments).toHaveLength(1);
  });

  it("does not change status when a blocking comment is added outside in_review", () => {
    const draft = createCardReview("card-1");
    const updated = addReviewComment(draft, {
      id: "c1",
      reviewerId: "r1",
      body: "Pre-submission note.",
      severity: "blocking",
    });
    expect(updated.status).toBe("draft");
  });

  it("does not mutate the original review", () => {
    const review = submitForReview(createCardReview("card-1"));
    addReviewComment(review, { id: "c1", reviewerId: "r1", body: "x", severity: "suggestion" });
    expect(review.comments).toHaveLength(0);
  });
});

describe("resolveReviewComment", () => {
  it("marks the matching comment resolved and leaves others untouched", () => {
    let review = submitForReview(createCardReview("card-1"));
    review = addReviewComment(review, { id: "c1", reviewerId: "r1", body: "a", severity: "blocking" });
    review = addReviewComment(review, { id: "c2", reviewerId: "r2", body: "b", severity: "suggestion" });

    const updated = resolveReviewComment(review, "c1");
    expect(updated.comments.find((c) => c.id === "c1")?.resolved).toBe(true);
    expect(updated.comments.find((c) => c.id === "c2")?.resolved).toBe(false);
  });

  it("is a no-op when the comment id isn't found", () => {
    const review = submitForReview(createCardReview("card-1"));
    expect(resolveReviewComment(review, "missing")).toEqual(review);
  });
});

describe("getUnresolvedBlockingComments", () => {
  it("returns only unresolved blocking comments", () => {
    let review = submitForReview(createCardReview("card-1"));
    review = addReviewComment(review, { id: "c1", reviewerId: "r1", body: "a", severity: "blocking" });
    review = addReviewComment(review, { id: "c2", reviewerId: "r2", body: "b", severity: "suggestion" });
    review = addReviewComment(review, { id: "c3", reviewerId: "r3", body: "c", severity: "blocking" });
    review = resolveReviewComment(review, "c1");

    expect(getUnresolvedBlockingComments(review).map((c) => c.id)).toEqual(["c3"]);
  });
});

describe("requestChanges", () => {
  it("moves an in_review card to changes_requested", () => {
    const review = submitForReview(createCardReview("card-1"));
    expect(requestChanges(review).status).toBe("changes_requested");
  });

  it("throws from a status that can't request changes", () => {
    expect(() => requestChanges(createCardReview("card-1"))).toThrow(InvalidReviewTransitionError);
  });

  it("stays open to a review's own author — only approve/reject/publish are self-review-guarded", () => {
    const review = submitForReview(createCardReview("card-1", "alice"));
    expect(requestChanges(review).status).toBe("changes_requested");
  });
});

describe("approveReview", () => {
  it("approves an in_review card with no blocking comments", () => {
    const review = submitForReview(createCardReview("card-1"));
    expect(approveReview(review, "r1").status).toBe("approved");
  });

  it("records reviewedBy", () => {
    const review = submitForReview(createCardReview("card-1"));
    expect(approveReview(review, "r1").reviewedBy).toBe("r1");
  });

  it("approves once all blocking comments are resolved", () => {
    let review = submitForReview(createCardReview("card-1"));
    review = addReviewComment(review, { id: "c1", reviewerId: "r1", body: "a", severity: "blocking" });
    // The blocking comment above already moved status to changes_requested; resubmit.
    review = submitForReview(review);
    review = resolveReviewComment(review, "c1");
    expect(approveReview(review, "r1").status).toBe("approved");
  });

  it("throws UnresolvedBlockingCommentsError when a blocking comment is unresolved", () => {
    let review = submitForReview(createCardReview("card-1"));
    review = addReviewComment(review, { id: "c1", reviewerId: "r1", body: "a", severity: "blocking" });
    review = submitForReview(review);
    expect(() => approveReview(review, "r1")).toThrow(UnresolvedBlockingCommentsError);
  });

  it("throws InvalidReviewTransitionError from draft", () => {
    expect(() => approveReview(createCardReview("card-1"), "r1")).toThrow(InvalidReviewTransitionError);
  });

  it("throws ReviewerIdRequiredError when no reviewer id is given", () => {
    const review = submitForReview(createCardReview("card-1"));
    expect(() => approveReview(review, "")).toThrow(ReviewerIdRequiredError);
  });

  it("throws SelfReviewNotAllowedError when the reviewer is the card's own author", () => {
    const review = submitForReview(createCardReview("card-1", "alice"));
    expect(() => approveReview(review, "alice")).toThrow(SelfReviewNotAllowedError);
  });

  it("allows a reviewer whose id differs from the card's author", () => {
    const review = submitForReview(createCardReview("card-1", "alice"));
    expect(approveReview(review, "bob").status).toBe("approved");
  });

  it("allows any reviewer id when no author was recorded", () => {
    const review = submitForReview(createCardReview("card-1"));
    expect(approveReview(review, "anyone").status).toBe("approved");
  });
});

describe("rejectReview", () => {
  it("rejects an in_review card", () => {
    const review = submitForReview(createCardReview("card-1"));
    expect(rejectReview(review, "r1").status).toBe("rejected");
  });

  it("throws SelfReviewNotAllowedError when the reviewer is the card's own author", () => {
    const review = submitForReview(createCardReview("card-1", "alice"));
    expect(() => rejectReview(review, "alice")).toThrow(SelfReviewNotAllowedError);
  });
});

describe("reviseRejectedReview", () => {
  it("sends a rejected card back to draft", () => {
    const review = rejectReview(submitForReview(createCardReview("card-1")), "r1");
    expect(reviseRejectedReview(review).status).toBe("draft");
  });

  it("throws InvalidReviewTransitionError from a status that isn't rejected", () => {
    expect(() => reviseRejectedReview(createCardReview("card-1"))).toThrow(InvalidReviewTransitionError);
  });
});

describe("publishReview", () => {
  it("publishes an approved card", () => {
    const review = approveReview(submitForReview(createCardReview("card-1")), "r1");
    expect(publishReview(review, "r1").status).toBe("published");
  });

  it("records reviewedBy", () => {
    const review = approveReview(submitForReview(createCardReview("card-1")), "r1");
    expect(publishReview(review, "r2").reviewedBy).toBe("r2");
  });

  it("throws when publishing directly from in_review", () => {
    const review = submitForReview(createCardReview("card-1"));
    expect(() => publishReview(review, "r1")).toThrow(InvalidReviewTransitionError);
  });

  it("throws SelfReviewNotAllowedError when the reviewer is the card's own author", () => {
    const review = approveReview(submitForReview(createCardReview("card-1", "alice")), "bob");
    expect(() => publishReview(review, "alice")).toThrow(SelfReviewNotAllowedError);
  });
});

describe("isReadyToPublish", () => {
  it("is false for a draft", () => {
    expect(isReadyToPublish(createCardReview("card-1"))).toBe(false);
  });

  it("is true once approved with no unresolved blocking comments", () => {
    const review = approveReview(submitForReview(createCardReview("card-1")), "r1");
    expect(isReadyToPublish(review)).toBe(true);
  });

  it("is false once published — it's already live, not pending publish", () => {
    const review = publishReview(approveReview(submitForReview(createCardReview("card-1")), "r1"), "r1");
    expect(isReadyToPublish(review)).toBe(false);
  });
});

describe("isCardLive", () => {
  it("is true when no review exists — peer review is opt-in, not required", () => {
    expect(isCardLive(undefined)).toBe(true);
  });

  it("is false for a review that hasn't reached published yet", () => {
    expect(isCardLive(createCardReview("card-1"))).toBe(false);
    expect(isCardLive(submitForReview(createCardReview("card-1")))).toBe(false);
    expect(isCardLive(approveReview(submitForReview(createCardReview("card-1")), "r1"))).toBe(false);
    expect(isCardLive(rejectReview(submitForReview(createCardReview("card-1")), "r1"))).toBe(false);
  });

  it("is true once the review is published", () => {
    const review = publishReview(approveReview(submitForReview(createCardReview("card-1")), "r1"), "r1");
    expect(isCardLive(review)).toBe(true);
  });
});

describe("getReviewAgeDays", () => {
  it("returns undefined when statusChangedAt isn't set", () => {
    const review: CardReview = { cardId: "card-1", status: "in_review", comments: [] };
    expect(getReviewAgeDays(review)).toBeUndefined();
  });

  it("returns whole days elapsed since the last status change", () => {
    const review = createCardReview("card-1");
    const threeAndAHalfDaysLater = review.statusChangedAt! + 3.5 * 24 * 60 * 60 * 1000;
    expect(getReviewAgeDays(review, threeAndAHalfDaysLater)).toBe(3);
  });

  it("is zero right when the status changed", () => {
    const review = createCardReview("card-1");
    expect(getReviewAgeDays(review, review.statusChangedAt)).toBe(0);
  });

  it("is refreshed by a transition", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(0);
      const review = submitForReview(createCardReview("card-1"));
      vi.setSystemTime(10 * 24 * 60 * 60 * 1000);
      const approved = approveReview(review, "r1");
      // approveReview stamps a fresh statusChangedAt at the current (10-days-later) time, so its age is 0, not 10.
      expect(getReviewAgeDays(approved, Date.now())).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("isReviewStale", () => {
  it("is false before the threshold", () => {
    const review = submitForReview(createCardReview("card-1"));
    const justUnderThreshold = review.statusChangedAt! + (STALE_REVIEW_THRESHOLD_DAYS * 24 * 60 * 60 * 1000 - 1);
    expect(isReviewStale(review, justUnderThreshold)).toBe(false);
  });

  it("is true once the threshold is reached", () => {
    const review = submitForReview(createCardReview("card-1"));
    const atThreshold = review.statusChangedAt! + STALE_REVIEW_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
    expect(isReviewStale(review, atThreshold)).toBe(true);
  });

  it("is false for statuses that aren't anyone's pending queue", () => {
    const farFuture = Date.now() + 30 * 24 * 60 * 60 * 1000;
    expect(isReviewStale(createCardReview("card-1"), farFuture)).toBe(false); // draft
    const published = publishReview(approveReview(submitForReview(createCardReview("card-1")), "r1"), "r1");
    expect(isReviewStale(published, farFuture)).toBe(false);
    const rejected = rejectReview(submitForReview(createCardReview("card-1")), "r1");
    expect(isReviewStale(rejected, farFuture)).toBe(false);
  });

  it("respects a custom threshold", () => {
    const review = submitForReview(createCardReview("card-1"));
    const oneDayLater = review.statusChangedAt! + 24 * 60 * 60 * 1000;
    expect(isReviewStale(review, oneDayLater, 1)).toBe(true);
    expect(isReviewStale(review, oneDayLater, 2)).toBe(false);
  });

  it("is false with no statusChangedAt", () => {
    const review: CardReview = { cardId: "card-1", status: "changes_requested", comments: [] };
    expect(isReviewStale(review, Date.now() + 30 * 24 * 60 * 60 * 1000)).toBe(false);
  });
});

describe("addReviewComment stamps statusChangedAt on its auto-transition", () => {
  it("refreshes statusChangedAt when a blocking comment flips in_review to changes_requested", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(1_000_000);
      const review = submitForReview(createCardReview("card-1"));
      vi.setSystemTime(1_000_000 + 5000);
      const updated = addReviewComment(review, { id: "c1", reviewerId: "r1", body: "a", severity: "blocking" });
      expect(updated.statusChangedAt).toBe(1_000_000 + 5000);
    } finally {
      vi.useRealTimers();
    }
  });

  it("leaves statusChangedAt untouched when the comment doesn't change status", () => {
    const review = submitForReview(createCardReview("card-1"));
    const updated = addReviewComment(review, { id: "c1", reviewerId: "r1", body: "a", severity: "suggestion" });
    expect(updated.statusChangedAt).toBe(review.statusChangedAt);
  });
});

describe("buildReviewSummary", () => {
  it("reports no comments yet on a fresh draft", () => {
    expect(buildReviewSummary(createCardReview("card-1"))).toBe("Status: draft\nComments: none yet");
  });

  it("reports resolved/total counts and an unresolved-blocking flag", () => {
    let review = submitForReview(createCardReview("card-1"));
    review = addReviewComment(review, { id: "c1", reviewerId: "r1", body: "a", severity: "blocking" });
    review = addReviewComment(review, { id: "c2", reviewerId: "r2", body: "b", severity: "suggestion" });
    review = resolveReviewComment(review, "c2");

    expect(buildReviewSummary(review)).toBe("Status: changes_requested\nComments: 1/2 resolved (1 blocking)");
  });
});

describe("buildReviewerWorkload", () => {
  it("returns an empty list for no reviews", () => {
    expect(buildReviewerWorkload([])).toEqual([]);
  });

  it("counts a comment on a non-pending review toward totalCommentsPosted but not activeReviewCount", () => {
    let review = createCardReview("card-1"); // draft — not a pending-action status
    review = addReviewComment(review, { id: "c1", reviewerId: "alice", body: "note", severity: "suggestion" });

    expect(buildReviewerWorkload([review])).toEqual([
      { reviewerId: "alice", activeReviewCount: 0, totalCommentsPosted: 1, actionsTaken: 0 },
    ]);
  });

  it("counts a comment on an in_review card toward both totals", () => {
    let review = submitForReview(createCardReview("card-1"));
    review = addReviewComment(review, { id: "c1", reviewerId: "alice", body: "note", severity: "suggestion" });

    expect(buildReviewerWorkload([review])).toEqual([
      { reviewerId: "alice", activeReviewCount: 1, totalCommentsPosted: 1, actionsTaken: 0 },
    ]);
  });

  it("dedupes activeReviewCount when the same reviewer comments on the same card twice", () => {
    let review = submitForReview(createCardReview("card-1"));
    review = addReviewComment(review, { id: "c1", reviewerId: "alice", body: "one", severity: "suggestion" });
    review = addReviewComment(review, { id: "c2", reviewerId: "alice", body: "two", severity: "suggestion" });

    const [entry] = buildReviewerWorkload([review]);
    expect(entry).toMatchObject({ activeReviewCount: 1, totalCommentsPosted: 2 });
  });

  it("counts activeReviewCount across distinct pending cards separately", () => {
    let cardA = submitForReview(createCardReview("card-a"));
    cardA = addReviewComment(cardA, { id: "c1", reviewerId: "alice", body: "a", severity: "suggestion" });
    let cardB = submitForReview(createCardReview("card-b"));
    cardB = addReviewComment(cardB, { id: "c2", reviewerId: "alice", body: "b", severity: "suggestion" });

    const [entry] = buildReviewerWorkload([cardA, cardB]);
    expect(entry).toMatchObject({ activeReviewCount: 2, totalCommentsPosted: 2 });
  });

  it("tallies actionsTaken from reviewedBy independently of comments", () => {
    const review = approveReview(submitForReview(createCardReview("card-1", "author1")), "alice");
    expect(buildReviewerWorkload([review])).toEqual([
      { reviewerId: "alice", activeReviewCount: 0, totalCommentsPosted: 0, actionsTaken: 1 },
    ]);
  });

  it("sorts busiest-first by activeReviewCount, then totalCommentsPosted, then reviewerId", () => {
    let busy = submitForReview(createCardReview("card-busy"));
    busy = addReviewComment(busy, { id: "c1", reviewerId: "bob", body: "1", severity: "suggestion" });
    busy = addReviewComment(busy, { id: "c2", reviewerId: "carol", body: "1", severity: "suggestion" });

    let quiet = submitForReview(createCardReview("card-quiet"));
    quiet = addReviewComment(quiet, { id: "c3", reviewerId: "bob", body: "2", severity: "suggestion" });

    // bob: 2 active reviews; carol: 1 active review, but tie-broken against
    // an "alice" with zero activity beyond a single stale (non-pending) comment.
    let idle = createCardReview("card-idle");
    idle = addReviewComment(idle, { id: "c4", reviewerId: "alice", body: "3", severity: "suggestion" });

    const workload = buildReviewerWorkload([busy, quiet, idle]);
    expect(workload.map((e) => e.reviewerId)).toEqual(["bob", "carol", "alice"]);
    expect(workload[0]).toMatchObject({ activeReviewCount: 2, totalCommentsPosted: 2 });
  });

  it("combines comment- and action-based activity for the same reviewer into one entry", () => {
    let review = submitForReview(createCardReview("card-1", "author1"));
    review = addReviewComment(review, { id: "c1", reviewerId: "alice", body: "note", severity: "suggestion" });
    // alice's comment left it "in_review" (a suggestion doesn't auto-transition), so she can still approve it herself here — the test only checks tallying, not the self-review guard (author1 !== alice).
    const approved = approveReview(review, "alice");

    expect(buildReviewerWorkload([approved])).toEqual([
      { reviewerId: "alice", activeReviewCount: 0, totalCommentsPosted: 1, actionsTaken: 1 },
    ]);
  });
});
