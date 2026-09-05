import { beforeEach, describe, expect, it } from "vitest";
import {
  buildPersistedTopicCoverageComparisonHeatmap,
  buildPersistedTopicCoverageReport,
  deleteTrackedArgument,
  listTrackedArguments,
  listTrackedTopics,
  saveTrackedArgument,
  type TrackedArgumentRecord,
} from "../src/state/trackedArguments";
import { saveEvidenceLibraryEntry } from "../src/state/evidenceLibraryEntries";
import type { EvidenceLibraryEntry } from "../src/lib/shared-evidence-library";
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

const WARMING_DA: TrackedArgumentRecord = {
  id: "tracked-1",
  topic: "Energy Policy",
  argBlock: "Warming DA",
  category: "DA",
};
const SOLVENCY: TrackedArgumentRecord = {
  id: "tracked-2",
  topic: "Energy Policy",
  argBlock: "Solvency",
};
const OTHER_TOPIC: TrackedArgumentRecord = {
  id: "tracked-3",
  topic: "Immigration Policy",
  argBlock: "Federalism DA",
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listTrackedArguments", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listTrackedArguments()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("trackedArguments", "{not json");
    expect(listTrackedArguments()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("trackedArguments", JSON.stringify({ not: "an array" }));
    expect(listTrackedArguments()).toEqual([]);
  });

  it("lists every saved record when no topic filter is given", () => {
    saveTrackedArgument(WARMING_DA);
    saveTrackedArgument(OTHER_TOPIC);
    expect(listTrackedArguments()).toEqual([WARMING_DA, OTHER_TOPIC]);
  });

  it("scopes the list to one topic when given", () => {
    saveTrackedArgument(WARMING_DA);
    saveTrackedArgument(SOLVENCY);
    saveTrackedArgument(OTHER_TOPIC);
    expect(listTrackedArguments("Energy Policy")).toEqual([WARMING_DA, SOLVENCY]);
  });
});

describe("listTrackedTopics", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listTrackedTopics()).toEqual([]);
  });

  it("returns every distinct topic, sorted alphabetically", () => {
    saveTrackedArgument(WARMING_DA);
    saveTrackedArgument(SOLVENCY);
    saveTrackedArgument(OTHER_TOPIC);
    expect(listTrackedTopics()).toEqual(["Energy Policy", "Immigration Policy"]);
  });
});

describe("saveTrackedArgument", () => {
  it("upserts — saving an existing id overwrites rather than duplicating it", () => {
    saveTrackedArgument(WARMING_DA);
    const revised: TrackedArgumentRecord = { ...WARMING_DA, category: "Kritik" };
    saveTrackedArgument(revised);

    expect(listTrackedArguments()).toEqual([revised]);
  });
});

describe("deleteTrackedArgument", () => {
  it("removes a stored record by id", () => {
    saveTrackedArgument(WARMING_DA);
    saveTrackedArgument(SOLVENCY);
    deleteTrackedArgument("tracked-1");

    expect(listTrackedArguments()).toEqual([SOLVENCY]);
  });

  it("is a no-op when the id isn't stored", () => {
    saveTrackedArgument(SOLVENCY);
    deleteTrackedArgument("missing");
    expect(listTrackedArguments()).toEqual([SOLVENCY]);
  });
});

