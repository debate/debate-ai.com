// @vitest-environment jsdom
/**
 * @fileoverview The bot picker and round setup: choosing a bot from the
 * difficulty accordion, the topic and phase-clock validation, creating the
 * debate (and handing the round to `onStart` after the success toast), the
 * error path, and the localStorage draft it restores and clears.
 */

import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ALL_BOTS, DEFAULT_PHASE_TIMINGS, MAX_PHASE_SECONDS } from "../src/ui/bots";
import { click, flush, mount, type, type Mounted } from "./helpers/mount";

const client = vi.hoisted(() => ({ createDebate: vi.fn() }));
const createOverride = vi.hoisted(() => ({ current: null as null | (() => Promise<unknown>) }));
vi.mock("../src/client", () => ({
  // A plain rejecting function rather than a rejecting `vi.fn` result,
  // which Vitest reports as a test error even once the picker has caught it.
  createDebate: (...args: unknown[]) => (createOverride.current ? createOverride.current() : client.createDebate(...args)),
}));

const { BotSelection } = await import("../src/ui/BotSelection");

const DRAFT_KEY = "botSelectionState";
const FIRST_BOT = ALL_BOTS[0]!;

let mounted: Mounted | null = null;

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  vi.clearAllMocks();
  createOverride.current = null;
  client.createDebate.mockResolvedValue({ debateId: "debate-42" });
});

afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function render(props: Partial<Parameters<typeof BotSelection>[0]> = {}) {
  mounted = await mount(<BotSelection onStart={() => {}} {...props} />);
  return mounted.container;
}

const startButton = (container: HTMLElement) =>
  [...container.querySelectorAll("button")].find((node) => node.textContent?.startsWith("Start Debate"))!;

async function pickFirstBot(container: HTMLElement) {
  const levelHeader = [...container.querySelectorAll("span")].find((node) => node.textContent === FIRST_BOT.level)!;
  await click(levelHeader.closest("div.flex")!);
  await click(container.querySelector(`[role="button"] img[alt="${FIRST_BOT.name}"]`)!.closest('[role="button"]')!);
}

const topicInput = (container: HTMLElement) =>
  container.querySelector<HTMLInputElement>('input[placeholder="Enter your custom topic"]')!;

describe("BotSelection", () => {
  it("only enables Start once a bot and a topic are chosen", async () => {
    const container = await render();
    expect(startButton(container).disabled).toBe(true);

    await pickFirstBot(container);
    expect(container.textContent).toContain("Selected Bot");
    expect(container.textContent).toContain(`${FIRST_BOT.rating} Rating`);
    expect(startButton(container).disabled).toBe(true);

    await type(topicInput(container), "Pineapple belongs on pizza");
    expect(startButton(container).disabled).toBe(false);
  });

  it("creates the debate, then starts the round after the success toast", async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ stance: "against" }));
    const onStart = vi.fn();
    const container = await render({ onStart, apiBaseUrl: "/api/test" });
    await pickFirstBot(container);
    await type(topicInput(container), "  Pineapple belongs on pizza  ");
    await click(startButton(container));
    await flush(async () => {});

    expect(client.createDebate).toHaveBeenCalledWith(
      expect.objectContaining({
        botName: FIRST_BOT.name,
        botLevel: FIRST_BOT.level,
        topic: "Pineapple belongs on pizza",
        stance: "against",
        history: [],
        phaseTimings: DEFAULT_PHASE_TIMINGS,
      }),
      { baseUrl: "/api/test" },
    );
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Debate created successfully!");
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(onStart).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(onStart).toHaveBeenCalledWith({
      debateId: "debate-42",
      botName: FIRST_BOT.name,
      botLevel: FIRST_BOT.level,
      topic: "Pineapple belongs on pizza",
      stance: "against",
      phaseTimings: DEFAULT_PHASE_TIMINGS,
    });
  });

  it("lets the system pick a side when the stance is random", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    const container = await render();
    await pickFirstBot(container);
    await type(topicInput(container), "A topic");
    await click(startButton(container));
    expect(client.createDebate.mock.calls[0]![0].stance).toBe("for");
  });

  it("shows an error and re-enables Start when creating the debate fails", async () => {
    createOverride.current = () => Promise.reject(new Error("500"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const container = await render();
    await pickFirstBot(container);
    await type(topicInput(container), "A topic");
    await click(startButton(container));
    await flush(async () => {});
    expect(container.textContent).toContain("Failed to start debate. Please try again.");
    expect(startButton(container).disabled).toBe(false);
  });

  it("flags and blocks a phase clock outside the allowed range", async () => {
    const container = await render();
    await pickFirstBot(container);
    await type(topicInput(container), "A topic");
    const firstClock = container.querySelector<HTMLInputElement>('input[type="number"]')!;

    await type(firstClock, String(MAX_PHASE_SECONDS + 1));
    expect(container.textContent).toContain("Max 600s");
    expect(startButton(container).disabled).toBe(true);

    await type(firstClock, "");
    expect(firstClock.value).toBe("0");
    expect(startButton(container).disabled).toBe(true);
  });

  it("restores a saved draft and keeps saving changes to it", async () => {
    const timings = DEFAULT_PHASE_TIMINGS.map((phase) => ({ ...phase, time: 120 }));
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ selectedBot: FIRST_BOT.name, topic: "custom", customTopic: "Saved topic", stance: "for", phaseTimings: timings }),
    );
    const container = await render();
    expect(container.textContent).toContain(FIRST_BOT.quote);
    expect(topicInput(container).value).toBe("Saved topic");
    expect(container.querySelector<HTMLInputElement>('input[type="number"]')!.value).toBe("120");

    await type(topicInput(container), "Edited topic");
    expect(JSON.parse(localStorage.getItem(DRAFT_KEY)!).customTopic).toBe("Edited topic");
  });

  it("falls back to defaults for a draft with malformed fields, and survives a corrupt one", async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ selectedBot: 7, phaseTimings: [{ name: 1 }] }));
    const container = await render();
    expect(container.textContent).not.toContain("Selected Bot");
    expect(container.querySelector<HTMLInputElement>('input[type="number"]')!.value).toBe(
      String(DEFAULT_PHASE_TIMINGS[0]!.time),
    );
    await mounted!.unmount();

    vi.spyOn(console, "error").mockImplementation(() => {});
    localStorage.setItem(DRAFT_KEY, "{corrupt");
    const recovered = await render();
    expect(startButton(recovered).disabled).toBe(true);
  });

  it("shows the history button only when the host supplies a handler", async () => {
    const onViewHistory = vi.fn();
    const container = await render({ onViewHistory });
    const history = [...container.querySelectorAll("button")].find((node) => node.textContent === "View Debate History")!;
    await click(history);
    expect(onViewHistory).toHaveBeenCalledTimes(1);
    await mounted!.unmount();

    const without = await render();
    expect(without.textContent).not.toContain("View Debate History");
  });
});
