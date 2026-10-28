// @vitest-environment jsdom
/**
 * @fileoverview Mounts the past-season college policy table over the real
 * scraped CSV: the 2025-26 season's stats, tournaments and source link, and
 * the win-probability calculator.
 */

import { afterEach, describe, expect, it } from "vitest";
import { flush, mount, type, type Mounted } from "./helpers/mount";
import { CollegeHistoryTable } from "../src/leaderboard/CollegeHistoryTable";

let view: Mounted | null = null;

afterEach(async () => {
  await view?.unmount();
  view = null;
});

/** Mounts season `year` and waits for its CSV chunk to load. */
async function mountSeason(year: string): Promise<HTMLElement> {
  view = await mount(<CollegeHistoryTable year={year} query="" />);
  for (let i = 0; i < 50 && view.container.textContent?.includes("Loading rankings"); i++) {
    await flush(() => new Promise((r) => setTimeout(r, 10)));
  }
  return view.container;
}

/** Changes a native select the way React listens for it. */
async function choose(select: HTMLSelectElement, value: string): Promise<void> {
  await flush(() => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("CollegeHistoryTable", () => {
  it("shows 2025-26 with its season stats, tournaments and home-page source", async () => {
    const el = await mountSeason("2026");
    expect(el.querySelectorAll("tbody tr")).toHaveLength(100);
    expect(el.querySelector("tbody tr")?.textContent).toContain("Gallagher & Song");
    expect(el.querySelector('a[href="https://debatedata.weebly.com/"]')).not.toBeNull();

    const stats = el.querySelector('section[aria-label="2025-26 season stats"]')!;
    expect(stats.querySelectorAll("h4")).toHaveLength(1);
    expect(stats.textContent).toContain("All divisions");
    expect(stats.textContent).toContain("5671");
    expect(stats.textContent).toContain("40.5%");
    expect(stats.textContent).not.toContain("Junior Varsity");
    expect(stats.textContent).not.toContain("Novice");
    expect(el.textContent).toContain("Rated from 27 tournaments: ASU, Bing");
  });

  it("leaves stats out of seasons without them", async () => {
    const el = await mountSeason("2025");
    expect(el.querySelector('section[aria-label$="season stats"]')).toBeNull();
    expect(el.textContent).not.toContain("Rated from");
    expect(el.querySelector('a[href="https://debatedata.weebly.com/2024-25.html"]')).not.toBeNull();
  });

  it("works out the aff's chances from the picked teams or typed numbers", async () => {
    const el = await mountSeason("2026");
    const calc = el.querySelector('section[aria-labelledby="college-win-calc"]')!;
    // #1 (mu 47.17) aff against #2 (mu 45.76) neg.
    expect(calc.textContent).toContain("Aff 59%");
    expect(calc.textContent).toContain("Neg 41%");

    await choose(calc.querySelector<HTMLSelectElement>('select[aria-label="Aff team"]')!, "100");
    expect(calc.querySelector<HTMLInputElement>('input[aria-label="Aff mu"]')!.value).toBe("23.21");
    expect(calc.textContent).toContain("Aff 0%");

    const negMu = calc.querySelector<HTMLInputElement>('input[aria-label="Neg mu"]')!;
    await type(negMu, "23.21");
    await type(calc.querySelector<HTMLInputElement>('input[aria-label="Neg sigma"]')!, "1.47");
    expect(calc.querySelector<HTMLSelectElement>('select[aria-label="Neg team"]')!.value).toBe("");
    expect(calc.textContent).toContain("Aff 50%");

    await type(negMu, "");
    expect(calc.textContent).toContain("Enter a Mu and a non-negative Sigma");
  });
});
