import { describe, expect, it } from "vitest";
import { shouldShowVerbatimNudge } from "../src/editor/verbatim-nudge";

const base = {
  hasSeenVerbatimNudge: false,
  hasOpenedShortcutsReference: false,
  hasSeenUiTour: false,
};

describe("shouldShowVerbatimNudge", () => {
  it("shows once the tour has been resolved (started, or auto-skipped for an established profile)", () => {
    expect(shouldShowVerbatimNudge({ ...base, hasSeenUiTour: true })).toBe(true);
  });

  it("does not show for a profile that hasn't been offered the tour yet", () => {
    expect(shouldShowVerbatimNudge(base)).toBe(false);
  });

  it("does not show again once already shown", () => {
    expect(
      shouldShowVerbatimNudge({ ...base, hasSeenVerbatimNudge: true, hasSeenUiTour: true }),
    ).toBe(false);
  });

  it("does not show once the reference has already been opened by any route", () => {
    expect(
      shouldShowVerbatimNudge({ ...base, hasOpenedShortcutsReference: true, hasSeenUiTour: true }),
    ).toBe(false);
  });
});
