// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { PublishedRound, RoundSchematic } from "../src/ui/client";
import { ElimBracket } from "../src/ui/pages/ElimBracket";
import { buildBracket } from "../src/ui/bracket";
import { BracketCard, MatchupDetails } from "../src/ui/pages/ElimBracket";
import elims from "./fixtures/ucla-2026-opld-elims.json";
import { byText, click, clientWith, contextValue, render, settle, text, unmountAll } from "./helpers/dom";

const schematics = elims as unknown as RoundSchematic[];

const published: PublishedRound[] = [
  { id: 1, type: "prelim", name: 1, label: null, Event: { id: 384229, name: "Lincoln Douglas (Open)", abbr: "OPLD", type: "debate" } },
  ...schematics.map((r, i): PublishedRound => ({ id: r.id, type: i === 3 ? "final" : "elim", name: r.name, label: r.label, Event: r.Event })),
  { id: 99, type: "elim", name: 7, label: null, Event: { id: 5, name: "Other", abbr: "OTH", type: "debate" } },
];

beforeAll(() => {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= RO;
});
afterEach(unmountAll);

const section = (el: HTMLElement, label: string) => el.querySelector(`section[aria-label="${label}"]`) as HTMLElement;
const matchups = (root: ParentNode) => [...root.querySelectorAll("[data-matchup]")] as HTMLElement[];

describe("ElimBracket", () => {
  it("loads every published elim round of the event and draws one column each", async () => {
    const requested: string[] = [];
    const client = clientWith((path) => {
      requested.push(path);
      const match = /\/pages\/invite\/40372\/OPLD\/(\d+)$/.exec(path);
      return schematics.find((r) => String(r.name) === match?.[1]);
    });
    const el = await render(<ElimBracket tournId={40372} eventAbbr="OPLD" currentRound={8} rounds={published} />, contextValue({ client }));
    await settle();

    expect([...requested].sort()).toEqual([10, 7, 8, 9].map((n) => `/api/tabroom/pages/invite/40372/OPLD/${n}`));
    expect(text(el)).toContain("Lincoln Douglas (Open) — Elimination bracket");
    expect(["Octas", "Quarters", "Semis", "Final"].map((label) => section(el, label).querySelectorAll("[data-matchup]").length)).toEqual([8, 4, 2, 1]);
    expect(section(el, "Quarters").querySelector("button")?.className).toContain("text-primary");
    expect(section(el, "Octas").querySelector("button")?.className).not.toContain("text-primary");
  });

  it("renders nothing for an event without elimination rounds", async () => {
    const client = clientWith(() => {
      throw new Error("should not load");
    });
    const el = await render(<ElimBracket tournId={1} eventAbbr="NOPE" rounds={published} />, contextValue({ client }));
    expect(el.innerHTML).toBe("");
  });

  it("leaves out a round that fails to load, and draws the rest", async () => {
    const client = clientWith((path) => {
      const match = /\/OPLD\/(\d+)$/.exec(path);
      const found = schematics.find((r) => String(r.name) === match?.[1]);
      return found && found.name !== 8 ? found : new Response("{}", { status: 500 });
    });
    const el = await render(<ElimBracket tournId={40372} eventAbbr="OPLD" rounds={published} />, contextValue({ client }));
    await settle();
    expect(section(el, "Quarters")).toBeNull();
    expect(section(el, "Octas")).not.toBeNull();
  });

  it("renders nothing when no elim round could be loaded", async () => {
    const client = clientWith(() => new Response("{}", { status: 500 }));
    const el = await render(<ElimBracket tournId={40372} eventAbbr="OPLD" rounds={published} />, contextValue({ client }));
    await settle();
    expect(el.querySelector("[data-elim-bracket]")).toBeNull();
  });
});

describe("BracketCard", () => {
  const columns = buildBracket(schematics);
  const card = (props: Partial<Parameters<typeof BracketCard>[0]> = {}) => (
    <BracketCard columns={columns} eventName="Lincoln Douglas (Open)" eventType="debate" eventAbbr="OPLD" tournId={40372} {...props} />
  );

  it("collapses and re-expands a single round", async () => {
    const el = await render(card());
    await click(section(el, "Quarters").querySelector("button"));
    const collapsed = section(el, "Quarters");
    expect(collapsed.querySelectorAll("[data-matchup]")).toHaveLength(0);
    expect(collapsed.querySelector("button")?.getAttribute("aria-expanded")).toBe("false");
    expect(collapsed.textContent).toContain("Quarters · 4");
    expect(collapsed.querySelector("button")?.getAttribute("title")).toBe("Show Quarters");

    await click(collapsed.querySelector("button"));
    expect(section(el, "Quarters").querySelectorAll("[data-matchup]")).toHaveLength(4);
  });

  it("collapses and expands every round at once", async () => {
    const el = await render(card());
    await click(byText(el, "button", "Collapse rounds"));
    expect(matchups(el)).toHaveLength(0);
    await click(byText(el, "button", "Expand rounds"));
    expect(matchups(el)).toHaveLength(15);
  });

  it("shrinks the bracket to the first round still shown", async () => {
    const el = await render(card());
    const height = () => (section(el, "Final").querySelector("[style]") as HTMLElement).style.height;
    expect(height()).toBe("736px");
    await click(section(el, "Octas").querySelector("button"));
    expect(matchups(el)).toHaveLength(7);
    expect(height()).toBe("368px");
  });

  it("hides the card body from its title, and the collapse-all control with it", async () => {
    const el = await render(card());
    await click(byText(el, "button", /Elimination bracket/));
    expect(matchups(el)).toHaveLength(0);
    expect(byText(el, "button", "Collapse rounds")).toBeNull();
  });

  it("offers no collapse-all for a single round", async () => {
    const el = await render(card({ columns: columns.slice(3) }));
    expect(byText(el, "button", "Collapse rounds")).toBeNull();
  });

  it("uses plain codes instead of entry labels for a speech event", async () => {
    const el = await render(card({ eventType: "speech" }));
    const first = matchups(el)[0];
    expect(first.textContent).toBe("Acton-Boxborough AN0Emerald AK3");
    expect(first.querySelectorAll("[data-winner]")).toHaveLength(1);
  });

  it("marks winners and fades losers", async () => {
    const el = await render(card());
    const final = matchups(el).at(-1)!;
    expect(final.querySelectorAll("[data-winner]")).toHaveLength(1);
    expect(final.querySelector("[data-winner]")?.textContent).toContain("Narayanan");
    expect(final.querySelector('[aria-label="Advanced"]')).not.toBeNull();
    expect(final.querySelector("div:not([data-winner]).opacity-55")).not.toBeNull();
  });
});

