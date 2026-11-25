// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { ProfileNationalsHistory } from "../src/leaderboard/profile/ProfileNationalsHistory";
import { mount, type Mounted } from "./helpers/mount";

describe("ProfileNationalsHistory", () => {
  let mounted: Mounted | null = null;
  afterEach(async () => {
    await mounted?.unmount();
    mounted = null;
  });

  it("lists a school's NDCA titles and elim finishes by year, without speaker places", async () => {
    mounted = await mount(<ProfileNationalsHistory school="Glenbrook North High School (IL)" />);
    const text = mounted.container.textContent ?? "";
    expect(text).toContain("TOC, NDCA & Glenbrooks nationals");
    expect(text).toContain("Quarterfinalist");
    expect(text).toContain("Matt Fisher & Stephanie Spies");
    // Speaker places below first only score points; they aren't listed.
    expect(text).not.toContain("5th speaker");
    expect(text).not.toContain("Speaker places");
  });

  it("tags Lincoln-Douglas and Public Forum results with their event", async () => {
    mounted = await mount(<ProfileNationalsHistory school="The Harker School (CA)" />);
    const text = mounted.container.textContent ?? "";
    expect(text).toContain("LD");
    expect(text).toContain("Ansh Sheth");
    expect(text).toContain("Pranav Reddy");

    await mounted.unmount();
    mounted = await mount(<ProfileNationalsHistory school="Durham Academy (NC)" />);
    const durham = mounted.container.textContent ?? "";
    expect(durham).toContain("PF");
    expect(durham).toContain("Teddy Wallen & Ani Sukhija");
    expect(durham).not.toContain("Pranav Reddy");
  });

  it("merges TOC, NDCA and Barkley finishes into one list, newest year first", async () => {
    mounted = await mount(<ProfileNationalsHistory school="St. Mark's School of Texas (TX)" />);
    const text = mounted.container.textContent ?? "";
    expect(text.match(/TOC, NDCA, Barkley & Glenbrooks nationals/g)).toHaveLength(1);
    expect(text).toContain("1 TOC title");
    expect(text).toContain("2 NDCA titles");
    expect(text).not.toContain("0 NDCA top speakers");
    const items = [...mounted.container.querySelectorAll("li")].map((li) => li.textContent ?? "");
    const years = items.map((t) => Number(t.slice(0, 4)));
    expect(years).toEqual([...years].sort((a, b) => b - a));
    expect(items.find((t) => t.includes("Ansh Khullar"))).toMatch(/^2016NDCA/);
    // 2017 NDCA semis: team code WW was Wilson & Wang (St. Mark's), not a "WW" school.
    expect(items.find((t) => t.includes("Harris Wilson") && t.includes("Max Wang"))).toMatch(/^2017NDCA/);
    expect(text).not.toContain("WW (Harris Wilson and partner)");
    expect(items.find((t) => t.includes("Steven Sklaver"))).toMatch(/^1989TOC/);
    expect(items.find((t) => t.includes("Alex Gulakov") && t.includes("Barkley"))).toMatch(/^2009Barkley/);
    // No source subtitle: the sources are named in the docs, not on the page.
    expect(mounted.container.querySelectorAll("a")).toHaveLength(0);
  });

  it("lists Glenbrooks finishes and marks the probable ones", async () => {
    mounted = await mount(<ProfileNationalsHistory school="Glenbrook North High School (IL)" />);
    const items = [...mounted.container.querySelectorAll("li")].map((li) => li.textContent ?? "");
    expect(items.find((t) => t.includes("Debbie Loevy"))).toMatch(/^1987Glenbrooks.*Champion/);
    expect(items.find((t) => t.startsWith("2025Glenbrooks"))).toMatch(/Ethan Camp & Joe Rozenblatprobable$/);
    expect(items.find((t) => t.includes("Debbie Loevy"))).not.toContain("probable");
    expect(mounted.container.textContent).toContain("2 Glenbrooks titles");
  });

  it("keeps Harvard-Westlake's results off a Harvard page", async () => {
    mounted = await mount(<ProfileNationalsHistory school="Harvard-Westlake School (CA)" />);
    expect(mounted.container.textContent).toContain("Vishan Chaudhary");
    await mounted.unmount();
    mounted = await mount(<ProfileNationalsHistory school="Harvard" />);
    expect(mounted.container.textContent ?? "").not.toContain("Vishan Chaudhary");
  });

  it("renders nothing for a school with no TOC or NDCA result", async () => {
    mounted = await mount(<ProfileNationalsHistory school="Nowhere High School" />);
    expect(mounted.container.textContent).toBe("");
  });
});
