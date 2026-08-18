import { beforeEach, describe, expect, it } from "vitest";
import {
  buildReviewQueuePanelView,
  deletePeerReview,
  getPeerReview,
  listPeerReviews,
  savePeerReview,
} from "../src/state/peerReviews";
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

describe("buildReviewQueuePanelView", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(buildReviewQueuePanelView()).toEqual([]);
  });

  it("sorts every persisted review by cardId, regardless of save order", () => {
    savePeerReview(IN_REVIEW_REVIEW);
    savePeerReview(DRAFT_REVIEW);

    expect(buildReviewQueuePanelView()).toEqual([DRAFT_REVIEW, IN_REVIEW_REVIEW]);
  });

  it("leaves the underlying stored order untouched", () => {
    savePeerReview(IN_REVIEW_REVIEW);
    savePeerReview(DRAFT_REVIEW);
    buildReviewQueuePanelView();

    expect(listPeerReviews()).toEqual([IN_REVIEW_REVIEW, DRAFT_REVIEW]);
  });
});
