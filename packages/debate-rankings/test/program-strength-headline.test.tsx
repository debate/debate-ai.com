// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { ProfileProgramStrengthHeadline } from "../src/leaderboard/profile/ProfileProgramStrength";
import { click, flush, mount, type Mounted } from "./helpers/mount";

/** Waits for the strength table (bundled NDT, CEDA and top-100 data) to load and render. */
async function settle(container: HTMLElement) {
  for (let i = 0; i < 100 && !container.querySelector("section"); i++) {
    await flush(() => new Promise((resolve) => setTimeout(resolve, 20)));
  }
}

describe("ProfileProgramStrengthHeadline", () => {
  let mounted: Mounted | null = null;
  afterEach(async () => {
    await mounted?.unmount();
    mounted = null;
  });

  it("shows three rank cards whose list buttons open every program's ranking for that span", async () => {
    mounted = await mount(<ProfileProgramStrengthHeadline school="Georgetown University" />);
    await settle(mounted.container);
    const buttons = [...mounted.container.querySelectorAll<HTMLButtonElement>('button[aria-label^="Full ranking"]')];
    expect(buttons).toHaveLength(3);

    const allTimeCard = buttons[2].parentElement!;
    const [, ownRank, of] = allTimeCard.textContent!.match(/#(\d+) of (\d+)/)!;
    await click(buttons[2]);
    const dialog = mounted.container.querySelector("dialog")!;
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(dialog.textContent).toContain("Program strength: All time");
    expect(dialog.querySelectorAll("ol > li").length).toBe(Math.min(50, Number(of)));
    const own = dialog.querySelector("[data-own-school]")!;
    expect(own.textContent).toContain(`#${ownRank}`);
    expect(own.querySelector("a")!.getAttribute("href")).toBe("/@georgetown");

    const decadeTab = [...dialog.querySelectorAll('[role="tab"]')].find((tab) => tab.textContent === "Last decade")!;
    await click(decadeTab);
    expect(dialog.textContent).toContain("Program strength: Last decade");
  });
});
