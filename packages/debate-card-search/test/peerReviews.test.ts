import { beforeEach, describe, expect, it } from "vitest";
import {
  approvePersistedReviewAsReviewer,
  buildReviewQueuePanelView,
  deletePeerReview,
  derivePersistedReviewerTier,
  getPeerReview,
  listPeerReviews,
  publishPersistedReviewAsReviewer,
  rejectPersistedReviewAsReviewer,
  savePeerReview,
} from "../src/state/peerReviews";
import type { CardReview } from "../src/lib/peer-review";
import { InsufficientReviewerPermissionError } from "../src/lib/reviewer-permissions";
import { saveContribution } from "../src/state/contributions";
import type { AttributedContribution } from "../src/lib/contribution-leaderboard";

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

/** Scores 58.2 helpfulness per `community-rating.test.ts`'s identically-shaped "substantive" fixture. */
function substantiveContribution(id: string, contributorId: string): AttributedContribution {
  return {
    id,
    contributorId,
    kind: "summary",
    likes: 2,
    saves: 1,
    qualitySignals: [0.9, 0.95],
    reviewerEndorsements: [{ reviewerWeight: 1 }, { reviewerWeight: 0.9 }],
  };
}

/** Gives `contributorId` 15 high-quality contributions — enough to clear "veteran" (15 count / 100 score). */
function makeVeteranReviewer(contributorId: string): void {
  for (let i = 0; i < 15; i++) {
    saveContribution(substantiveContribution(`${contributorId}-contrib-${i}`, contributorId));
  }
}

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

describe("derivePersistedReviewerTier", () => {
  it("is novice for a reviewer with no persisted contributions", () => {
    expect(derivePersistedReviewerTier("stranger")).toBe("novice");
  });

  it("derives veteran from the reviewer's own persisted contribution history", () => {
    makeVeteranReviewer("vet");
    expect(derivePersistedReviewerTier("vet")).toBe("veteran");
  });
});

describe("approvePersistedReviewAsReviewer", () => {
  it("returns undefined when no review is stored for cardId", () => {
    makeVeteranReviewer("vet");
    expect(approvePersistedReviewAsReviewer("missing", "vet")).toBeUndefined();
  });

  it("approves and saves when the reviewer's derived tier meets the minimum", () => {
    makeVeteranReviewer("vet");
    const cleanInReview: CardReview = { cardId: "card-2", status: "in_review", comments: [] };
    savePeerReview(cleanInReview);

    const result = approvePersistedReviewAsReviewer("card-2", "vet");

    expect(result?.status).toBe("approved");
    expect(getPeerReview("card-2")?.status).toBe("approved");
  });

  it("throws and leaves the stored review untouched when the reviewer lacks the tier", () => {
    savePeerReview(IN_REVIEW_REVIEW);

    expect(() => approvePersistedReviewAsReviewer("card-2", "newcomer")).toThrow(InsufficientReviewerPermissionError);
    expect(getPeerReview("card-2")?.status).toBe("in_review");
  });
});

describe("rejectPersistedReviewAsReviewer", () => {
  it("rejects and saves when the reviewer's derived tier meets the minimum", () => {
    makeVeteranReviewer("vet");
    savePeerReview(IN_REVIEW_REVIEW);

    const result = rejectPersistedReviewAsReviewer("card-2", "vet");

    expect(result?.status).toBe("rejected");
    expect(getPeerReview("card-2")?.status).toBe("rejected");
  });

  it("throws when the reviewer lacks the tier", () => {
    savePeerReview(IN_REVIEW_REVIEW);
    expect(() => rejectPersistedReviewAsReviewer("card-2", "newcomer")).toThrow(InsufficientReviewerPermissionError);
  });
});

describe("publishPersistedReviewAsReviewer", () => {
  it("publishes and saves when the reviewer's derived tier meets the minimum", () => {
    makeVeteranReviewer("vet");
    const approved: CardReview = { cardId: "card-3", status: "approved", comments: [] };
    savePeerReview(approved);

    const result = publishPersistedReviewAsReviewer("card-3", "vet");

    expect(result?.status).toBe("published");
    expect(getPeerReview("card-3")?.status).toBe("published");
  });

  it("throws when the reviewer lacks the tier", () => {
    const approved: CardReview = { cardId: "card-3", status: "approved", comments: [] };
    savePeerReview(approved);
    expect(() => publishPersistedReviewAsReviewer("card-3", "newcomer")).toThrow(InsufficientReviewerPermissionError);
  });
});
