// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DemoSection } from "../src/host/demo-edit";
import type { TournamentAdmin } from "../src/ui/client";
import { DemoMockEditor } from "../src/ui/pages/DemoMockEditor";
import { byText, click, clientWith, contextValue, render, text, type as typeInto, unmountAll } from "./helpers/dom";

const view: TournamentAdmin = {
  viewer: { username: "demo", name: "Demo Admin", mock: true },
  tourn: { id: 1, name: "Demo Open", webname: "demo", city: null, state: null, country: null, tz: "UTC", start: null, end: null, regStart: null, regEnd: null, hidden: false },
  events: [],
  schools: [],
  entries: [
    { id: 10, code: "Alpha AB", name: "A & B", eventAbbr: "VCX", schoolName: "Alpha HS", status: "active" },
    { id: 11, code: "Beta CD", name: "C & D", eventAbbr: "VCX", schoolName: "Beta HS", status: "waitlist" },
    { id: 12, code: null, name: null, eventAbbr: null, schoolName: null, status: "dropped" },
  ],
  judges: [
    { id: 20, code: "J1", name: "Sam Lee", first: "Sam", last: "Lee", schoolName: "Alpha HS", active: true },
    { id: 21, code: null, name: "Ann Yu", first: null, last: null, schoolName: null, active: false },
  ],
  rooms: [],
  rounds: [
    { id: 30, name: 1, label: null, type: "prelim", eventAbbr: "VCX", published: true, resultsPosted: false, sectionCount: 2, start: null },
    { id: 31, name: 2, label: "Quarters", type: "elim", eventAbbr: "VLD", published: false, resultsPosted: false, sectionCount: 0, start: null },
  ],
  resultSets: [{ id: 40, label: "Prelim seeds", eventAbbr: "VCX", published: false }, { id: 41, label: null, eventAbbr: null, published: true }],
};

const sections: DemoSection[] = [
  {
    id: 50,
    letter: "A",
    room: "101",
    bye: false,
    entries: [
      { id: 10, code: "Alpha AB", side: 1, wins: 2, scored: 3 },
      { id: 11, code: "Beta CD", side: 2, wins: 1, scored: 3 },
    ],
    judges: [{ id: 20, name: "Sam Lee", code: "J1" }],
  },
  { id: 51, letter: null, room: null, bye: true, entries: [{ id: 12, code: null, side: null, wins: 0, scored: 0 }], judges: [] },
];

function setup(opts: { sections?: DemoSection[]; failEdit?: boolean; failReset?: boolean } = {}) {
  const edits: unknown[] = [];
  let resets = 0;
  const onChanged = vi.fn();
  const client = clientWith((path, init) => {
    if (path.endsWith("/host/demo/edit")) {
      if (opts.failEdit) return new Response(JSON.stringify({ detail: "Edit refused" }), { status: 409 });
      edits.push(JSON.parse(String(init?.body)));
      return { ok: true };
    }
    if (path.endsWith("/host/demo/reset")) {
      if (opts.failReset) return new Response("{}", { status: 500 });
      resets++;
      return { tournId: 1, seeded: true };
    }
    if (/\/host\/demo\/rounds\/\d+\/sections/.test(path)) return { sections: opts.sections ?? sections };
    throw new Error(`unexpected ${path}`);
  });
  return { edits, onChanged, resets: () => resets, ctx: contextValue({ client }) };
}

const tab = (el: HTMLElement, label: string) => byText(el, "nav button", label)!;
const rowOf = (el: HTMLElement, title: RegExp) => [...el.querySelectorAll("div.flex-wrap.items-end")].find((r) => title.test(r.textContent ?? ""))!;
const saveButton = (row: Element) => byText(row, "button", "Save") as HTMLButtonElement;

afterEach(() => {
  unmountAll();
  vi.restoreAllMocks();
});

