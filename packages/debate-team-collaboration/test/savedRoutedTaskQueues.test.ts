import { describe, expect, it } from "vitest";
import { isValidRoutedTaskQueueRecord } from "../src/state/savedRoutedTaskQueues";
import type { RoutedTaskQueueRecord } from "../src/state/routedTaskQueues";

function makeRecord(overrides: Partial<RoutedTaskQueueRecord> = {}): RoutedTaskQueueRecord {
  return {
    topicId: "topic-ai",
    result: {
      assignments: [
        { task: { argBlock: "Solvency", level: "missing", requiredSkill: "intermediate" }, contributorId: "alice" },
      ],
      unassignedTasks: [{ argBlock: "Impacts", level: "thin", requiredSkill: "novice" }],
    },
    ...overrides,
  };
}

describe("isValidRoutedTaskQueueRecord", () => {
  it("accepts a well-formed record with only required fields", () => {
    expect(isValidRoutedTaskQueueRecord(makeRecord())).toBe(true);
  });

  it("accepts a record with no assignments or unassigned tasks", () => {
    expect(
      isValidRoutedTaskQueueRecord(makeRecord({ result: { assignments: [], unassignedTasks: [] } })),
    ).toBe(true);
  });

  it("accepts an assignment with a priority", () => {
    expect(
      isValidRoutedTaskQueueRecord(
        makeRecord({
          result: {
            assignments: [
              {
                task: { argBlock: "Solvency", level: "missing", requiredSkill: "intermediate" },
                contributorId: "alice",
                priority: "high",
              },
            ],
            unassignedTasks: [],
          },
        }),
      ),
    ).toBe(true);
  });

  it("accepts a task with a category", () => {
    expect(
      isValidRoutedTaskQueueRecord(
        makeRecord({
          result: {
            assignments: [],
            unassignedTasks: [{ argBlock: "Impacts", category: "DA", level: "thin", requiredSkill: "novice" }],
          },
        }),
      ),
    ).toBe(true);
  });

  it("accepts a record with updatedAt present", () => {
    expect(isValidRoutedTaskQueueRecord(makeRecord({ updatedAt: 1700000000000 }))).toBe(true);
  });

  it.each([null, undefined, "record", 42, [], true])("rejects a non-object value %p", (value) => {
    expect(isValidRoutedTaskQueueRecord(value)).toBe(false);
  });

  it("rejects a record with a non-string topicId", () => {
    expect(isValidRoutedTaskQueueRecord(makeRecord({ topicId: 5 as unknown as string }))).toBe(false);
  });

  it("rejects a record with an empty/whitespace-only topicId", () => {
    expect(isValidRoutedTaskQueueRecord(makeRecord({ topicId: "   " }))).toBe(false);
  });

  it("rejects a record whose result isn't an object", () => {
    expect(isValidRoutedTaskQueueRecord(makeRecord({ result: "not an object" as never }))).toBe(false);
  });

  it("rejects a record whose assignments isn't an array", () => {
    const record = makeRecord() as unknown as { result: Record<string, unknown> };
    record.result.assignments = "not an array";
    expect(isValidRoutedTaskQueueRecord(record)).toBe(false);
  });

  it("rejects a record whose unassignedTasks isn't an array", () => {
    const record = makeRecord() as unknown as { result: Record<string, unknown> };
    record.result.unassignedTasks = "not an array";
    expect(isValidRoutedTaskQueueRecord(record)).toBe(false);
  });

  it("rejects an assignment with an unknown priority", () => {
    expect(
      isValidRoutedTaskQueueRecord(
        makeRecord({
          result: {
            assignments: [
              {
                task: { argBlock: "Solvency", level: "missing", requiredSkill: "intermediate" },
                contributorId: "alice",
                priority: "urgent" as never,
              },
            ],
            unassignedTasks: [],
          },
        }),
      ),
    ).toBe(false);
  });

  it("rejects an assignment with a non-string contributorId", () => {
    expect(
      isValidRoutedTaskQueueRecord(
        makeRecord({
          result: {
            assignments: [
              {
                task: { argBlock: "Solvency", level: "missing", requiredSkill: "intermediate" },
                contributorId: 5 as unknown as string,
              },
            ],
            unassignedTasks: [],
          },
        }),
      ),
    ).toBe(false);
  });

  it("rejects a task with an unknown coverage level", () => {
    expect(
      isValidRoutedTaskQueueRecord(
        makeRecord({
          result: {
            assignments: [],
            unassignedTasks: [{ argBlock: "Impacts", level: "bogus" as never, requiredSkill: "novice" }],
          },
        }),
      ),
    ).toBe(false);
  });

  it("rejects a task with an unknown required skill level", () => {
    expect(
      isValidRoutedTaskQueueRecord(
        makeRecord({
          result: {
            assignments: [],
            unassignedTasks: [{ argBlock: "Impacts", level: "thin", requiredSkill: "expert" as never }],
          },
        }),
      ),
    ).toBe(false);
  });

  it("rejects a task with a non-string argBlock", () => {
    expect(
      isValidRoutedTaskQueueRecord(
        makeRecord({
          result: {
            assignments: [],
            unassignedTasks: [{ argBlock: 5 as unknown as string, level: "thin", requiredSkill: "novice" }],
          },
        }),
      ),
    ).toBe(false);
  });

  it("rejects a record whose updatedAt is present but not a number", () => {
    expect(
      isValidRoutedTaskQueueRecord(makeRecord({ updatedAt: "yesterday" as unknown as number })),
    ).toBe(false);
  });
});
