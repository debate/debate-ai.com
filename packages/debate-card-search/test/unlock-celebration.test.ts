import { describe, expect, it } from "vitest";
import { buildUnlockCelebrationMessage, getNewlyEarnedBadges } from "../src/lib/unlock-celebration";

describe("getNewlyEarnedBadges", () => {
  it("returns nothing when there is no previous baseline (first sight)", () => {
    expect(getNewlyEarnedBadges(undefined, ["Rising Researcher"])).toEqual([]);
  });

  it("returns nothing when the badge list hasn't changed", () => {
    expect(getNewlyEarnedBadges(["Rising Researcher"], ["Rising Researcher"])).toEqual([]);
  });

  it("returns badges present now but not in the previous baseline", () => {
    expect(getNewlyEarnedBadges(["Rising Researcher"], ["Rising Researcher", "Seasoned Contributor"])).toEqual([
      "Seasoned Contributor",
    ]);
  });

  it("returns every badge when starting from an empty (but defined) baseline", () => {
    expect(getNewlyEarnedBadges([], ["Rising Researcher"])).toEqual(["Rising Researcher"]);
  });

  it("never reports a badge that dropped out of the current list", () => {
    expect(getNewlyEarnedBadges(["Rising Researcher", "Seasoned Contributor"], ["Rising Researcher"])).toEqual([]);
  });
});

describe("buildUnlockCelebrationMessage", () => {
  it("returns an empty string for no newly earned badges", () => {
    expect(buildUnlockCelebrationMessage([])).toBe("");
  });

  it("singular-phrases a single newly earned badge", () => {
    expect(buildUnlockCelebrationMessage(["Rising Researcher"])).toBe("🎉 New badge earned: Rising Researcher!");
  });

  it("lists multiple newly earned badges together", () => {
    expect(buildUnlockCelebrationMessage(["Rising Researcher", "🔥 7-Day Streak"])).toBe(
      "🎉 New badges earned: Rising Researcher, 🔥 7-Day Streak!",
    );
  });
});
