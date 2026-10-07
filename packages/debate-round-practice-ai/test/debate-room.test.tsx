// @vitest-environment jsdom
/**
 * @fileoverview The live round: who speaks when across the three phases,
 * the phase-transition pause, the countdown handing a silent user's turn
 * over, judging (and its fallback scorecard), conceding, resuming from the
 * saved draft, and dictation.
 */

import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DebateRoomProps } from "../src/ui/DebateRoom";
import { click, flush, mount, type, type Mounted } from "./helpers/mount";

const client = vi.hoisted(() => ({
  sendDebateMessage: vi.fn(),
  judgeDebate: vi.fn(),
  concedeDebate: vi.fn(),
}));
const judgeOverride = vi.hoisted(() => ({ current: null as null | (() => Promise<unknown>) }));
vi.mock("../src/client", () => ({
  ...client,
  // A plain rejecting function rather than a rejecting `vi.fn` result,
  // which Vitest reports as a test error even once the room has caught it.
  judgeDebate: (...args: unknown[]) => (judgeOverride.current ? judgeOverride.current() : client.judgeDebate(...args)),
}));

const { DebateRoom } = await import("../src/ui/DebateRoom");

const PHASES = [
  { name: "Opening Statements", time: 60 },
  { name: "Cross-Examination", time: 60 },
  { name: "Closing Statements", time: 60 },
];

const BASE: DebateRoomProps = {
  debateId: "debate-1",
  botName: "Rookie Rick",
  botLevel: "Easy",
  topic: "Pineapple on pizza",
  stance: "for",
  phaseTimings: PHASES,
  userId: "ada",
};

const SCORECARD = {
  opening_statement: { user: { score: 8, reason: "ok" }, bot: { score: 7, reason: "ok" } },
  cross_examination: { user: { score: 8, reason: "ok" }, bot: { score: 7, reason: "ok" } },
  answers: { user: { score: 8, reason: "ok" }, bot: { score: 7, reason: "ok" } },
  closing: { user: { score: 8, reason: "ok" }, bot: { score: 7, reason: "ok" } },
  total: { user: 32, bot: 28 },
  verdict: { winner: "User", reason: "r", congratulations: "Great round!", opponent_analysis: "a" },
};

let mounted: Mounted | null = null;
let activity: string[] = [];
const onActivity = (event: Event) => activity.push((event as CustomEvent<{ kind: string }>).detail.kind);

beforeEach(() => {
  vi.useFakeTimers();
  // jsdom has no layout, so no scrollIntoView for the transcript's auto-scroll.
  Element.prototype.scrollIntoView = () => {};
  localStorage.clear();
  vi.clearAllMocks();
  judgeOverride.current = null;
  activity = [];
  window.addEventListener("debate-ai:debater-activity", onActivity);
  let botTurns = 0;
  client.sendDebateMessage.mockImplementation(async () => ({ response: `Bot line ${++botTurns}` }));
  client.judgeDebate.mockResolvedValue({ result: `\`\`\`json\n${JSON.stringify(SCORECARD)}\n\`\`\`` });
  client.concedeDebate.mockResolvedValue({ gamification: { points: 5 } });
});

afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
  window.removeEventListener("debate-ai:debater-activity", onActivity);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function render(props: Partial<DebateRoomProps> = {}) {
  mounted = await mount(<DebateRoom {...BASE} {...props} />);
  await flush(async () => {});
  return mounted.container;
}

const textarea = (container: HTMLElement) => container.querySelector("textarea")!;
const button = (container: HTMLElement, label: string) =>
  [...container.querySelectorAll("button")].find((node) => node.textContent?.trim() === label);

async function say(container: HTMLElement, text: string) {
  await type(textarea(container), text);
  await click(button(container, "Send")!);
  await flush(async () => {});
}

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
  await flush(async () => {});
}