describe("buildPersistedTopicCoverageReport", () => {
  const warmingCard: EvidenceLibraryEntry = {
    id: "entry-1",
    argBlock: "Warming DA",
    wordCount: 700,
    topic: "Energy Policy",
    caseArea: "DA",
    tags: ["warming"],
    kind: "card",
    text: "Rising emissions accelerate catastrophic warming impacts.",
    cite: "Smith 24",
  };
  const secondWarmingCard: EvidenceLibraryEntry = {
    id: "entry-2",
    argBlock: "Warming DA",
    wordCount: 200,
    topic: "Energy Policy",
    caseArea: "DA",
    tags: ["warming"],
    kind: "card",
    text: "A second card extending internal link strength.",
    cite: "Lee 25",
  };
  const thirdWarmingCard: EvidenceLibraryEntry = {
    id: "entry-3",
    argBlock: "Warming DA",
    wordCount: 200,
    topic: "Energy Policy",
    caseArea: "DA",
    tags: ["warming"],
    kind: "card",
    text: "A third card on uniqueness.",
    cite: "Chen 25",
  };
  const federalismCard: EvidenceLibraryEntry = {
    id: "entry-4",
    argBlock: "Federalism DA",
    wordCount: 500,
    topic: "Immigration Policy",
    caseArea: "DA",
    tags: [],
    kind: "card",
    text: "A card filed under a different topic entirely.",
    cite: "Doe 24",
  };
  const untrackedCard: EvidenceLibraryEntry = {
    id: "entry-5",
    argBlock: "Politics DA",
    wordCount: 300,
    topic: "Energy Policy",
    caseArea: "DA",
    tags: [],
    kind: "card",
    text: "Filed under an argument block nobody is tracking yet.",
    cite: "Rios 25",
  };

  it("classifies a tracked argument as missing when it has zero cards", () => {
    saveTrackedArgument(SOLVENCY);
    const report = buildPersistedTopicCoverageReport("Energy Policy");
    expect(report.tracked).toEqual([
      { argBlock: "Solvency", category: undefined, cardCount: 0, totalWordCount: 0, level: "missing" },
    ]);
  });

  it("classifies a tracked argument as covered once it clears both default thresholds", () => {
    saveTrackedArgument(WARMING_DA);
    saveEvidenceLibraryEntry(warmingCard);
    saveEvidenceLibraryEntry(secondWarmingCard);
    saveEvidenceLibraryEntry(thirdWarmingCard);

    const report = buildPersistedTopicCoverageReport("Energy Policy");
    expect(report.tracked).toEqual([
      { argBlock: "Warming DA", category: "DA", cardCount: 3, totalWordCount: 1100, level: "covered" },
    ]);
  });

  it("ignores evidence library entries filed under a different topic", () => {
    saveTrackedArgument(WARMING_DA);
    saveEvidenceLibraryEntry(warmingCard);
    saveEvidenceLibraryEntry(federalismCard);

    const report = buildPersistedTopicCoverageReport("Energy Policy");
    expect(report.tracked).toEqual([
      { argBlock: "Warming DA", category: "DA", cardCount: 1, totalWordCount: 700, level: "thin" },
    ]);
  });

  it("surfaces cards filed under an argument block nobody is tracking as untracked", () => {
    saveTrackedArgument(WARMING_DA);
    saveEvidenceLibraryEntry(untrackedCard);

    const report = buildPersistedTopicCoverageReport("Energy Policy");
    expect(report.untracked).toEqual([
      { argBlock: "Politics DA", category: undefined, cardCount: 1, totalWordCount: 300, level: "thin" },
    ]);
  });

  it("accepts a caller-supplied thresholds override", () => {
    saveTrackedArgument(WARMING_DA);
    saveEvidenceLibraryEntry(warmingCard);

    const report = buildPersistedTopicCoverageReport("Energy Policy", { minCards: 1, minTotalWords: 500 });
    expect(report.tracked[0].level).toBe("covered");
  });

  const baseContribution: AttributedContribution = {
    id: "contribution-1",
    contributorId: "alice",
    kind: "card",
    likes: 0,
    saves: 0,
    qualitySignals: [0.5],
    reviewerEndorsements: [],
  };

  it("folds in a Contributions Feed entry carrying topic + argBlock + wordCount", () => {
    saveTrackedArgument(WARMING_DA);
    saveEvidenceLibraryEntry(warmingCard);
    saveContribution({ ...baseContribution, topic: "Energy Policy", argBlock: "Warming DA", wordCount: 400 });

    const report = buildPersistedTopicCoverageReport("Energy Policy");
    expect(report.tracked).toEqual([
      { argBlock: "Warming DA", category: "DA", cardCount: 2, totalWordCount: 1100, level: "thin" },
    ]);
  });

  it("excludes a contribution missing wordCount", () => {
    saveTrackedArgument(WARMING_DA);
    saveContribution({ ...baseContribution, topic: "Energy Policy", argBlock: "Warming DA" });

    const report = buildPersistedTopicCoverageReport("Energy Policy");
    expect(report.tracked).toEqual([
      { argBlock: "Warming DA", category: "DA", cardCount: 0, totalWordCount: 0, level: "missing" },
    ]);
  });

  it("excludes a contribution missing argBlock", () => {
    saveTrackedArgument(WARMING_DA);
    saveContribution({ ...baseContribution, topic: "Energy Policy", wordCount: 400 });

    const report = buildPersistedTopicCoverageReport("Energy Policy");
    expect(report.tracked).toEqual([
      { argBlock: "Warming DA", category: "DA", cardCount: 0, totalWordCount: 0, level: "missing" },
    ]);
  });

  it("excludes a contribution filed under a different topic", () => {
    saveTrackedArgument(WARMING_DA);
    saveContribution({ ...baseContribution, topic: "Immigration Policy", argBlock: "Warming DA", wordCount: 400 });

    const report = buildPersistedTopicCoverageReport("Energy Policy");
    expect(report.tracked).toEqual([
      { argBlock: "Warming DA", category: "DA", cardCount: 0, totalWordCount: 0, level: "missing" },
    ]);
  });
});

describe("buildPersistedTopicCoverageComparisonHeatmap", () => {
  it("returns an empty grid when no topic has a tracked-argument checklist", () => {
    expect(buildPersistedTopicCoverageComparisonHeatmap()).toEqual({ categories: [], rows: [] });
  });

  it("compares every tracked topic by default, built from persisted stores", () => {
    saveTrackedArgument(WARMING_DA);
    saveTrackedArgument(OTHER_TOPIC);

    const heatmap = buildPersistedTopicCoverageComparisonHeatmap();
    expect(heatmap.rows.map((row) => row.topic)).toEqual(["Energy Policy", "Immigration Policy"]);
    // WARMING_DA carries category "DA"; OTHER_TOPIC's "Federalism DA" has none, so it groups as uncategorized.
    expect(heatmap.categories).toEqual(["DA", "Uncategorized"]);
    // Neither has any submitted cards yet, so both are fully missing.
    expect(heatmap.rows.every((row) => row.coveredCount === 0 && row.totalCount === 1)).toBe(true);
  });

  it("scopes the comparison to a caller-supplied topic subset", () => {
    saveTrackedArgument(WARMING_DA);
    saveTrackedArgument(OTHER_TOPIC);

    const heatmap = buildPersistedTopicCoverageComparisonHeatmap(["Energy Policy"]);
    expect(heatmap.rows.map((row) => row.topic)).toEqual(["Energy Policy"]);
  });
});
