import { describe, expect, it } from "vitest";
import { isValidCoachMaterialVersionRecord } from "../src/state/savedCoachMaterialVersions";
import type { CoachMaterialVersion } from "../src/state/coachMaterialVersions";

function makeRecord(overrides: Partial<CoachMaterialVersion> = {}): CoachMaterialVersion {
  return {
    id: "lecture-1-v1000-0",
    materialId: "lecture-1",
    kind: "lecture_transcript",
    title: "Topicality Basics",
    tags: ["theory"],
    text: "A lecture transcript about topicality.",
    replacedAt: 1000,
    ...overrides,
  };
}

describe("isValidCoachMaterialVersionRecord", () => {
  it("accepts a well-formed record with only required fields", () => {
    expect(isValidCoachMaterialVersionRecord(makeRecord())).toBe(true);
  });

  it("accepts a record with the optional topic present", () => {
    expect(isValidCoachMaterialVersionRecord(makeRecord({ topic: "T" }))).toBe(true);
  });

  it("accepts a record with an empty title/text — a version snapshot may capture a since-blanked field", () => {
    expect(isValidCoachMaterialVersionRecord(makeRecord({ title: "", text: "" }))).toBe(true);
  });

  it.each([null, undefined, "record", 42, [], true])("rejects a non-object value %p", (value) => {
    expect(isValidCoachMaterialVersionRecord(value)).toBe(false);
  });

  it("rejects a record with a non-string id", () => {
    expect(isValidCoachMaterialVersionRecord(makeRecord({ id: 5 as unknown as string }))).toBe(false);
  });

  it("rejects a record with an empty/whitespace-only id", () => {
    expect(isValidCoachMaterialVersionRecord(makeRecord({ id: "   " }))).toBe(false);
  });

  it("rejects a record with an empty/whitespace-only materialId", () => {
    expect(isValidCoachMaterialVersionRecord(makeRecord({ materialId: "   " }))).toBe(false);
  });

  it("rejects a record whose kind isn't one of the known CoachMaterialKinds", () => {
    expect(
      isValidCoachMaterialVersionRecord(
        makeRecord({ kind: "video" as unknown as CoachMaterialVersion["kind"] }),
      ),
    ).toBe(false);
  });

  it("rejects a record with a non-string title", () => {
    expect(isValidCoachMaterialVersionRecord(makeRecord({ title: 5 as unknown as string }))).toBe(false);
  });

  it("rejects a record whose topic is a non-string", () => {
    expect(isValidCoachMaterialVersionRecord(makeRecord({ topic: 5 as unknown as string }))).toBe(false);
  });

  it("rejects a record whose tags isn't an array", () => {
    expect(
      isValidCoachMaterialVersionRecord(makeRecord({ tags: "theory" as unknown as string[] })),
    ).toBe(false);
  });

  it("rejects a record whose tags contains a non-string", () => {
    expect(isValidCoachMaterialVersionRecord(makeRecord({ tags: [5] as unknown as string[] }))).toBe(false);
  });

  it("rejects a record with a non-string text", () => {
    expect(isValidCoachMaterialVersionRecord(makeRecord({ text: 5 as unknown as string }))).toBe(false);
  });

  it("rejects a record whose replacedAt is not a number", () => {
    expect(
      isValidCoachMaterialVersionRecord(makeRecord({ replacedAt: "yesterday" as unknown as number })),
    ).toBe(false);
  });
});