describe("DemoMockEditor", () => {
  it("saves only the entry fields that changed, and disables Save until something does", async () => {
    const { edits, onChanged, ctx } = setup();
    const el = await render(<DemoMockEditor view={view} onChanged={onChanged} />, ctx);
    const row = rowOf(el, /Alpha HS/);
    expect(saveButton(row).disabled).toBe(true);

    await typeInto(row.querySelector("input"), "Alpha XY");
    await typeInto(row.querySelector("select"), "dropped");
    expect(saveButton(row).disabled).toBe(false);
    await click(saveButton(row));

    expect(edits).toEqual([{ kind: "entry", id: 10, code: "Alpha XY", status: "dropped" }]);
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("undoes unsaved changes", async () => {
    const { edits, ctx } = setup();
    const el = await render(<DemoMockEditor view={view} onChanged={() => {}} />, ctx);
    const row = rowOf(el, /Alpha HS/);
    await typeInto(row.querySelector("input"), "Changed");
    await click(byText(row, "button", "Undo"));
    expect((row.querySelector("input") as HTMLInputElement).value).toBe("Alpha AB");
    expect(byText(row, "button", "Undo")).toBeNull();
    expect(edits).toEqual([]);
  });

  it("filters the list by any of the row's text", async () => {
    const { ctx } = setup();
    const el = await render(<DemoMockEditor view={view} onChanged={() => {}} />, ctx);
    expect(el.querySelectorAll('input[aria-label="Filter"]')).toHaveLength(1);
    await typeInto(el.querySelector('input[aria-label="Filter"]'), "beta");
    expect(text(el)).toContain("Beta HS");
    expect(text(el)).not.toContain("Alpha HS");
  });

  it("caps long lists and says how many are hidden", async () => {
    const many = { ...view, entries: Array.from({ length: 45 }, (_, i) => ({ id: 100 + i, code: `E${i}`, name: `N${i}`, eventAbbr: "VCX", schoolName: "S", status: "active" as const })) };
    const { ctx } = setup();
    const el = await render(<DemoMockEditor view={many} onChanged={() => {}} />, ctx);
    expect(text(el)).toContain("Showing 40 of 45. Filter to find the rest.");
    await typeInto(el.querySelector('input[aria-label="Filter"]'), "E44");
    expect(text(el)).not.toContain("Showing 40");
  });

  it("edits judges, including the active toggle", async () => {
    const { edits, ctx } = setup();
    const el = await render(<DemoMockEditor view={view} onChanged={() => {}} />, ctx);
    await click(tab(el, "Judges"));
    expect(text(el)).toContain("Hired");
    const row = rowOf(el, /Alpha HS/);
    await typeInto(row.querySelectorAll("input")[0], "Samuel");
    await click(row.querySelector('input[type="checkbox"]'));
    await click(saveButton(row));
    expect(edits).toEqual([{ kind: "judge", id: 20, first: "Samuel", active: false }]);
  });

  it("edits a round's label and publication flags", async () => {
    const { edits, ctx } = setup();
    const el = await render(<DemoMockEditor view={view} onChanged={() => {}} />, ctx);
    await click(tab(el, "Rounds"));
    const row = rowOf(el, /VLD/);
    expect((row.querySelector("input") as HTMLInputElement).placeholder).toBe("Round 2");
    const boxes = row.querySelectorAll('input[type="checkbox"]');
    await click(boxes[0]);
    await click(boxes[1]);
    await click(saveButton(row));
    expect(edits).toEqual([{ kind: "round", id: 31, published: true, resultsPosted: true }]);
  });

  it("edits result sets", async () => {
    const { edits, ctx } = setup();
    const el = await render(<DemoMockEditor view={view} onChanged={() => {}} />, ctx);
    await click(tab(el, "Result sets"));
    const row = rowOf(el, /VCX/);
    await typeInto(row.querySelector("input:not([type=checkbox])"), "Final seeds");
    await click(row.querySelector('input[type="checkbox"]'));
    await click(saveButton(row));
    expect(edits).toEqual([{ kind: "resultSet", id: 40, label: "Final seeds", published: true }]);
  });

  it("shows an empty message for each list with nothing in it", async () => {
    const { ctx } = setup();
    const empty = { ...view, entries: [], judges: [], rounds: [], resultSets: [] };
    const el = await render(<DemoMockEditor view={empty} onChanged={() => {}} />, ctx);
    expect(text(el)).toContain("No entries.");
    for (const [label, message] of [["Judges", "No judges."], ["Rounds", "No rounds."], ["Pairings", "No rounds."], ["Result sets", "No result sets."]]) {
      await click(tab(el, label));
      expect(text(el)).toContain(message);
    }
  });

  it("loads a round's sections, names the winner, and reassigns a judge", async () => {
    const { edits, ctx } = setup();
    const el = await render(<DemoMockEditor view={view} onChanged={() => {}} />, ctx);
    await click(tab(el, "Pairings"));
    expect(text(el)).toContain("Section A");
    expect(text(el)).toContain("101");
    expect(text(el)).toContain("Aff Alpha AB · won");
    expect(text(el)).toContain("Neg Beta CD");
    expect(text(el)).toContain("Section 51");
    expect(text(el)).toContain("Bye");

    const selects = () => [...el.querySelectorAll("select")].filter((s) => /Judge|Winner/.test(s.closest("div.space-y-1")?.textContent ?? ""));
    const judgeSelect = selects()[0];
    expect(judgeSelect.value).toBe("20");
    expect([...judgeSelect.options].map((o) => o.textContent)).toEqual(["J1 Sam Lee", "Ann Yu"]);
    await typeInto(judgeSelect, "21");
    expect(edits.at(-1)).toEqual({ kind: "section", id: 50, fromJudgeId: 20, judgeId: 21 });

    // Each save reloads the sections, so the controls are looked up again.
    await typeInto(selects()[1], "11");
    expect(edits.at(-1)).toEqual({ kind: "section", id: 50, winnerEntryId: 11 });
    await typeInto(selects()[1], "");
    expect(edits).toHaveLength(2);
  });

  it("switches round and reports an empty round", async () => {
    const { ctx } = setup({ sections: [] });
    const el = await render(<DemoMockEditor view={view} onChanged={() => {}} />, ctx);
    await click(tab(el, "Pairings"));
    expect(text(el)).toContain("No sections in this round.");
    const select = el.querySelector("select")!;
    expect([...select.options].map((o) => o.textContent)).toEqual(["VCX · Round 1", "VLD · Quarters"]);
    await typeInto(select, "31");
    expect(select.value).toBe("31");
  });

  it("shows the server's message when a save is refused, and stays on the row", async () => {
    const { ctx, onChanged } = setup({ failEdit: true });
    const el = await render(<DemoMockEditor view={view} onChanged={onChanged} />, ctx);
    const row = rowOf(el, /Alpha HS/);
    await typeInto(row.querySelector("input"), "Nope");
    await click(saveButton(row));
    expect(el.querySelector('[role="alert"]')?.textContent).toBe("Edit refused");
    expect(onChanged).not.toHaveBeenCalled();
    expect(saveButton(rowOf(el, /Alpha HS/)).disabled).toBe(false);
  });

  it("resets the demo only after the user confirms", async () => {
    const { ctx, onChanged, resets } = setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const el = await render(<DemoMockEditor view={view} onChanged={onChanged} />, ctx);
    await click(byText(el, "button", /Reset demo data/));
    expect(resets()).toBe(0);
    await click(byText(el, "button", /Reset demo data/));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(resets()).toBe(1);
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("reports a failed reset", async () => {
    const { ctx } = setup({ failReset: true });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const el = await render(<DemoMockEditor view={view} onChanged={() => {}} />, ctx);
    await click(byText(el, "button", /Reset demo data/));
    expect(el.querySelector('[role="alert"]')?.textContent).toContain("Request failed (500)");
    expect(byText(el, "button", /Reset demo data/)).not.toBeNull();
  });
});
