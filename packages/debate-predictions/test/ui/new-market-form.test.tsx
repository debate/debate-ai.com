// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `NewMarketForm`: typed-in debate and
 * tournament markets, hosted Tabroom rounds and events, rating markets
 * picked from the rankings, server errors, and cancel.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NewMarketForm } from "../../src/ui/NewMarketForm";
import { bodyText, button, change, cleanup, click, flush, mount, submit } from "../helpers/dom";

const api = vi.hoisted(() => ({ createMarket: vi.fn(), fetchSources: vi.fn(), loadDataset: vi.fn() }));
vi.mock("../../src/client", () => ({
  createMarket: api.createMarket,
  fetchPredictionSources: api.fetchSources,
}));
vi.mock("@debate-ai/rankings", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  loadRankingDataset: api.loadDataset,
}));

const EVENTS = [{ id: 11, tournament: "Harvard", event: "Varsity PF", start: null, end: null }];
const PANEL = { id: 5, label: "Octas: Falk vs Chan", entries: [{ id: 1, label: "Falk" }, { id: 2, label: "Chan" }] };
const TEAM = { hash: "abc", rank: 1, name: "Falk & Sabnani", school: "Strake", rating: 90.25 };

const form = () => document.querySelector("form") as HTMLFormElement;
const selects = () => Array.from(document.querySelectorAll("select"));
const input = (placeholder: string) => document.querySelector(`[placeholder^="${placeholder}"]`) as HTMLInputElement;
const radio = (label: string) =>
  Array.from(document.querySelectorAll("label")).find((el) => el.textContent?.includes(label))!.querySelector("input")!;

let onCreated: ReturnType<typeof vi.fn<() => void>>;
let onCancel: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  onCreated = vi.fn<() => void>();
  onCancel = vi.fn<() => void>();
  api.createMarket.mockReset().mockResolvedValue({});
  api.fetchSources.mockReset().mockImplementation(async (eventId: number | null) =>
    eventId ? { events: EVENTS, panels: [PANEL], entries: PANEL.entries } : { events: EVENTS },
  );
  api.loadDataset.mockReset().mockResolvedValue({ entries: [TEAM, { ...TEAM, hash: "def", rank: 2, name: "Chan & Chhabra", school: "Dougherty" }] });
  mount(<NewMarketForm onCreated={onCreated} onCancel={onCancel} />);
});

afterEach(cleanup);

describe("NewMarketForm", () => {
  it("opens a typed-in debate market", async () => {
    change(input("e.g. Aff"), "Aff — Falk");
    change(input("e.g. Neg"), "Neg — Chan");
    change(input("Who wins the TOC"), "Who wins octas?");
    submit(form());
    await flush();
    expect(api.createMarket).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "debate", title: "Who wins octas?", outcomes: ["Aff — Falk", "Neg — Chan"] }),
    );
    expect(api.createMarket.mock.calls[0][0].closesAt).toBeGreaterThan(Date.now() / 1000);
    expect(onCreated).toHaveBeenCalled();
  });

  it("opens a typed-in tournament market and shows a server error", async () => {
    change(selects()[0], "tournament");
    change(document.querySelector("textarea") as HTMLTextAreaElement, "Strake\nDougherty");
    change(input("Who wins the Harvard"), "Who wins Harvard?");
    api.createMarket.mockRejectedValueOnce(new Error("Too many open markets"));
    submit(form());
    await flush();
    expect(api.createMarket).toHaveBeenCalledWith(expect.objectContaining({ kind: "tournament", outcomes: ["Strake", "Dougherty"] }));
    expect(document.querySelector('[role="alert"]')?.textContent).toBe("Too many open markets");
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("backs a debate market with a hosted Tabroom round", async () => {
    click(radio("From a tournament hosted here"));
    await flush();
    expect(bodyText()).toContain("Pick an event…");
    expect(bodyText()).toContain("Pick an event first");

    change(selects()[1], "11");
    await flush();
    expect(api.fetchSources).toHaveBeenLastCalledWith(11);
    change(selects()[2], "5");
    expect(bodyText()).toContain("Outcomes: Falk or Chan");
    expect((input("Who wins the TOC") as HTMLInputElement).value).toBe("Who wins Octas: Falk vs Chan?");

    submit(form());
    await flush();
    expect(api.createMarket).toHaveBeenCalledWith(expect.objectContaining({ tabroomPanelId: 5 }));
  });

  it("backs a tournament market with a hosted event's entries", async () => {
    change(selects()[0], "tournament");
    click(radio("From a tournament hosted here"));
    await flush();
    change(selects()[1], "11");
    await flush();
    expect(bodyText()).toContain("2 entries become the outcomes.");
    change(input("Who wins the Harvard"), "Harvard PF?");
    submit(form());
    await flush();
    expect(api.createMarket).toHaveBeenCalledWith(expect.objectContaining({ kind: "tournament", tabroomEventId: 11 }));
  });

  it("reports hosted sources that fail to load", async () => {
    api.fetchSources.mockRejectedValueOnce(new Error("Tabroom is down"));
    click(radio("From a tournament hosted here"));
    await flush();
    expect(bodyText()).toContain("Tabroom is down");
  });

  it("opens a rating market for a ranked team, titling it from the team", async () => {
    change(selects()[0], "rating");
    await flush();
    expect(api.loadDataset).toHaveBeenCalledWith("hspf");
    expect(bodyText()).toContain("Pick a team…");

    change(input("Name or school"), "dough");
    const teamSelect = selects()[2];
    expect(Array.from(teamSelect.options).map((option) => option.textContent)).toEqual([
      "Pick a team…",
      "#2 Chan & Chhabra — Dougherty (rating 90.3)",
    ]);
    change(teamSelect, "def");
    submit(form());
    await flush();
    expect(api.createMarket).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "rating",
        title: "Will Chan & Chhabra (Dougherty) gain rating?",
        rating: { dataset: "hspf", hash: "def" },
      }),
    );
  });

  it("reports rankings that fail to load, and cancels", async () => {
    api.loadDataset.mockRejectedValueOnce(new Error("offline"));
    change(selects()[0], "rating");
    await flush();
    expect(bodyText()).toContain("Could not load the rankings.");
    click(button("Cancel"));
    expect(onCancel).toHaveBeenCalled();
  });
});
