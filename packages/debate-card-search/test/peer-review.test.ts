import { describe, expect, it } from "vitest";
import {
  InvalidReviewTransitionError,
  ReviewerIdRequiredError,
  SelfReviewNotAllowedError,
  UnresolvedBlockingCommentsError,
  addReviewComment,
  approveReview,
  buildReviewSummary,
  canTransitionReviewStatus,
  createCardReview,
  getUnresolvedBlockingComments,
  isCardLive,
  isReadyToPublish,
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
    expect(requestChanges(review, "r1").status).toBe("changes_requested");
  });

  it("records reviewedBy", () => {
    const review = submitForReview(createCardReview("card-1"));
    expect(requestChanges(review, "r1").reviewedBy).toBe("r1");
  });

  it("throws from a status that can't request changes", () => {
    expect(() => requestChanges(createCardReview("card-1"), "r1")).toThrow(InvalidReviewTransitionError);
  });

  it("throws ReviewerIdRequiredError when no reviewer id is given", () => {
    const review = submitForReview(createCardReview("card-1"));
    expect(() => requestChanges(review, "  ")).toThrow(ReviewerIdRequiredError);
  });

  it("throws SelfReviewNotAllowedError when the reviewer is the card's own author", () => {
    const review = submitForReview(createCardReview("card-1", "alice"));
    expect(() => requestChanges(review, "alice")).toThrow(SelfReviewNotAllowedError);
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
