// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { CHAMPIONSHIP_IDS, DEBATE_MAJORS } from "../src/ui/majors/data";
import { DebateMajorsCalendar } from "../src/ui/majors";
import { click, render, text, type as typeInto, unmountAll } from "./helpers/dom";

const weeks = (el: HTMLElement) => [...el.querySelectorAll("main > div.grid > section")] as HTMLElement[];
const weekTitle = (week: Element) => week.querySelector("h2")!.textContent;
const squares = (root: ParentNode) => [...root.querySelectorAll("button[data-id]")] as HTMLElement[];
const pendingStrip = (el: HTMLElement) => [...el.querySelectorAll("main > section")].find((s) => s.textContent?.includes("Estimated planning windows"))!;
const weekOfMajor = (el: HTMLElement, name: string) => weeks(el).find((w) => squares(w).some((b) => b.textContent?.includes(name)));

afterEach(() => {
  unmountAll();
  vi.useRealTimers();
  document.body.style.overflow = "";
});

describe("DebateMajorsCalendar", () => {
  it("lays the season out as weeks A to Y plus a Z championship week", async () => {
    const el = await render(<DebateMajorsCalendar />, null);
    const titles = weeks(el).map(weekTitle);
    expect(titles).toHaveLength(26);
    expect(titles[0]).toBe("A");
    expect(titles[24]).toBe("Y");
    expect(titles[25]).toBe("Z · Championships");
    expect(text(el)).toContain("September 2026 – June 2027");
  });

  it("uses a custom caption when given one", async () => {
    const el = await render(<DebateMajorsCalendar caption="My season" />, null);
    expect(text(el)).toContain("My season");
    expect(text(el)).not.toContain("Weeks A–Y");
  });

  it("puts every championship in week Z and a dated major in the week it mostly overlaps", async () => {
    const el = await render(<DebateMajorsCalendar />, null);
    const z = weeks(el)[25];
    for (const id of CHAMPIONSHIP_IDS) expect(squares(z).some((b) => b.dataset.id === String(id))).toBe(true);
    // Sep 16–21, 2026 spans Wed–Mon; its best week is Sep 14–20 (C).
    expect(weekTitle(weekOfMajor(el, "Greenhill Fall Classic")!)).toBe("C");
  });

  it("lists undated non-championships in the planning strip with their note, not in a week", async () => {
    const el = await render(<DebateMajorsCalendar />, null);
    const strip = pendingStrip(el);
    expect(squares(strip).map((b) => b.querySelector(".font-semibold")?.textContent)).toEqual(["MBA Southern Bell"]);
    expect(strip.textContent).toContain("Early January 2027; exact dates unresolved.");
    expect(weekOfMajor(el, "MBA Southern Bell")).toBeUndefined();
  });

  it("filters by circuit", async () => {
    const el = await render(<DebateMajorsCalendar />, null);
    const all = squares(el).length;
    await click(el.querySelector('[data-filter="NDT"]'));
    expect(el.querySelector('[data-filter="NDT"]')!.getAttribute("aria-pressed")).toBe("true");
    const shown = squares(el).map((b) => b.querySelector(".font-semibold")!.textContent);
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.length).toBeLessThan(all);
    expect(shown).toContain("Owen L. Coon Memorial");
    expect(shown).not.toContain("Yale Invitational");
    expect(text(el)).toContain("No matching events");
    expect(text(pendingStrip(el))).toContain("No matching estimated windows.");
  });

  it("filters by date status and by search text", async () => {
    const el = await render(<DebateMajorsCalendar />, null);
    await typeInto(el.querySelector('select[aria-label="Date status"]'), "provisional");
    const provisional = DEBATE_MAJORS.filter((m) => m.status === "provisional").length;
    expect(squares(el)).toHaveLength(provisional);

    await typeInto(el.querySelector('select[aria-label="Date status"]'), "all");
    await typeInto(el.querySelector('input[aria-label="Search tournament"]'), "glenbrooks");
    expect(squares(el).map((b) => b.dataset.id)).toEqual(["10"]);
    // The note is searched too.
    await typeInto(el.querySelector('input[aria-label="Search tournament"]'), "Phoenix");
    expect(squares(el).map((b) => b.dataset.id)).toEqual(["1"]);
    await typeInto(el.querySelector('input[aria-label="Search tournament"]'), "zzz-nothing");
    expect(squares(el)).toHaveLength(0);
  });

  it("flags rows whose dates conflict, and marks status on each square", async () => {
    const el = await render(<DebateMajorsCalendar />, null);
    const harvard = squares(el).find((b) => b.dataset.id === "14")!;
    expect(harvard.textContent).toContain("⚠ Conflict");
    expect(harvard.textContent).toContain("published");
    const edie = squares(el).find((b) => b.dataset.id === "16")!;
    expect(edie.textContent).toContain("provisional");
    expect(edie.className).toContain("border-dashed");
  });

  it("highlights only the current week, once mounted on the client", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-24T12:00:00") });
    const el = await render(<DebateMajorsCalendar />, null);
    const current = weeks(el).filter((w) => w.className.includes("bg-primary/5"));
    expect(current).toHaveLength(1);
    // Nov 23–29, 2026.
    expect(current[0].textContent).toContain("Nov 23, 2026 – Nov 29, 2026");
  });

  it("highlights no week outside the season", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-06-01T12:00:00") });
    const el = await render(<DebateMajorsCalendar />, null);
    expect(weeks(el).filter((w) => w.className.includes("bg-primary/5"))).toHaveLength(0);
  });

  it("opens a detail dialog that closes by button, backdrop or Escape, and locks page scroll meanwhile", async () => {
    const el = await render(<DebateMajorsCalendar />, null);
    const dialog = () => document.querySelector('section[aria-label="Tournament details"]');
    expect(dialog()).toBeNull();

    await click(squares(el).find((b) => b.dataset.id === "10")!);
    expect(dialog()?.textContent).toContain("Glenbrooks");
    expect(dialog()?.textContent).toContain("LD / PF / CX");
    expect(dialog()?.textContent).toContain("Nov 21, 2026 through Nov 23, 2026");
    expect(dialog()?.textContent).toContain("Shown in L");
    expect(dialog()?.querySelector("a")?.getAttribute("href")).toBe("https://ci.uky.edu/debate/toc/bids/bid-tournaments");
    expect(document.body.style.overflow).toBe("hidden");

    await click(dialog()!.querySelector('[aria-label="Close details"]'));
    expect(dialog()).toBeNull();
    expect(document.body.style.overflow).toBe("");

    await click(squares(el)[0]);
    await click(dialog()!.firstElementChild);
    expect(dialog()).not.toBeNull();
    await click(dialog());
    expect(dialog()).toBeNull();

    await click(squares(el)[0]);
    const { act } = await import("react");
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    });
    expect(dialog()).not.toBeNull();
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(dialog()).toBeNull();
  });

  it("describes a championship and an undated event in the dialog", async () => {
    const el = await render(<DebateMajorsCalendar />, null);
    const dialog = () => document.querySelector('section[aria-label="Tournament details"]')!;
    await click(squares(el).find((b) => b.dataset.id === "0")!);
    expect(dialog().textContent).toContain("Shown in Z · Championships");
    await click(dialog().querySelector('[aria-label="Close details"]'));

    await click(squares(pendingStrip(el)).at(0)!);
    expect(dialog().textContent).toContain("Exact dates unresolved");
    expect(dialog().textContent).not.toContain("Shown in");
  });
});
