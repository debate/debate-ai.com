import { beforeEach, describe, expect, it } from "vitest";
import {
  deleteCounselPanelAssessment,
  getCounselPanelAssessment,
  saveCounselPanelAssessment,
} from "../src/state/counselPanelAssessments";
import type { CounselPanelAiResult } from "../src/flow/response-outcome-ai";

/** Minimal in-memory `localStorage` mock — this package's Vitest environment has no DOM by default here. */
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

const ASSESSMENT: CounselPanelAiResult = {
  argumentAssessments: [
    {
      rowIndex: 0,
      counselRole: "Policy Counsel",
      likelyResponsePath: "Negative reads a solvency deficit.",
      clashEstimate: "Clash on mechanism feasibility.",
    },
  ],
  overallClashSummary: "Clash concentrates on solvency.",
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("getCounselPanelAssessment", () => {
  it("returns undefined when nothing is stored", () => {
    expect(getCounselPanelAssessment("round-1")).toBeUndefined();
  });

  it("returns undefined when the stored value is corrupt JSON", () => {
    localStorage.setItem("counselPanelAssessments", "{not json");
    expect(getCounselPanelAssessment("round-1")).toBeUndefined();
  });

  it("returns undefined when the stored value isn't an object", () => {
    localStorage.setItem("counselPanelAssessments", JSON.stringify(["not", "an", "object"]));
    expect(getCounselPanelAssessment("round-1")).toBeUndefined();
  });

  it("returns undefined for a roundId that isn't stored", () => {
    saveCounselPanelAssessment("round-1", ASSESSMENT);
    expect(getCounselPanelAssessment("missing")).toBeUndefined();
  });
});

describe("saveCounselPanelAssessment", () => {
  it("round-trips a saved assessment", () => {
    saveCounselPanelAssessment("round-1", ASSESSMENT);
    expect(getCounselPanelAssessment("round-1")).toEqual(ASSESSMENT);
  });

  it("upserts — saving an existing roundId overwrites rather than duplicating it", () => {
    saveCounselPanelAssessment("round-1", ASSESSMENT);
    const revised: CounselPanelAiResult = {
      ...ASSESSMENT,
      overallClashSummary: "Revised summary.",
    };
    saveCounselPanelAssessment("round-1", revised);
    expect(getCounselPanelAssessment("round-1")).toEqual(revised);
  });

  it("keeps assessments for different round ids independent", () => {
    const other: CounselPanelAiResult = { ...ASSESSMENT, overallClashSummary: "Other round." };
    saveCounselPanelAssessment("round-1", ASSESSMENT);
    saveCounselPanelAssessment("round-2", other);

    expect(getCounselPanelAssessment("round-1")).toEqual(ASSESSMENT);
    expect(getCounselPanelAssessment("round-2")).toEqual(other);
  });
});

describe("deleteCounselPanelAssessment", () => {
  it("removes a stored assessment", () => {
    saveCounselPanelAssessment("round-1", ASSESSMENT);
    deleteCounselPanelAssessment("round-1");
    expect(getCounselPanelAssessment("round-1")).toBeUndefined();
  });

  it("is a no-op for a roundId that isn't stored", () => {
    expect(() => deleteCounselPanelAssessment("missing")).not.toThrow();
  });

  it("leaves other round ids untouched", () => {
    const other: CounselPanelAiResult = { ...ASSESSMENT, overallClashSummary: "Other round." };
    saveCounselPanelAssessment("round-1", ASSESSMENT);
    saveCounselPanelAssessment("round-2", other);

    deleteCounselPanelAssessment("round-1");

    expect(getCounselPanelAssessment("round-1")).toBeUndefined();
    expect(getCounselPanelAssessment("round-2")).toEqual(other);
  });
});