describe("DebateRoom turn order", () => {
  it("runs all three phases, then judges and shows the scorecard", async () => {
    const container = await render();
    expect(container.textContent).toContain("You to make a statement");

    await say(container, "My opening.");
    // The bot answers the opening at once, then the phase pauses.
    expect(client.sendDebateMessage).toHaveBeenCalledTimes(1);
    expect(client.sendDebateMessage.mock.calls[0]![0]).toMatchObject({ context: "Make your statement", stance: "Against" });
    expect(container.textContent).toContain("Opening Statements completed. Next: Cross-Examination");

    await advance(4000);
    expect(container.textContent).toContain("You to ask a question");
    await say(container, "Why pineapple?");
    // The bot answers, then asks its own question.
    expect(client.sendDebateMessage.mock.calls[1]![0].context).toBe("Answer this question: Why pineapple?");
    expect(client.sendDebateMessage.mock.calls[2]![0].context).toMatch(/^Ask a clear and concise question/);
    expect(container.textContent).toContain("You to answer");

    await say(container, "Because it is sweet.");
    await advance(4000);
    expect(container.textContent).toContain("Phase: Closing Statements");

    await say(container, "My closing.");
    await flush(async () => {});
    expect(client.judgeDebate).toHaveBeenCalledTimes(1);
    const history = client.judgeDebate.mock.calls[0]![0].history as { sender: string }[];
    expect(history.map((message) => message.sender)).toEqual(["User", "Bot", "User", "Bot", "Bot", "User", "User", "Bot"]);

    expect(container.textContent).toContain("User Wins!");
    expect(activity).toEqual(["speech_delivered", "speech_delivered", "speech_delivered", "speech_delivered", "practice_round", "practice_win"]);
  });

  it("lets the bot open when the user argues against", async () => {
    const container = await render({ stance: "AGAINST" });
    expect(client.sendDebateMessage).toHaveBeenCalledTimes(1);
    expect(client.sendDebateMessage.mock.calls[0]![0].stance).toBe("For");
    expect(container.textContent).toContain("Bot line 1");
    expect(container.textContent).toContain("You to make a statement");
  });

  it("ignores an empty message", async () => {
    const container = await render();
    await click(button(container, "Send")!);
    expect(client.sendDebateMessage).not.toHaveBeenCalled();
  });

  it("keeps the bot's turn going with a fallback line when the bot errors", async () => {
    client.sendDebateMessage.mockImplementation(() => {
      const failure = Promise.reject(new Error("model down"));
      failure.catch(() => {});
      return failure;
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const container = await render({ stance: "against" });
    expect(container.textContent).toContain("I encountered an error. Please continue.");
  });
});

describe("DebateRoom countdown", () => {
  it("moves on when the user's clock runs out", async () => {
    const container = await render({ phaseTimings: [{ name: "Opening Statements", time: 2 }, ...PHASES.slice(1)] });
    // One tick at a time: each tick re-arms the countdown from a re-render.
    await advance(1000);
    expect(container.textContent).toContain("0:01");
    await advance(1000);
    // The silent turn passes to the bot, whose reply then closes the phase.
    expect(client.sendDebateMessage).toHaveBeenCalledTimes(1);
    expect(client.sendDebateMessage.mock.calls[0]![0].history).toEqual([]);
    expect(container.textContent).toContain("Opening Statements completed");
  });

  it("offers Next Turn when the bot's clock runs out mid-reply", async () => {
    let finishReply: (value: { response: string }) => void = () => {};
    client.sendDebateMessage.mockImplementation(() => new Promise((resolve) => (finishReply = resolve)));
    const container = await render({ stance: "against", phaseTimings: [{ name: "Opening Statements", time: 1 }, ...PHASES.slice(1)] });
    await advance(1000);
    expect(button(container, "Next Turn")).toBeDefined();

    await click(button(container, "Next Turn")!);
    expect(container.textContent).toContain("You to make a statement");
    await flush(async () => finishReply({ response: "Late reply" }));
  });
});

describe("DebateRoom judging", () => {
  it("shows a zeroed scorecard when the judge reply can't be parsed", async () => {
    client.judgeDebate.mockResolvedValue({ result: "no json here" });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const container = await render({ phaseTimings: [PHASES[0]!] });
    await say(container, "Only speech.");
    expect(container.textContent).toContain("None Wins!");
    expect(container.textContent).toContain("Error occurred during judgment");
  });

  it("shows the zeroed scorecard when judging fails outright", async () => {
    judgeOverride.current = () => Promise.reject(new Error("judge offline"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const container = await render({ phaseTimings: [PHASES[0]!] });
    await say(container, "Only speech.");
    expect(container.textContent).toContain("None Wins!");
    expect(activity).not.toContain("practice_round");
  });

  it("exits from the scorecard's Close button", async () => {
    const onExit = vi.fn();
    const container = await render({ phaseTimings: [PHASES[0]!], onExit });
    await say(container, "Only speech.");
    await click(button(container, "Close")!);
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

describe("DebateRoom concede", () => {
  it("concedes after confirmation, reports points, then exits", async () => {
    vi.stubGlobal("confirm", () => true);
    const onExit = vi.fn();
    const container = await render({ onExit });
    await click(button(container, "Concede")!);
    await flush(async () => {});
    expect(client.concedeDebate).toHaveBeenCalledWith("debate-1", [], { baseUrl: undefined });
    expect(container.textContent).toContain("You have conceded the debate. (+5 points)");
    expect(button(container, "Concede")).toBeUndefined();

    await advance(2000);
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the user backs out of the confirmation", async () => {
    vi.stubGlobal("confirm", () => false);
    const container = await render();
    await click(button(container, "Concede")!);
    expect(client.concedeDebate).not.toHaveBeenCalled();
  });
});

describe("DebateRoom persistence", () => {
  it("resumes a saved round and clears the draft on unmount", async () => {
    const key = "debate_ada_Pineapple on pizza_debate-1";
    localStorage.setItem(
      key,
      JSON.stringify({
        messages: [{ sender: "User", text: "Saved opening", phase: "Opening Statements" }],
        currentPhase: 2,
        phaseStep: 0,
        isBotTurn: false,
        userStance: "For",
        botStance: "Against",
        timer: 30,
        isDebateEnded: false,
      }),
    );
    const container = await render();
    expect(container.textContent).toContain("Saved opening");
    expect(container.textContent).toContain("Phase: Closing Statements");

    await mounted!.unmount();
    mounted = null;
    expect(localStorage.getItem(key)).toBeNull();
  });

  it("starts fresh when the saved draft is corrupt", async () => {
    localStorage.setItem("debate_ada_Pineapple on pizza_debate-1", "{not json");
    const container = await render();
    expect(container.textContent).toContain("Phase: Opening Statements");
  });
});

describe("DebateRoom dictation", () => {
  it("appends final transcripts to the draft and stops on send", async () => {
    const instances: FakeRecognition[] = [];
    class FakeRecognition {
      continuous = false;
      interimResults = false;
      lang = "";
      onresult: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      start = vi.fn();
      stop = vi.fn();
      constructor() {
        instances.push(this);
      }
    }
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    const container = await render();
    const recognition = instances[0]!;

    await click(container.querySelector('[aria-label="Start dictation"]')!);
    expect(recognition.start).toHaveBeenCalled();

    const result = (transcript: string, isFinal: boolean) => Object.assign([{ transcript }], { isFinal });
    await flush(() => recognition.onresult?.({ resultIndex: 0, results: [result("pineapple is", false)] }));
    expect(textarea(container).value).toBe(" pineapple is");
    await flush(() => recognition.onresult?.({ resultIndex: 0, results: [result("pineapple is great", true)] }));
    expect(textarea(container).value).toBe("pineapple is great");

    await click(button(container, "Send")!);
    expect(recognition.stop).toHaveBeenCalled();
    expect(client.sendDebateMessage).toHaveBeenCalledTimes(1);
  });
});
