import { describe, expect, it } from "vitest";
import {
  InvalidReviewTransitionError,
  UnresolvedBlockingCommentsError,
  addReviewComment,
  approveReview,
  buildReviewSummary,
  canTransitionReviewStatus,
  createCardReview,
  getUnresolvedBlockingComments,
  isReadyToPublish,
  publishReview,
  rejectReview,
  requestChanges,
  resolveReviewComment,
  submitForReview,
  type CardReview,
} from "../src/lib/peer-review";

describe("createCardReview", () => {
  it("starts a new review in draft with no comments", () => {
    expect(createCardReview("card-1")).toEqual({ cardId: "card-1", status: "draft", comments: [] });
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
});

describe("approveReview", () => {
  it("approves an in_review card with no blocking comments", () => {
    const review = submitForReview(createCardReview("card-1"));
    expect(approveReview(review).status).toBe("approved");
  });

  it("approves once all blocking comments are resolved", () => {
    let review = submitForReview(createCardReview("card-1"));
    review = addReviewComment(review, { id: "c1", reviewerId: "r1", body: "a", severity: "blocking" });
    // The blocking comment above already moved status to changes_requested; resubmit.
    review = submitForReview(review);
    review = resolveReviewComment(review, "c1");
    expect(approveReview(review).status).toBe("approved");
  });

  it("throws UnresolvedBlockingCommentsError when a blocking comment is unresolved", () => {
    let review = submitForReview(createCardReview("card-1"));
    review = addReviewComment(review, { id: "c1", reviewerId: "r1", body: "a", severity: "blocking" });
    review = submitForReview(review);
    expect(() => approveReview(review)).toThrow(UnresolvedBlockingCommentsError);
  });

  it("throws InvalidReviewTransitionError from draft", () => {
    expect(() => approveReview(createCardReview("card-1"))).toThrow(InvalidReviewTransitionError);
  });
});

describe("rejectReview", () => {
  it("rejects an in_review card", () => {
    const review = submitForReview(createCardReview("card-1"));
    expect(rejectReview(review).status).toBe("rejected");
  });
});

describe("publishReview", () => {
  it("publishes an approved card", () => {
    const review = approveReview(submitForReview(createCardReview("card-1")));
    expect(publishReview(review).status).toBe("published");
  });

  it("throws when publishing directly from in_review", () => {
    const review = submitForReview(createCardReview("card-1"));
    expect(() => publishReview(review)).toThrow(InvalidReviewTransitionError);
  });
});

describe("isReadyToPublish", () => {
  it("is false for a draft", () => {
    expect(isReadyToPublish(createCardReview("card-1"))).toBe(false);
  });

  it("is true once approved with no unresolved blocking comments", () => {
    const review = approveReview(submitForReview(createCardReview("card-1")));
    expect(isReadyToPublish(review)).toBe(true);
  });

  it("is false once published — it's already live, not pending publish", () => {
    const review = publishReview(approveReview(submitForReview(createCardReview("card-1"))));
    expect(isReadyToPublish(review)).toBe(false);
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
