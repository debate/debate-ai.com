import { describe, expect, it } from "vitest";
import { resolvePresetJumpRoundId } from "../src/state/outlineFilterPresetJump";

describe("resolvePresetJumpRoundId", () => {
  it("returns the preset's roundId when its round still exists", () => {
    expect(resolvePresetJumpRoundId({ roundId: "round-1" }, ["round-1", "round-2"])).toBe("round-1");
  });

  it("returns null when the preset predates roundId tracking", () => {
    expect(resolvePresetJumpRoundId({ roundId: undefined }, ["round-1"])).toBeNull();
  });

  it("returns null when the preset's origin round no longer exists", () => {
    expect(resolvePresetJumpRoundId({ roundId: "round-deleted" }, ["round-1", "round-2"])).toBeNull();
  });

  it("returns null against an empty round list", () => {
    expect(resolvePresetJumpRoundId({ roundId: "round-1" }, [])).toBeNull();
  });
});
