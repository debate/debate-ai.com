import { beforeEach, describe, expect, it } from "vitest";
import {
  addPersistedReviewComment,
  approvePersistedReview,
  buildPeerReviewsPanelView,
  deletePeerReview,
  getPeerReview,
  listPeerReviews,
  publishPersistedReview,
  rejectPersistedReview,
  requestPersistedReviewChanges,
  resolvePersistedReviewComment,
  revisePersistedRejectedReview,
  savePeerReview,
  startPersistedCardReview,
  submitPersistedReviewForReview,
} from "../src/state/peerReviews";
import { UnresolvedBlockingCommentsError } from "../src/lib/peer-review";
import type { CardReview } from "../src/lib/peer-review";

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

const DRAFT_REVIEW: CardReview = {
  cardId: "card-1",
  status: "draft",
  comments: [],
};
const IN_REVIEW_REVIEW: CardReview = {
  cardId: "card-2",
  status: "in_review",
  comments: [{ id: "comment-1", reviewerId: "alice", body: "Cite this claim.", severity: "blocking", resolved: false }],
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listPeerReviews", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listPeerReviews()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("peerReviews", "{not json");
    expect(listPeerReviews()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("peerReviews", JSON.stringify({ not: "an array" }));
    expect(listPeerReviews()).toEqual([]);
  });

  it("lists every saved review", () => {
    savePeerReview(DRAFT_REVIEW);
    savePeerReview(IN_REVIEW_REVIEW);
    expect(listPeerReviews()).toEqual([DRAFT_REVIEW, IN_REVIEW_REVIEW]);
  });
});

describe("getPeerReview", () => {
  it("finds a saved review by cardId", () => {
    savePeerReview(DRAFT_REVIEW);
    expect(getPeerReview("card-1")).toEqual(DRAFT_REVIEW);
  });

  it("returns undefined for a cardId that isn't stored", () => {
    expect(getPeerReview("missing")).toBeUndefined();
  });
});

describe("savePeerReview", () => {
  it("upserts — saving an existing cardId overwrites rather than duplicating it", () => {
    savePeerReview(DRAFT_REVIEW);
    const submitted: CardReview = { ...DRAFT_REVIEW, status: "in_review" };
    savePeerReview(submitted);

    expect(listPeerReviews()).toEqual([submitted]);
    expect(getPeerReview("card-1")).toEqual(submitted);
  });
});

describe("deletePeerReview", () => {
  it("removes a stored review by cardId", () => {
    savePeerReview(DRAFT_REVIEW);
    savePeerReview(IN_REVIEW_REVIEW);
    deletePeerReview("card-1");

    expect(listPeerReviews()).toEqual([IN_REVIEW_REVIEW]);
    expect(getPeerReview("card-1")).toBeUndefined();
  });

  it("is a no-op when the cardId isn't stored", () => {
    savePeerReview(IN_REVIEW_REVIEW);
    deletePeerReview("missing");
    expect(listPeerReviews()).toEqual([IN_REVIEW_REVIEW]);
  });
});

describe("startPersistedCardReview", () => {
  it("creates and persists a new draft review for a card id with none stored", () => {
    const review = startPersistedCardReview("card-1");
    expect(review).toEqual({ cardId: "card-1", status: "draft", comments: [] });
    expect(getPeerReview("card-1")).toEqual(review);
  });

  it("is idempotent — returns the existing review unchanged rather than overwriting it", () => {
    savePeerReview(IN_REVIEW_REVIEW);
    const result = startPersistedCardReview("card-2");
    expect(result).toEqual(IN_REVIEW_REVIEW);
    expect(getPeerReview("card-2")).toEqual(IN_REVIEW_REVIEW);
  });
});

