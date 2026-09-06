import { describe, expect, it } from "vitest";
import {
  SelfVerificationNotAllowedError,
  VerifierIdRequiredError,
  assertVerifierAllowed,
} from "../src/lib/task-verification";
import type { RoutedAssignment } from "debate-research-evidence/src/lib/research-task-routing";

const ASSIGNMENT: RoutedAssignment = {
  task: { argBlock: "Solvency", level: "missing", requiredSkill: "intermediate" },
  contributorId: "alice",
};

describe("assertVerifierAllowed", () => {
  it("returns the trimmed verifier id when it differs from the assignee", () => {
    expect(assertVerifierAllowed(ASSIGNMENT, "  bob  ")).toBe("bob");
  });

  it("throws VerifierIdRequiredError for a blank verifier id", () => {
    expect(() => assertVerifierAllowed(ASSIGNMENT, "")).toThrow(VerifierIdRequiredError);
    expect(() => assertVerifierAllowed(ASSIGNMENT, "   ")).toThrow(VerifierIdRequiredError);
  });

  it("throws SelfVerificationNotAllowedError when the verifier id matches the assignee", () => {
    expect(() => assertVerifierAllowed(ASSIGNMENT, "alice")).toThrow(SelfVerificationNotAllowedError);
  });

  it("throws SelfVerificationNotAllowedError when the verifier id matches the assignee in a different case", () => {
    expect(() => assertVerifierAllowed(ASSIGNMENT, "Alice")).toThrow(SelfVerificationNotAllowedError);
    expect(() => assertVerifierAllowed(ASSIGNMENT, "ALICE")).toThrow(SelfVerificationNotAllowedError);
  });

  it("throws SelfVerificationNotAllowedError even when the matching id has surrounding whitespace", () => {
    expect(() => assertVerifierAllowed(ASSIGNMENT, "  alice  ")).toThrow(SelfVerificationNotAllowedError);
  });
});
