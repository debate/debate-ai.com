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
  savePeerReview,
  submitPersistedReviewForReview,
} from "../src/state/peerReviews";
import { InvalidReviewTransitionError, UnresolvedBlockingCommentsError } from "../src/lib/peer-review";
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

describe("submitPersistedReviewForReview", () => {
  it("moves a persisted draft into in_review and saves it", () => {
    savePeerReview(DRAFT_REVIEW);
    const updated = submitPersistedReviewForReview("card-1");
    expect(updated?.status).toBe("in_review");
    expect(getPeerReview("card-1")?.status).toBe("in_review");
  });

  it("returns undefined and saves nothing when the cardId isn't stored", () => {
    expect(submitPersistedReviewForReview("missing")).toBeUndefined();
    expect(listPeerReviews()).toEqual([]);
  });

  it("throws and leaves storage untouched for an illegal transition", () => {
    const published: CardReview = { cardId: "card-3", status: "published", comments: [] };
    savePeerReview(published);
    expect(() => submitPersistedReviewForReview("card-3")).toThrow(InvalidReviewTransitionError);
    expect(getPeerReview("card-3")).toEqual(published);
  });
});

describe("requestPersistedReviewChanges", () => {
  it("moves a persisted in-review review to changes_requested", () => {
    savePeerReview(IN_REVIEW_REVIEW);
    const updated = requestPersistedReviewChanges("card-2");
    expect(updated?.status).toBe("changes_requested");
    expect(getPeerReview("card-2")?.status).toBe("changes_requested");
  });
});

describe("approvePersistedReview", () => {
  it("approves a persisted in-review review with no unresolved blocking comments", () => {
    const review: CardReview = { cardId: "card-4", status: "in_review", comments: [] };
    savePeerReview(review);
    const updated = approvePersistedReview("card-4");
    expect(updated?.status).toBe("approved");
    expect(getPeerReview("card-4")?.status).toBe("approved");
  });

  it("throws UnresolvedBlockingCommentsError and leaves storage untouched", () => {
    savePeerReview(IN_REVIEW_REVIEW);
    expect(() => approvePersistedReview("card-2")).toThrow(UnresolvedBlockingCommentsError);
    expect(getPeerReview("card-2")).toEqual(IN_REVIEW_REVIEW);
  });
});

describe("rejectPersistedReview", () => {
  it("rejects a persisted in-review review", () => {
    const review: CardReview = { cardId: "card-5", status: "in_review", comments: [] };
    savePeerReview(review);
    expect(rejectPersistedReview("card-5")?.status).toBe("rejected");
  });
});

describe("publishPersistedReview", () => {
  it("publishes a persisted approved review", () => {
    const review: CardReview = { cardId: "card-6", status: "approved", comments: [] };
    savePeerReview(review);
    expect(publishPersistedReview("card-6")?.status).toBe("published");
  });
});

describe("addPersistedReviewComment", () => {
  it("appends a comment to a persisted review and saves it", () => {
    savePeerReview(IN_REVIEW_REVIEW);
    const updated = addPersistedReviewComment("card-2", {
      id: "comment-2",
      reviewerId: "bob",
      body: "Looks good otherwise.",
      severity: "suggestion",
    });
    expect(updated?.comments).toHaveLength(2);
    expect(getPeerReview("card-2")?.comments).toHaveLength(2);
  });

  it("moves a persisted in-review review to changes_requested on a blocking comment", () => {
    const review: CardReview = { cardId: "card-7", status: "in_review", comments: [] };
    savePeerReview(review);
    addPersistedReviewComment("card-7", {
      id: "comment-3",
      reviewerId: "carol",
      body: "Needs a citation.",
      severity: "blocking",
    });
    expect(getPeerReview("card-7")?.status).toBe("changes_requested");
  });
});

describe("resolvePersistedReviewComment", () => {
  it("marks a persisted review's comment resolved and saves it", () => {
    savePeerReview(IN_REVIEW_REVIEW);
    const updated = resolvePersistedReviewComment("card-2", "comment-1");
    expect(updated?.comments[0].resolved).toBe(true);
    expect(getPeerReview("card-2")?.comments[0].resolved).toBe(true);
  });
});

describe("buildPeerReviewsPanelView", () => {
  it("returns every status group, empty when nothing is stored", () => {
    expect(buildPeerReviewsPanelView()).toEqual([
      { status: "in_review", reviews: [] },
      { status: "changes_requested", reviews: [] },
      { status: "draft", reviews: [] },
      { status: "approved", reviews: [] },
      { status: "published", reviews: [] },
      { status: "rejected", reviews: [] },
    ]);
  });

  it("groups persisted reviews by status in queue-priority order", () => {
    savePeerReview(DRAFT_REVIEW);
    savePeerReview(IN_REVIEW_REVIEW);
    const published: CardReview = { cardId: "card-8", status: "published", comments: [] };
    savePeerReview(published);

    const view = buildPeerReviewsPanelView();
    expect(view.map((group) => group.status)).toEqual([
      "in_review",
      "changes_requested",
      "draft",
      "approved",
      "published",
      "rejected",
    ]);
    expect(view.find((group) => group.status === "in_review")?.reviews).toEqual([IN_REVIEW_REVIEW]);
    expect(view.find((group) => group.status === "draft")?.reviews).toEqual([DRAFT_REVIEW]);
    expect(view.find((group) => group.status === "published")?.reviews).toEqual([published]);
  });
});