describe("matchup details", () => {
  const columns = buildBracket(schematics);
  const open = async (index: number, key?: string) => {
    const el = await render(<BracketCard columns={columns} eventName="LD" eventType="debate" eventAbbr="OPLD" tournId={40372} />);
    const target = matchups(el)[index];
    if (key) {
      await act(async () => {
        target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
      });
    } else await click(target);
    await settle();
    return { el, target };
  };
  const details = () => (document.querySelector("[data-decision]")?.closest(".text-sm") ?? null) as HTMLElement | null;

  it("opens a matchup's decision, ballots and round link on click", async () => {
    const { target } = await open(0);
    expect(target.getAttribute("aria-label")).toMatch(/^Octas: /);
    const card = details()!;
    expect(card).not.toBeNull();
    expect(card.querySelector("[data-decision]")?.textContent).toMatch(/won \d–\d on the (Aff|Neg)|advanced/);
    expect(card.textContent).toContain("Octas pairings");
    expect(card.querySelector("a")?.getAttribute("href")).toBe("/tournament/40372/rounds/OPLD/7");
    expect(card.querySelectorAll("ul li").length).toBeGreaterThan(0);
  });

  it("opens from the keyboard with Enter or Space, and ignores other keys", async () => {
    await open(0, "Enter");
    expect(details()).not.toBeNull();
    unmountAll();
    await open(0, "x");
    expect(details()).toBeNull();
    unmountAll();
    await open(1, " ");
    expect(details()).not.toBeNull();
  });

  it("closes on Escape", async () => {
    await open(0);
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    await settle(200);
    expect(details()).toBeNull();
  });
});

describe("MatchupDetails", () => {
  const columns = buildBracket(schematics);
  const column = columns[0];
  const ctx = { tournId: 40372, eventAbbr: "OPLD", eventName: "LD", eventType: "debate" } as const;
  const base = column.slots.find((slot) => slot?.decidedBy === "ballots")!;

  it("reports the score, the winner's side and each judge's vote", async () => {
    const el = await render(<MatchupDetails matchup={base} column={column} ctx={ctx} />);
    const winner = base.entries.find((e) => e.id === base.winnerId)!;
    expect(text(el)).toContain(`${winner.code} won`);
    expect(text(el)).toContain(`on the ${winner.side === "aff" ? "Aff" : "Neg"}`);
    expect(text(el)).toContain("Section 1".replace("1", base.letter ?? "1"));
    expect([...el.querySelectorAll("li")].every((li) => /Voted/.test(li.textContent ?? ""))).toBe(true);
  });

  it("says an advancing matchup had no ballots, and lists the judges posted", async () => {
    const advanced = column.slots.find((slot) => slot?.decidedBy === "advanced")!;
    const el = await render(<MatchupDetails matchup={advanced} column={column} ctx={ctx} />);
    expect(text(el)).toMatch(/advanced \(no ballots posted\)/);
    expect(text(el)).not.toContain("Voted");
  });

  it("explains a bye, an undecided round, points, chairs and missing judges", async () => {
    const [a, b] = base.entries;
    const judge = { first: "Pat", last: "Lee", chair: 1 };
    const bye = { ...base, decidedBy: "advanced" as const, bye: true, ballots: [], judges: [judge], room: "12" };
    let el = await render(<MatchupDetails matchup={bye} column={column} ctx={ctx} />);
    expect(text(el)).toContain(`${base.entries.find((e) => e.id === base.winnerId)!.code} advanced on a bye`);
    expect(text(el)).toContain("Room 12");
    expect(text(el)).toContain("Chair");

    const undecided = { ...base, winnerId: null, decidedBy: null, ballots: [], judges: [], letter: null, room: null } as unknown as typeof base;
    el = await render(<MatchupDetails matchup={undecided} column={column} ctx={ctx} />);
    expect(text(el)).toContain("Decision not posted yet");
    expect(text(el)).toContain("No judges posted.");
    expect(text(el)).not.toContain("· Section");

    const scored = {
      ...base,
      ballots: [
        { judge, winnerId: a.id, points: new Map([[a.id, 28.5], [b.id, 27]]) },
        { judge: { first: "Sam", last: "Ng" }, winnerId: null, points: new Map<number, number>() },
      ],
    };
    el = await render(<MatchupDetails matchup={scored} column={column} ctx={ctx} />);
    expect(text(el)).toContain("No decision posted");
    expect(text(el)).toMatch(/(Aff|Neg) 28\.5, (Aff|Neg) 27/);
    expect(text(el)).toContain("Chair");
  });
});
