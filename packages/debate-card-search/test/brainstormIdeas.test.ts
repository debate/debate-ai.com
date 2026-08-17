import { beforeEach, describe, expect, it } from "vitest";
import {
  buildBrainstormBoardsPanelView,
  deleteBrainstormIdea,
  getBrainstormIdea,
  listBrainstormIdeas,
  saveBrainstormIdea,
  upvotePersistedBrainstormIdea,
} from "../src/state/brainstormIdeas";
import type { BrainstormIdea } from "../src/lib/team-brainstorm-assist";

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

const SOLVENCY_IDEA: BrainstormIdea = {
  id: "idea-1",
  argBlock: "solvency",
  category: "argument",
  contributorId: "alice",
  text: "Federal funding unlocks state-level matching grants",
  upvotes: 3,
};
const IMPACT_IDEA: BrainstormIdea = {
  id: "idea-2",
  argBlock: "solvency",
  category: "impact_framing",
  contributorId: "bob",
  text: "Weigh probability over magnitude here",
  upvotes: 0,
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listBrainstormIdeas", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listBrainstormIdeas()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("brainstormIdeas", "{not json");
    expect(listBrainstormIdeas()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("brainstormIdeas", JSON.stringify({ not: "an array" }));
    expect(listBrainstormIdeas()).toEqual([]);
  });

  it("lists every saved idea", () => {
    saveBrainstormIdea(SOLVENCY_IDEA);
    saveBrainstormIdea(IMPACT_IDEA);
    expect(listBrainstormIdeas()).toEqual([SOLVENCY_IDEA, IMPACT_IDEA]);
  });
});

describe("getBrainstormIdea", () => {
  it("finds a saved idea by id", () => {
    saveBrainstormIdea(SOLVENCY_IDEA);
    expect(getBrainstormIdea("idea-1")).toEqual(SOLVENCY_IDEA);
  });

  it("returns undefined for an id that isn't stored", () => {
    expect(getBrainstormIdea("missing")).toBeUndefined();
  });
});

describe("saveBrainstormIdea", () => {
  it("upserts — saving an existing id overwrites rather than duplicating it", () => {
    saveBrainstormIdea(SOLVENCY_IDEA);
    const upvoted: BrainstormIdea = { ...SOLVENCY_IDEA, upvotes: 4 };
    saveBrainstormIdea(upvoted);

    expect(listBrainstormIdeas()).toEqual([upvoted]);
    expect(getBrainstormIdea("idea-1")).toEqual(upvoted);
  });
});

describe("deleteBrainstormIdea", () => {
  it("removes a stored idea by id", () => {
    saveBrainstormIdea(SOLVENCY_IDEA);
    saveBrainstormIdea(IMPACT_IDEA);
    deleteBrainstormIdea("idea-1");

    expect(listBrainstormIdeas()).toEqual([IMPACT_IDEA]);
    expect(getBrainstormIdea("idea-1")).toBeUndefined();
  });

  it("is a no-op when the id isn't stored", () => {
    saveBrainstormIdea(IMPACT_IDEA);
    deleteBrainstormIdea("missing");
    expect(listBrainstormIdeas()).toEqual([IMPACT_IDEA]);
  });
});

describe("buildBrainstormBoardsPanelView", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(buildBrainstormBoardsPanelView()).toEqual([]);
  });

  it("groups persisted ideas into a board per argBlock + category, sorted for stable display", () => {
    const toplineIdea: BrainstormIdea = {
      id: "idea-3",
      argBlock: "topicality",
      category: "argument",
      contributorId: "carol",
      text: "Reasonability outweighs competing interpretations",
      upvotes: 1,
    };
    saveBrainstormIdea(IMPACT_IDEA);
    saveBrainstormIdea(SOLVENCY_IDEA);
    saveBrainstormIdea(toplineIdea);

    const boards = buildBrainstormBoardsPanelView();

    expect(boards.map((board) => [board.argBlock, board.category])).toEqual([
      ["solvency", "argument"],
      ["solvency", "impact_framing"],
      ["topicality", "argument"],
    ]);
    expect(boards[0].ideas.map((idea) => idea.id)).toEqual(["idea-1"]);
    expect(boards[1].ideas.map((idea) => idea.id)).toEqual(["idea-2"]);
    expect(boards[2].ideas.map((idea) => idea.id)).toEqual(["idea-3"]);
  });
});

describe("upvotePersistedBrainstormIdea", () => {
  it("increments a stored idea's upvote count by one", () => {
    saveBrainstormIdea(SOLVENCY_IDEA);
    upvotePersistedBrainstormIdea("idea-1");
    expect(getBrainstormIdea("idea-1")).toEqual({ ...SOLVENCY_IDEA, upvotes: 4 });
  });

  it("is a no-op when the id isn't stored", () => {
    saveBrainstormIdea(SOLVENCY_IDEA);
    upvotePersistedBrainstormIdea("missing");
    expect(getBrainstormIdea("idea-1")).toEqual(SOLVENCY_IDEA);
  });
});
