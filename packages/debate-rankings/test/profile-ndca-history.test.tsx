// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { ProfileNdcaHistory } from "../src/leaderboard/profile/ProfileNdcaHistory";
import { mount, type Mounted } from "./helpers/mount";

describe("ProfileNdcaHistory", () => {
  let mounted: Mounted | null = null;
  afterEach(async () => {
    await mounted?.unmount();
    mounted = null;
  });

  it("lists a school's NDCA titles and elim finishes by year, without speaker places", async () => {
    mounted = await mount(<ProfileNdcaHistory school="Glenbrook North High School (IL)" />);
    const text = mounted.container.textContent ?? "";
    expect(text).toContain("NDCA national championship (policy)");
    expect(text).toContain("Quarterfinalist");
    expect(text).toContain("Matt Fisher & Stephanie Spies");
    // Speaker places below first only score points; they aren't listed.
    expect(text).not.toContain("5th speaker");
    expect(text).not.toContain("Speaker places");
  });

  it("renders nothing for a school with no NDCA result", async () => {
    mounted = await mount(<ProfileNdcaHistory school="Nowhere High School" />);
    expect(mounted.container.textContent).toBe("");
  });
});
