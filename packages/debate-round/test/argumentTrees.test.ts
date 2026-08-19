import { beforeEach, describe, expect, it } from "vitest";
import {
  buildAndSaveArgumentTree,
  buildAndSaveArgumentTreeFromCurrentFlow,
  buildArgumentTreesPanelView,
  deleteArgumentTree,
  getArgumentTree,
  listArgumentTrees,
  saveArgumentTree,
} from "../src/state/argumentTrees";
import type { ArgumentTreeRecord } from "../src/state/argumentTrees";
import type { Box } from "debate-core/src/types/flow";

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

const ROUND_1: ArgumentTreeRecord = {
  roundId: "round-1",
  tree: [
    {
      id: "row-0",
      rowIndex: 0,
      isHeading: false,
      content: "Case advantage",
      originSpeech: "1AC",
      lastSpeech: "1AC",
      sideKey: "A",
      isUnanswered: true,
      entries: [],
      children: [],
    },
  ],
};

const ROUND_2: ArgumentTreeRecord = { roundId: "round-2", tree: [] };

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listArgumentTrees", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listArgumentTrees()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("argumentTrees", "{not json");
    expect(listArgumentTrees()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("argumentTrees", JSON.stringify({ not: "an array" }));
    expect(listArgumentTrees()).toEqual([]);
  });

  it("lists every saved tree", () => {
    saveArgumentTree(ROUND_1);
    saveArgumentTree(ROUND_2);
    expect(listArgumentTrees()).toEqual([ROUND_1, ROUND_2]);
  });
});

describe("getArgumentTree", () => {
  it("finds a saved tree by roundId", () => {
    saveArgumentTree(ROUND_1);
    expect(getArgumentTree("round-1")).toEqual(ROUND_1);
  });

  it("returns undefined for a roundId that isn't stored", () => {
    expect(getArgumentTree("missing")).toBeUndefined();
  });
});

describe("saveArgumentTree", () => {
  it("upserts — saving an existing roundId overwrites rather than duplicating it", () => {
    saveArgumentTree(ROUND_1);
    const revised: ArgumentTreeRecord = { roundId: "round-1", tree: [] };
    saveArgumentTree(revised);

    expect(listArgumentTrees()).toEqual([revised]);
    expect(getArgumentTree("round-1")).toEqual(revised);
  });
});

describe("deleteArgumentTree", () => {
  it("removes a stored tree by roundId", () => {
    saveArgumentTree(ROUND_1);
    saveArgumentTree(ROUND_2);
    deleteArgumentTree("round-1");

    expect(listArgumentTrees()).toEqual([ROUND_2]);
    expect(getArgumentTree("round-1")).toBeUndefined();
  });

  it("is a no-op when the roundId isn't stored", () => {
    saveArgumentTree(ROUND_2);
    deleteArgumentTree("missing");
    expect(listArgumentTrees()).toEqual([ROUND_2]);
  });
});

describe("buildAndSaveArgumentTree", () => {
  const COLUMNS = ["1AC", "1NC"];

  function rowFromContents(contents: string[], overrides: Partial<Box> = {}): Box {
    let box: Box | undefined;
    for (let i = contents.length - 1; i >= 0; i--) {
      const current: Box = {
        content: contents[i],
        children: box ? [box] : [],
        index: 0,
        level: i + 1,
        focus: false,
        empty: !contents[i].trim(),
      };
      box = current;
    }
    return { ...(box as Box), ...overrides };
  }

  it("derives a round's tree from its flow and persists it", () => {
    const flow = {
      columns: COLUMNS,
      children: [
        rowFromContents(["Off-case", ""], { isHeading: true }),
        rowFromContents(["Disad link", ""]),
      ],
    };

    const record = buildAndSaveArgumentTree(flow, "round-3");

    expect(record.roundId).toBe("round-3");
    expect(record.tree).toHaveLength(1);
    expect(record.tree[0]).toMatchObject({ isHeading: true, content: "Off-case" });
    expect(record.tree[0].children.map((n) => n.content)).toEqual(["Disad link"]);
    expect(getArgumentTree("round-3")).toEqual(record);
  });
});

describe("buildAndSaveArgumentTreeFromCurrentFlow", () => {
  const COLUMNS = ["1AC", "1NC"];

  function rowFromContents(contents: string[], overrides: Partial<Box> = {}): Box {
    let box: Box | undefined;
    for (let i = contents.length - 1; i >= 0; i--) {
      const current: Box = {
        content: contents[i],
        children: box ? [box] : [],
        index: 0,
        level: i + 1,
        focus: false,
        empty: !contents[i].trim(),
      };
      box = current;
    }
    return { ...(box as Box), ...overrides };
  }

  it("keys the saved tree by the flow's own id, stringified", () => {
    const flow = {
      id: 42,
      columns: COLUMNS,
      children: [rowFromContents(["Case advantage", ""])],
    };

    const record = buildAndSaveArgumentTreeFromCurrentFlow(flow);

    expect(record.roundId).toBe("42");
    expect(record.tree.map((n) => n.content)).toEqual(["Case advantage"]);
    expect(getArgumentTree("42")).toEqual(record);
  });

  it("persists an empty tree for a flow with no rows, without throwing", () => {
    const flow = { id: 7, columns: COLUMNS, children: [] };

    const record = buildAndSaveArgumentTreeFromCurrentFlow(flow);

    expect(record).toEqual({ roundId: "7", tree: [] });
    expect(getArgumentTree("7")).toEqual(record);
  });
});

describe("buildArgumentTreesPanelView", () => {
  it("sorts every persisted tree by roundId without mutating storage order", () => {
    saveArgumentTree(ROUND_2);
    saveArgumentTree(ROUND_1);

    expect(buildArgumentTreesPanelView().map((r) => r.roundId)).toEqual(["round-1", "round-2"]);
    expect(listArgumentTrees().map((r) => r.roundId)).toEqual(["round-2", "round-1"]);
  });
});
