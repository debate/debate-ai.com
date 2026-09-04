import { describe, expect, it } from "vitest";
import { isValidCoachMaterialRecord } from "../src/state/savedCoachMaterials";
import type { CoachMaterial } from "../src/coach/team-coach-materials";

function makeRecord(overrides: Partial<CoachMaterial> = {}): CoachMaterial {
  return {
    id: "lecture-1",
    kind: "lecture_transcript",
    title: "Topicality Basics",
    tags: ["theory"],
    text: "A lecture transcript about topicality.",
    ...overrides,
  };
}

describe("isValidCoachMaterialRecord", () => {
  it("accepts a well-formed record with only required fields", () => {
    expect(isValidCoachMaterialRecord(makeRecord())).toBe(true);
  });

  it("accepts a record with the optional topic present", () => {
    expect(isValidCoachMaterialRecord(makeRecord({ topic: "T" }))).toBe(true);
  });

  it("accepts a record with an empty tags array", () => {
    expect(isValidCoachMaterialRecord(makeRecord({ tags: [] }))).toBe(true);
  });

  it.each([null, undefined, "record", 42, [], true])("rejects a non-object value %p", (value) => {
    expect(isValidCoachMaterialRecord(value)).toBe(false);
  });

  it("rejects a record with a non-string id", () => {
    expect(isValidCoachMaterialRecord(makeRecord({ id: 5 as unknown as string }))).toBe(false);
  });

  it("rejects a record with an empty/whitespace-only id", () => {
    expect(isValidCoachMaterialRecord(makeRecord({ id: "   " }))).toBe(false);
  });

  it("rejects a record whose kind isn't one of the known CoachMaterialKinds", () => {
    expect(
      isValidCoachMaterialRecord(makeRecord({ kind: "video" as unknown as CoachMaterial["kind"] })),
    ).toBe(false);
  });

  it("rejects a record with an empty/whitespace-only title", () => {
    expect(isValidCoachMaterialRecord(makeRecord({ title: "   " }))).toBe(false);
  });

  it("rejects a record whose topic is present but empty/whitespace-only", () => {
    expect(isValidCoachMaterialRecord(makeRecord({ topic: "   " }))).toBe(false);
  });

  it("rejects a record whose topic is a non-string", () => {
    expect(isValidCoachMaterialRecord(makeRecord({ topic: 5 as unknown as string }))).toBe(false);
  });

  it("rejects a record whose tags isn't an array", () => {
    expect(isValidCoachMaterialRecord(makeRecord({ tags: "theory" as unknown as string[] }))).toBe(false);
  });

  it("rejects a record whose tags contains a non-string", () => {
    expect(isValidCoachMaterialRecord(makeRecord({ tags: [5] as unknown as string[] }))).toBe(false);
  });

  it("rejects a record with an empty/whitespace-only text", () => {
    expect(isValidCoachMaterialRecord(makeRecord({ text: "   " }))).toBe(false);
  });

  it("rejects a record with a non-string text", () => {
    expect(isValidCoachMaterialRecord(makeRecord({ text: 5 as unknown as string }))).toBe(false);
  });

  it("accepts a record with no status/review fields at all (pre-review-workflow records)", () => {
    expect(isValidCoachMaterialRecord(makeRecord())).toBe(true);
  });

  it.each(["pending", "approved", "rejected"])("accepts a record with status %p", (status) => {
    expect(isValidCoachMaterialRecord(makeRecord({ status: status as CoachMaterial["status"] }))).toBe(true);
  });

  it("rejects a record whose status isn't one of the known CoachMaterialStatuses", () => {
    expect(
      isValidCoachMaterialRecord(makeRecord({ status: "in_review" as unknown as CoachMaterial["status"] })),
    ).toBe(false);
  });

  it("accepts a record with reviewedBy, reviewedAt, and reviewNote present", () => {
    expect(
      isValidCoachMaterialRecord(
        makeRecord({ status: "approved", reviewedBy: "Coach K", reviewedAt: 1000, reviewNote: "Looks good" }),
      ),
    ).toBe(true);
  });

  it("rejects a record whose reviewedBy is present but empty/whitespace-only", () => {
    expect(isValidCoachMaterialRecord(makeRecord({ reviewedBy: "   " }))).toBe(false);
  });

  it("rejects a record whose reviewedAt is present but not a number", () => {
    expect(
      isValidCoachMaterialRecord(makeRecord({ reviewedAt: "yesterday" as unknown as number })),
    ).toBe(false);
  });

  it("rejects a record whose reviewNote is present but empty/whitespace-only", () => {
    expect(isValidCoachMaterialRecord(makeRecord({ reviewNote: "   " }))).toBe(false);
  });
});
