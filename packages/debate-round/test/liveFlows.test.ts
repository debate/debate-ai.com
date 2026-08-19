import { beforeEach, describe, expect, it } from "vitest";
import { getLiveFlowByRoundId } from "../src/state/liveFlows";

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

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("getLiveFlowByRoundId", () => {
  it("returns undefined when no flows are stored", () => {
    expect(getLiveFlowByRoundId("42")).toBeUndefined();
  });

  it("degrades corrupt or non-array storage to undefined rather than throwing", () => {
    localStorage.setItem("flows", "not json");
    expect(getLiveFlowByRoundId("42")).toBeUndefined();

    localStorage.setItem("flows", JSON.stringify({ not: "an array" }));
    expect(getLiveFlowByRoundId("42")).toBeUndefined();
  });

  it("resolves a stored flow by its stringified numeric id", () => {
    localStorage.setItem(
      "flows",
      JSON.stringify([{ id: 42, children: [{ content: "AC", children: [], index: 0, level: 0, focus: false }], columns: ["AC"] }]),
    );
    const flow = getLiveFlowByRoundId("42");
    expect(flow?.columns).toEqual(["AC"]);
    expect(flow?.children).toHaveLength(1);
  });

  it("returns undefined for a roundId that doesn't match any stored flow", () => {
    localStorage.setItem("flows", JSON.stringify([{ id: 42, children: [], columns: [] }]));
    expect(getLiveFlowByRoundId("99")).toBeUndefined();
  });
});
