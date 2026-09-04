import { describe, expect, it } from "vitest";
import { isValidCounselPanelAssessmentRecord } from "../src/state/savedCounselPanelAssessments";
import type { CounselPanelAssessmentRecord } from "../src/state/counselPanelAssessments";

function makeRecord(overrides: Partial<CounselPanelAssessmentRecord> = {}): CounselPanelAssessmentRecord {
  return {
    id: "counsel-1700000000000-ab12cd",
    roundId: "round-1",
    result: {
      argumentAssessments: [
        {
          rowIndex: 0,
          counselRole: "Policy Counsel",
          likelyResponsePath: "Negative reads a solvency deficit.",
          clashEstimate: "Clash on mechanism feasibility.",
        },
      ],
      overallClashSummary: "Clash concentrates on solvency.",
    },
    generatedAt: 1700000000000,
    ...overrides,
  };
}

describe("isValidCounselPanelAssessmentRecord", () => {
  it("accepts a well-formed record", () => {
    expect(isValidCounselPanelAssessmentRecord(makeRecord())).toBe(true);
  });

  it("accepts every counsel role", () => {
    for (const counselRole of ["Policy Counsel", "Kritik Counsel", "Weighing Counsel"] as const) {
      const record = makeRecord({
        result: {
          argumentAssessments: [{ rowIndex: 0, counselRole, likelyResponsePath: "x", clashEstimate: "y" }],
          overallClashSummary: "z",
        },
      });
      expect(isValidCounselPanelAssessmentRecord(record)).toBe(true);
    }
  });

  it.each([null, undefined, "record", 42, [], true])("rejects a non-object value %p", (value) => {
    expect(isValidCounselPanelAssessmentRecord(value)).toBe(false);
  });

  it("rejects a record with a non-string id", () => {
    expect(isValidCounselPanelAssessmentRecord(makeRecord({ id: 5 as unknown as string }))).toBe(false);
  });

  it("rejects a record with an empty/whitespace-only id", () => {
    expect(isValidCounselPanelAssessmentRecord(makeRecord({ id: "   " }))).toBe(false);
  });

  it("rejects a record with an empty/whitespace-only roundId", () => {
    expect(isValidCounselPanelAssessmentRecord(makeRecord({ roundId: "" }))).toBe(false);
  });

  it("rejects a record missing result", () => {
    const record = makeRecord() as unknown as Record<string, unknown>;
    delete record.result;
    expect(isValidCounselPanelAssessmentRecord(record)).toBe(false);
  });

  it("rejects a result with an empty argumentAssessments list", () => {
    expect(
      isValidCounselPanelAssessmentRecord(
        makeRecord({ result: { argumentAssessments: [], overallClashSummary: "z" } }),
      ),
    ).toBe(false);
  });

  it("rejects a result whose argumentAssessments isn't an array", () => {
    expect(
      isValidCounselPanelAssessmentRecord(
        makeRecord({
          result: { argumentAssessments: "not an array" as never, overallClashSummary: "z" },
        }),
      ),
    ).toBe(false);
  });

  it("rejects an argument assessment with a non-finite rowIndex", () => {
    const record = makeRecord();
    record.result.argumentAssessments[0].rowIndex = NaN;
    expect(isValidCounselPanelAssessmentRecord(record)).toBe(false);
  });

  it("rejects an argument assessment with an invalid counselRole", () => {
    const record = makeRecord();
    (record.result.argumentAssessments[0] as unknown as Record<string, unknown>).counselRole = "Not A Role";
    expect(isValidCounselPanelAssessmentRecord(record)).toBe(false);
  });

  it("rejects an argument assessment with a non-string likelyResponsePath", () => {
    const record = makeRecord();
    (record.result.argumentAssessments[0] as unknown as Record<string, unknown>).likelyResponsePath = 5;
    expect(isValidCounselPanelAssessmentRecord(record)).toBe(false);
  });

  it("rejects an argument assessment with a non-string clashEstimate", () => {
    const record = makeRecord();
    (record.result.argumentAssessments[0] as unknown as Record<string, unknown>).clashEstimate = 5;
    expect(isValidCounselPanelAssessmentRecord(record)).toBe(false);
  });

  it("rejects a result with a non-string overallClashSummary", () => {
    expect(
      isValidCounselPanelAssessmentRecord(
        makeRecord({
          result: {
            argumentAssessments: makeRecord().result.argumentAssessments,
            overallClashSummary: 5 as unknown as string,
          },
        }),
      ),
    ).toBe(false);
  });

  it("rejects a record whose generatedAt isn't a number", () => {
    expect(
      isValidCounselPanelAssessmentRecord(makeRecord({ generatedAt: "yesterday" as unknown as number })),
    ).toBe(false);
  });
});
