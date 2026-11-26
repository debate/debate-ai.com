/** @vitest-environment jsdom */
/**
 * @fileoverview The round-prediction card on the watch page: finding the
 * round's market on the board, the implied odds shown for each side, betting,
 * and opening a new market, for signed-in and signed-out viewers.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { click, flush, mount, type, type Mounted } from "./helpers/mount";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const predictions = vi.hoisted(() => ({
  fetchPredictionBoard: vi.fn(),
  createMarket: vi.fn(),
  placeBet: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: unknown }) => <a href={href}>{children as never}</a>,
}));
vi.mock("@debate-ai/predictions/client", () => predictions);

import { WatchRoundPrediction } from "../src/components/videos/watch/WatchRoundPrediction";
import type { VideoType } from "../src/types/videos";

const video = [
  "vid1",
  "Finals: Alpha AB vs Beta CD",
  "2026-01-01",
  "Channel",
  100,
  "",
  "VLD",
  "Tournament",
  "Varsity",
  "Alpha AB",
  "Beta CD",
] as unknown as VideoType;

function market(overrides: Record<string, unknown> = {}) {
  return {
    id: "m1",
    kind: "debate",
    title: "Who wins Finals: Alpha AB vs Beta CD?",
    status: "open",
    closesAt: Math.floor(new Date(2030, 0, 15, 12).getTime() / 1000),
    outcomes: [
      { id: "o-aff", label: "Affirmative wins — Alpha AB" },
      { id: "o-neg", label: "Negative wins — Beta CD" },
    ],
    positions: [
      { outcomeId: "o-aff", shares: 30, staked: 10 },
      { outcomeId: "o-neg", shares: 10, staked: 5 },
    ],
    ...overrides,
  };
}

function board(...markets: unknown[]) {
  predictions.fetchPredictionBoard.mockResolvedValue({ markets });
}

let mounted: Mounted | undefined;

async function render(props: { isAuthenticated?: boolean; authLoading?: boolean; video?: VideoType } = {}) {
  mounted = await mount(
    <WatchRoundPrediction
      video={props.video ?? video}
      isAuthenticated={props.isAuthenticated ?? true}
      authLoading={props.authLoading}
    />,
  );
  return mounted.container;
}

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll("button")).find(
    (candidate) =>
      candidate.getAttribute("aria-label") === label || candidate.textContent?.trim() === label,
  );
  if (!found) throw new Error(`No button "${label}"`);
  return found as HTMLButtonElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  board();
});

afterEach(async () => {
  await mounted?.unmount();
  mounted = undefined;
});

describe("WatchRoundPrediction loading", () => {
  it("shows a placeholder while the session or the board is loading", async () => {
    predictions.fetchPredictionBoard.mockReturnValue(new Promise(() => {}));
    const container = await render();
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
    expect(container.textContent).toContain("Round prediction");
    expect(container.textContent).not.toContain("Create prediction market");
  });

  it("keeps the placeholder while auth is loading even once the board arrives", async () => {
    board();
    const container = await render({ authLoading: true });
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("renders nothing when the round has no teams to bet on", async () => {
    const noTeams = [...(video as unknown as unknown[])] as unknown as VideoType;
    (noTeams as unknown as unknown[])[9] = null;
    const container = await render({ video: noTeams });
    expect(container.innerHTML).toBe("");
  });

  it("falls back to the empty state when the board cannot be loaded", async () => {
    predictions.fetchPredictionBoard.mockRejectedValue(new Error("offline"));
    const container = await render();
    expect(container.textContent).toContain("No prediction market exists for this round yet");
  });
});

describe("WatchRoundPrediction with a market", () => {
  it("shows each side's implied probability from the shares held", async () => {
    board(market());
    const container = await render();
    expect(container.textContent).toContain("75%");
    expect(container.textContent).toContain("25%");
    expect(container.textContent).toContain("Total shares: 40");
    expect(container.textContent).toContain("Alpha AB");
    expect(container.textContent).toContain("Beta CD");
    expect(container.querySelector('a[href="/practice/predictions"]')).not.toBeNull();
    expect(
      container.querySelector('[aria-label="Bet on Affirmative wins (75% implied probability)"]'),
    ).not.toBeNull();
  });

  it("starts both sides at even odds when nobody holds shares", async () => {
    board(market({ positions: [] }));
    const container = await render();
    expect(container.textContent).toContain("Total shares: 0");
    expect(container.querySelectorAll('[aria-label$="(50% implied probability)"]')).toHaveLength(2);
  });

  it("ignores markets for other rounds and non-debate or malformed markets", async () => {
    board(
      market({ title: "Who wins Some other round?" }),
      market({ kind: "event" }),
      market({ outcomes: [{ id: "x", label: "Maybe" }, { id: "y", label: "Perhaps" }] }),
      market({ outcomes: [{ id: "x", label: "Affirmative" }] }),
    );
    const container = await render();
    expect(container.textContent).toContain("No prediction market exists for this round yet");
  });

  it("places a 10 point bet on the chosen side and refreshes the page", async () => {
    board(market());
    predictions.placeBet.mockResolvedValue({});
    const container = await render();
    await click(button(container, "Bet 10 points on Negative wins"));
    expect(predictions.placeBet).toHaveBeenCalledWith("m1", { outcomeId: "o-neg", stake: 10 });
    expect(router.refresh).toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("betting on the affirmative uses the affirmative outcome", async () => {
    board(market());
    predictions.placeBet.mockResolvedValue({});
    const container = await render();
    await click(button(container, "Bet 10 points on Affirmative wins"));
    expect(predictions.placeBet).toHaveBeenCalledWith("m1", { outcomeId: "o-aff", stake: 10 });
  });

  it("shows the server's reason when a bet fails, and a generic one otherwise", async () => {
    board(market());
    predictions.placeBet.mockRejectedValueOnce(new Error("Not enough points"));
    const container = await render();
    await click(button(container, "Bet 10 points on Affirmative wins"));
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Not enough points");
    expect(router.refresh).not.toHaveBeenCalled();

    predictions.placeBet.mockRejectedValueOnce("boom");
    await click(button(container, "Bet 10 points on Affirmative wins"));
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Could not place bet.");
  });

  it("disables betting for signed-out viewers", async () => {
    board(market());
    const container = await render({ isAuthenticated: false });
    expect(button(container, "Bet 10 points on Affirmative wins").disabled).toBe(true);
    expect(button(container, "Bet on Negative wins (25% implied probability)").disabled).toBe(true);
  });

  it.each([
    ["resolved", "Settled"],
    ["void", "Voided"],
    ["closed", "Closed"],
  ])("labels a %s market and stops taking bets", async (status, label) => {
    board(market({ status }));
    const container = await render();
    expect(container.textContent).toContain(label);
    expect(button(container, "Bet 10 points on Affirmative wins").disabled).toBe(true);
  });

  it("does not label an open market", async () => {
    board(market());
    const container = await render();
    expect(container.textContent).not.toMatch(/Settled|Voided|Closed/);
  });
});

describe("WatchRoundPrediction without a market", () => {
  it("sends signed-out viewers to sign in", async () => {
    const container = await render({ isAuthenticated: false });
    expect(container.textContent).not.toContain("Create prediction market");
    await click(button(container, "Sign in to create a market"));
    expect(router.push).toHaveBeenCalledWith("/auth/signin");
  });

  it("opens and cancels the create form for signed-in viewers", async () => {
    const container = await render();
    await click(button(container, "Create prediction market"));
    const sides = Array.from(container.querySelectorAll<HTMLInputElement>("input[readonly]")).map((i) => i.value);
    expect(sides).toEqual(["Affirmative wins — Alpha AB", "Negative wins — Beta CD"]);
    await click(button(container, "Cancel"));
    expect(container.querySelector("form")).toBeNull();
    expect(container.textContent).toContain("Create prediction market");
  });

  it("creates the market with the chosen closing time and refreshes", async () => {
    predictions.createMarket.mockResolvedValue({});
    const container = await render();
    await click(button(container, "Create prediction market"));
    const closes = container.querySelector<HTMLInputElement>('input[type="datetime-local"]')!;
    await type(closes, "2030-02-03T04:05");
    await flush(() => {
      container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(predictions.createMarket).toHaveBeenCalledWith({
      kind: "debate",
      title: "Who wins Finals: Alpha AB vs Beta CD?",
      description: "Prediction market for the Alpha AB (Aff) vs Beta CD (Neg) round.",
      closesAt: Math.floor(new Date("2030-02-03T04:05").getTime() / 1000),
      outcomes: ["Affirmative wins — Alpha AB", "Negative wins — Beta CD"],
    });
    expect(router.refresh).toHaveBeenCalled();
    expect(container.querySelector("form")).toBeNull();
  });

  it("reports a failed create and keeps the form open", async () => {
    predictions.createMarket.mockRejectedValue(new Error("Market limit reached"));
    const container = await render();
    await click(button(container, "Create prediction market"));
    await flush(() => {
      container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Market limit reached");
    expect(container.querySelector("form")).not.toBeNull();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("uses a generic message when the create failure carries none", async () => {
    predictions.createMarket.mockRejectedValue(undefined);
    const container = await render();
    await click(button(container, "Create prediction market"));
    await flush(() => {
      container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Could not create market.");
  });
});
