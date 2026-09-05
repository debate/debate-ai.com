import { describe, expect, it } from "vitest";
import {
  DEMO_ACCOUNT,
  DEMO_FLOW_IDS,
  buildDemoSeed,
  getFlowCell,
  isDemoAccountEmail,
  setFlowCell,
} from "../src/state/demoAccount";
import { MAX_SAVED_FLOW_BYTES, deriveFlowLabel, isValidFlow } from "../src/state/savedFlows";
import { MAX_SHARED_FILE_BYTES, validateSharedFilePayload } from "../src/state/sharedFiles";
import { newFlow } from "../src/utils/flow-utils";

describe("isDemoAccountEmail", () => {
  it("matches the demo email case-insensitively and ignores whitespace", () => {
    expect(isDemoAccountEmail(DEMO_ACCOUNT.email)).toBe(true);
    expect(isDemoAccountEmail("  DEMO@Debate-AI.com ")).toBe(true);
  });

  it("rejects other emails and empty values", () => {
    expect(isDemoAccountEmail("alice@example.com")).toBe(false);
    expect(isDemoAccountEmail("")).toBe(false);
    expect(isDemoAccountEmail(null)).toBe(false);
    expect(isDemoAccountEmail(undefined)).toBe(false);
  });
});

describe("setFlowCell / getFlowCell", () => {
  it("round-trips a cell in a column-chain flow", () => {
    const flow = newFlow(0, "primary", false, 2)!;
    setFlowCell(flow, 1, 2, "hello");
    expect(getFlowCell(flow, 1, 2)).toBe("hello");
    expect(getFlowCell(flow, 1, 1)).toBe("");
  });

  it("ignores out-of-range coordinates", () => {
    const flow = newFlow(0, "primary", false, 2)!;
    expect(() => setFlowCell(flow, 500, 0, "x")).not.toThrow();
    expect(() => setFlowCell(flow, 0, 50, "x")).not.toThrow();
    expect(getFlowCell(flow, 500, 0)).toBe("");
    expect(getFlowCell(flow, 0, 50)).toBe("");
  });
});

describe("buildDemoSeed", () => {
  const seed = buildDemoSeed();

  it("is deterministic", () => {
    expect(JSON.stringify(buildDemoSeed())).toBe(JSON.stringify(seed));
  });

  it("seeds documents with unique titles whose folders exist", () => {
    const titles = seed.documents.map((doc) => doc.title);
    expect(new Set(titles).size).toBe(titles.length);
    const folders = new Set(seed.documents.filter((doc) => doc.isFolder).map((doc) => doc.title));
    for (const doc of seed.documents) {
      if (doc.folder) expect(folders.has(doc.folder)).toBe(true);
      if (!doc.isFolder) expect(doc.content.length).toBeGreaterThan(0);
    }
  });

  it("seeds flows that pass the saved-flow validator with the stable ids", () => {
    expect(seed.flows.map((flow) => flow.id)).toEqual(Object.values(DEMO_FLOW_IDS));
    for (const flow of seed.flows) {
      expect(isValidFlow(flow)).toBe(true);
      expect(JSON.stringify(flow).length).toBeLessThan(MAX_SAVED_FLOW_BYTES);
      expect(deriveFlowLabel(flow)).toBe(flow.content);
      expect(getFlowCell(flow, 0, 0).length).toBeGreaterThan(0);
    }
  });

  it("seeds the policy flow with its speech doc and eight columns", () => {
    const policy = seed.flows.find((flow) => flow.id === DEMO_FLOW_IDS.policy)!;
    expect(policy.columns).toHaveLength(8);
    expect(policy.speechDocs?.["1AC"]).toContain("1AC");
    expect(getFlowCell(policy, 0, 7)).toContain("Link turn");
  });

  it("seeds shared files that pass the shared-file validator, with one unpublished draft", () => {
    const titles = seed.sharedFiles.map((file) => file.title);
    expect(new Set(titles).size).toBe(titles.length);
    for (const file of seed.sharedFiles) {
      const result = validateSharedFilePayload({ title: file.title, content: file.content, tags: file.tags, published: file.published });
      expect(result.ok).toBe(true);
      expect(file.content.length).toBeLessThan(MAX_SHARED_FILE_BYTES);
    }
    expect(seed.sharedFiles.filter((file) => !file.published)).toHaveLength(1);
    expect(seed.sharedFiles.filter((file) => file.published).length).toBeGreaterThanOrEqual(2);
  });
});
