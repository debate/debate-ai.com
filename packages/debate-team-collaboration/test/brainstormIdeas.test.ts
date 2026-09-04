import { beforeEach, describe, expect, it } from "vitest";
import {
  buildBrainstormBoardsPanelView,
  buildBrainstormBoardsPanelViewForTopic,
  deleteBrainstormIdea,
  getBrainstormIdea,
  isBrainstormIdeaInArgumentLibrary,
  listBrainstormIdeas,
  mergePersistedBrainstormIdeas,
  saveBrainstormIdea,
  sendBrainstormIdeaToArgumentLibrary,
  upvotePersistedBrainstormIdea,
} from "../src/state/brainstormIdeas";
import { saveTrackedArgument } from "debate-research-evidence/src/state/trackedArguments";
import { getEvidenceLibraryEntry } from "debate-research-evidence/src/state/evidenceLibraryEntries";
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
const DUPLICATE_SOLVENCY_IDEA: BrainstormIdea = {
  id: "idea-4",
  argBlock: "solvency",
  category: "argument",
  contributorId: "carol",
  text: "Federal funding unlocks state matching grants",
  upvotes: 2,
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

describe("buildBrainstormBoardsPanelViewForTopic", () => {
  it("seeds a board for an under-covered tracked argument even with no submitted ideas", () => {
    saveTrackedArgument({ id: "t1", topic: "Energy Policy", argBlock: "solvency" });

    const boards = buildBrainstormBoardsPanelViewForTopic("Energy Policy");

    expect(boards.map((board) => [board.argBlock, board.category])).toEqual([
      ["solvency", "argument"],
      ["solvency", "impact_framing"],
    ]);
    expect(boards[0].ideas).toEqual([]);
    expect(boards[0].prompt.length).toBeGreaterThan(0);
  });

  it("populates a coverage-gap board with any ideas already submitted for it", () => {
    saveTrackedArgument({ id: "t1", topic: "Energy Policy", argBlock: "solvency" });
    saveBrainstormIdea(SOLVENCY_IDEA);

    const boards = buildBrainstormBoardsPanelViewForTopic("Energy Policy");
    const seeded = boards.find((board) => board.argBlock === "solvency" && board.category === "argument");

    expect(seeded?.ideas.map((idea) => idea.id)).toEqual(["idea-1"]);
  });

  it("merges in boards that already have a submitted idea but aren't a coverage-gap seed", () => {
    saveTrackedArgument({ id: "t1", topic: "Energy Policy", argBlock: "solvency" });
    const toplineIdea: BrainstormIdea = {
      id: "idea-3",
      argBlock: "topicality",
      category: "argument",
      contributorId: "carol",
      text: "Reasonability outweighs competing interpretations",
      upvotes: 1,
    };
    saveBrainstormIdea(toplineIdea);

    const boards = buildBrainstormBoardsPanelViewForTopic("Energy Policy");

    expect(boards.map((board) => [board.argBlock, board.category])).toEqual([
      ["solvency", "argument"],
      ["solvency", "impact_framing"],
      ["topicality", "argument"],
    ]);
    expect(boards[2].ideas.map((idea) => idea.id)).toEqual(["idea-3"]);
  });

  it("returns only non-seed boards with submitted ideas when the topic has no tracked arguments", () => {
    saveBrainstormIdea(SOLVENCY_IDEA);
    expect(buildBrainstormBoardsPanelViewForTopic("Untracked Topic")).toEqual(buildBrainstormBoardsPanelView());
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

describe("mergePersistedBrainstormIdeas", () => {
  it("folds the duplicate's upvotes into the target and deletes the duplicate", () => {
    saveBrainstormIdea(SOLVENCY_IDEA);
    saveBrainstormIdea(DUPLICATE_SOLVENCY_IDEA);

    mergePersistedBrainstormIdeas("idea-1", "idea-4");

    expect(getBrainstormIdea("idea-1")).toEqual({
      ...SOLVENCY_IDEA,
      upvotes: SOLVENCY_IDEA.upvotes + DUPLICATE_SOLVENCY_IDEA.upvotes,
    });
    expect(getBrainstormIdea("idea-4")).toBeUndefined();
    expect(listBrainstormIdeas()).toHaveLength(1);
  });

  it("is a no-op when the target id isn't stored", () => {
    saveBrainstormIdea(DUPLICATE_SOLVENCY_IDEA);
    mergePersistedBrainstormIdeas("missing", "idea-4");
    expect(listBrainstormIdeas()).toEqual([DUPLICATE_SOLVENCY_IDEA]);
  });

  it("is a no-op when the duplicate id isn't stored", () => {
    saveBrainstormIdea(SOLVENCY_IDEA);
    mergePersistedBrainstormIdeas("idea-1", "missing");
    expect(listBrainstormIdeas()).toEqual([SOLVENCY_IDEA]);
  });
});

describe("sendBrainstormIdeaToArgumentLibrary", () => {
  it("saves the idea as a block-kind evidence-library entry under the given topic/case area", () => {
    sendBrainstormIdeaToArgumentLibrary(SOLVENCY_IDEA, "Energy Policy", "Aff");

    const entry = getEvidenceLibraryEntry(`brainstorm-${SOLVENCY_IDEA.id}`);
    expect(entry).toBeDefined();
    expect(entry?.kind).toBe("block");
    expect(entry?.topic).toBe("Energy Policy");
    expect(entry?.caseArea).toBe("Aff");
    expect(entry?.argBlock).toBe(SOLVENCY_IDEA.argBlock);
    expect(entry?.text).toBe(SOLVENCY_IDEA.text);
    expect(entry?.createdAt).toBeTypeOf("number");
  });

  it("overwrites the same entry when the same idea is sent again", () => {
    sendBrainstormIdeaToArgumentLibrary(SOLVENCY_IDEA, "Energy Policy", "Aff");
    sendBrainstormIdeaToArgumentLibrary(SOLVENCY_IDEA, "Energy Policy", "Neg");

    const entry = getEvidenceLibraryEntry(`brainstorm-${SOLVENCY_IDEA.id}`);
    expect(entry?.caseArea).toBe("Neg");
  });
});

describe("isBrainstormIdeaInArgumentLibrary", () => {
  it("is false before the idea has been sent", () => {
    expect(isBrainstormIdeaInArgumentLibrary(SOLVENCY_IDEA.id)).toBe(false);
  });

  it("is true once the idea has been sent", () => {
    sendBrainstormIdeaToArgumentLibrary(SOLVENCY_IDEA, "Energy Policy", "Aff");
    expect(isBrainstormIdeaInArgumentLibrary(SOLVENCY_IDEA.id)).toBe(true);
  });
});
