import { beforeEach, describe, expect, it } from "vitest";
import {
  deleteFlowAnnotation,
  getFlowAnnotation,
  listFlowAnnotations,
  listFlowAnnotationsForBox,
  listFlowAnnotationsForFlow,
  listFlowAnnotationsForSpeech,
  saveFlowAnnotation,
} from "../src/state/flowAnnotations";
import type { FlowAnnotation } from "../src/flow/flow-annotations";

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

const EARLY_ANNOTATION: FlowAnnotation = {
  id: "anno-1",
  flowId: 1,
  boxPath: [0, 1],
  speechId: "1AC",
  timestampMs: 1_000,
  note: "Solvency claim starts here",
  createdAt: 100,
};
const LATE_ANNOTATION: FlowAnnotation = {
  id: "anno-2",
  flowId: 1,
  boxPath: [0, 2],
  speechId: "1AC",
  timestampMs: 5_000,
  createdAt: 200,
};
const OTHER_FLOW_ANNOTATION: FlowAnnotation = {
  id: "anno-3",
  flowId: 2,
  boxPath: [0],
  speechId: "1NC",
  timestampMs: 2_000,
  createdAt: 300,
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listFlowAnnotations", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listFlowAnnotations()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("flowAnnotations", "{not json");
    expect(listFlowAnnotations()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("flowAnnotations", JSON.stringify({ not: "an array" }));
    expect(listFlowAnnotations()).toEqual([]);
  });

  it("lists every saved annotation across flows", () => {
    saveFlowAnnotation(EARLY_ANNOTATION);
    saveFlowAnnotation(OTHER_FLOW_ANNOTATION);
    expect(listFlowAnnotations()).toEqual([EARLY_ANNOTATION, OTHER_FLOW_ANNOTATION]);
  });
});

describe("listFlowAnnotationsForFlow", () => {
  it("returns only annotations for the given flow, in playback order", () => {
    saveFlowAnnotation(LATE_ANNOTATION);
    saveFlowAnnotation(EARLY_ANNOTATION);
    saveFlowAnnotation(OTHER_FLOW_ANNOTATION);

    expect(listFlowAnnotationsForFlow(1)).toEqual([EARLY_ANNOTATION, LATE_ANNOTATION]);
    expect(listFlowAnnotationsForFlow(2)).toEqual([OTHER_FLOW_ANNOTATION]);
  });

  it("returns an empty list for a flow with no annotations", () => {
    saveFlowAnnotation(EARLY_ANNOTATION);
    expect(listFlowAnnotationsForFlow(999)).toEqual([]);
  });
});

describe("listFlowAnnotationsForSpeech", () => {
  it("returns only annotations for the given speech, in playback order", () => {
    saveFlowAnnotation(LATE_ANNOTATION);
    saveFlowAnnotation(EARLY_ANNOTATION);
    saveFlowAnnotation(OTHER_FLOW_ANNOTATION);

    expect(listFlowAnnotationsForSpeech("1AC")).toEqual([EARLY_ANNOTATION, LATE_ANNOTATION]);
    expect(listFlowAnnotationsForSpeech("1NC")).toEqual([OTHER_FLOW_ANNOTATION]);
  });
});

describe("listFlowAnnotationsForBox", () => {
  it("returns only annotations attached to the given flow's box", () => {
    saveFlowAnnotation(EARLY_ANNOTATION);
    saveFlowAnnotation(LATE_ANNOTATION);

    expect(listFlowAnnotationsForBox(1, [0, 1])).toEqual([EARLY_ANNOTATION]);
    expect(listFlowAnnotationsForBox(1, [9, 9])).toEqual([]);
  });
});

describe("getFlowAnnotation", () => {
  it("finds a saved annotation by id", () => {
    saveFlowAnnotation(EARLY_ANNOTATION);
    expect(getFlowAnnotation("anno-1")).toEqual(EARLY_ANNOTATION);
  });

  it("returns undefined for an id that isn't stored", () => {
    expect(getFlowAnnotation("missing")).toBeUndefined();
  });
});

describe("saveFlowAnnotation", () => {
  it("upserts — saving an existing id overwrites rather than duplicating it", () => {
    saveFlowAnnotation(EARLY_ANNOTATION);
    const edited: FlowAnnotation = { ...EARLY_ANNOTATION, note: "Updated note" };
    saveFlowAnnotation(edited);

    expect(listFlowAnnotations()).toEqual([edited]);
    expect(getFlowAnnotation("anno-1")).toEqual(edited);
  });
});

describe("deleteFlowAnnotation", () => {
  it("removes a stored annotation by id", () => {
    saveFlowAnnotation(EARLY_ANNOTATION);
    saveFlowAnnotation(OTHER_FLOW_ANNOTATION);
    deleteFlowAnnotation("anno-1");

    expect(listFlowAnnotations()).toEqual([OTHER_FLOW_ANNOTATION]);
    expect(getFlowAnnotation("anno-1")).toBeUndefined();
  });

  it("is a no-op when the id isn't stored", () => {
    saveFlowAnnotation(OTHER_FLOW_ANNOTATION);
    deleteFlowAnnotation("missing");
    expect(listFlowAnnotations()).toEqual([OTHER_FLOW_ANNOTATION]);
  });
});