describe("persisted status-transition mutators", () => {
  it("submitPersistedReviewForReview moves a persisted draft into in_review and persists it", () => {
    savePeerReview(DRAFT_REVIEW);
    const updated = submitPersistedReviewForReview("card-1");
    expect(updated?.status).toBe("in_review");
    expect(getPeerReview("card-1")?.status).toBe("in_review");
  });

  it("requestPersistedReviewChanges moves a persisted in_review card to changes_requested", () => {
    savePeerReview(IN_REVIEW_REVIEW);
    const updated = requestPersistedReviewChanges("card-2");
    expect(updated?.status).toBe("changes_requested");
    expect(getPeerReview("card-2")?.status).toBe("changes_requested");
  });

  it("approvePersistedReview approves and persists once no blocking comments are unresolved", () => {
    savePeerReview({ cardId: "card-3", status: "in_review", comments: [] });
    const updated = approvePersistedReview("card-3");
    expect(updated?.status).toBe("approved");
    expect(getPeerReview("card-3")?.status).toBe("approved");
  });

  it("approvePersistedReview throws UnresolvedBlockingCommentsError and leaves storage untouched", () => {
    savePeerReview(IN_REVIEW_REVIEW);
    expect(() => approvePersistedReview("card-2")).toThrow(UnresolvedBlockingCommentsError);
    expect(getPeerReview("card-2")?.status).toBe("in_review");
  });

  it("rejectPersistedReview rejects and persists a persisted in_review card", () => {
    savePeerReview(IN_REVIEW_REVIEW);
    const updated = rejectPersistedReview("card-2");
    expect(updated?.status).toBe("rejected");
    expect(getPeerReview("card-2")?.status).toBe("rejected");
  });

  it("publishPersistedReview publishes and persists a persisted approved card", () => {
    savePeerReview({ cardId: "card-4", status: "approved", comments: [] });
    const updated = publishPersistedReview("card-4");
    expect(updated?.status).toBe("published");
    expect(getPeerReview("card-4")?.status).toBe("published");
  });

  it("revisePersistedRejectedReview sends a persisted rejected card back to draft", () => {
    savePeerReview({ cardId: "card-5", status: "rejected", comments: [] });
    const updated = revisePersistedRejectedReview("card-5");
    expect(updated?.status).toBe("draft");
    expect(getPeerReview("card-5")?.status).toBe("draft");
  });

  it("each mutator returns undefined and leaves storage untouched for an id that isn't stored", () => {
    expect(submitPersistedReviewForReview("missing")).toBeUndefined();
    expect(requestPersistedReviewChanges("missing")).toBeUndefined();
    expect(approvePersistedReview("missing")).toBeUndefined();
    expect(rejectPersistedReview("missing")).toBeUndefined();
    expect(publishPersistedReview("missing")).toBeUndefined();
    expect(revisePersistedRejectedReview("missing")).toBeUndefined();
    expect(listPeerReviews()).toEqual([]);
  });
});

describe("persisted comment mutators", () => {
  it("addPersistedReviewComment appends and persists a comment", () => {
    savePeerReview(IN_REVIEW_REVIEW);
    const updated = addPersistedReviewComment("card-2", {
      id: "comment-2",
      reviewerId: "bob",
      body: "Looks good.",
      severity: "suggestion",
    });
    expect(updated?.comments).toHaveLength(2);
    expect(getPeerReview("card-2")?.comments).toHaveLength(2);
  });

  it("addPersistedReviewComment moves a persisted in_review card to changes_requested on a blocking comment", () => {
    savePeerReview({ cardId: "card-6", status: "in_review", comments: [] });
    const updated = addPersistedReviewComment("card-6", {
      id: "comment-1",
      reviewerId: "alice",
      body: "Missing a page number.",
      severity: "blocking",
    });
    expect(updated?.status).toBe("changes_requested");
    expect(getPeerReview("card-6")?.status).toBe("changes_requested");
  });

  it("resolvePersistedReviewComment marks a persisted comment resolved", () => {
    savePeerReview(IN_REVIEW_REVIEW);
    const updated = resolvePersistedReviewComment("card-2", "comment-1");
    expect(updated?.comments.find((c) => c.id === "comment-1")?.resolved).toBe(true);
    expect(getPeerReview("card-2")?.comments.find((c) => c.id === "comment-1")?.resolved).toBe(true);
  });

  it("both comment mutators return undefined for an id that isn't stored", () => {
    expect(
      addPersistedReviewComment("missing", { id: "c1", reviewerId: "r1", body: "x", severity: "suggestion" }),
    ).toBeUndefined();
    expect(resolvePersistedReviewComment("missing", "c1")).toBeUndefined();
  });
});

describe("buildPeerReviewsPanelView", () => {
  it("returns every status group empty when nothing is stored", () => {
    const groups = buildPeerReviewsPanelView();
    expect(groups.map((g) => g.status)).toEqual([
      "in_review",
      "changes_requested",
      "draft",
      "approved",
      "published",
      "rejected",
    ]);
    expect(groups.every((g) => g.reviews.length === 0)).toBe(true);
  });

  it("groups persisted reviews by status, needs-action statuses first", () => {
    savePeerReview(DRAFT_REVIEW);
    savePeerReview(IN_REVIEW_REVIEW);
    savePeerReview({ cardId: "card-7", status: "published", comments: [] });

    const groups = buildPeerReviewsPanelView();
    expect(groups.find((g) => g.status === "in_review")?.reviews).toEqual([IN_REVIEW_REVIEW]);
    expect(groups.find((g) => g.status === "draft")?.reviews).toEqual([DRAFT_REVIEW]);
    expect(groups.find((g) => g.status === "published")?.reviews.map((r) => r.cardId)).toEqual(["card-7"]);
    expect(groups.find((g) => g.status === "changes_requested")?.reviews).toEqual([]);
  });
});
