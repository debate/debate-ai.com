// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { liveRoomState, type LiveRoomInput } from "../src/ui/live/demo-live";
import { LiveRoomPanel, LiveStatusCell, ProgressBar, useNow } from "../src/ui/live/LiveRoom";
import { byText, click, render, settle, text, unmountAll } from "./helpers/dom";

const room: LiveRoomInput = { sectionId: 4242, eventAbbr: "VCX", eventType: "debate", entries: ["Alpha AB", "Beta CD"], judgeCount: 3 };
const speechRoom: LiveRoomInput = { sectionId: 77, eventAbbr: "OO", eventType: "speech", entries: ["A1", "B2", "C3"], judgeCount: 1 };

function findPhase(phase: string, input = room, roundId = 7, startAt = 0): number {
  for (let now = startAt; now < 60 * 60_000; now += 5_000) if (liveRoomState(input, roundId, now).phase === phase) return now;
  throw new Error(`no ${phase} frame`);
}
/** A frame during the live phase after at least one speech has finished. */
function livePastFirstSpeech(input = room): number {
  const live = findPhase("live", input);
  for (let now = live; now < live + 30 * 60_000; now += 5_000) {
    const s = liveRoomState(input, 7, now);
    if (s.phase === "live" && s.segments.some((seg) => seg.status === "done" && seg.kind !== "prep")) return now;
  }
  throw new Error("no frame with a finished speech");
}

class FakeUtterance {
  static last: FakeUtterance | null = null;
  rate = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly text: string) {
    FakeUtterance.last = this;
  }
}

const synth = { cancel: vi.fn(), speak: vi.fn() };

beforeEach(() => {
  synth.cancel.mockClear();
  synth.speak.mockClear();
  FakeUtterance.last = null;
  Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true, writable: true });
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
});
afterEach(() => {
  unmountAll();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  Reflect.deleteProperty(window, "speechSynthesis");
});

describe("ProgressBar", () => {
  it("exposes its percentage to assistive tech and sizes the fill", async () => {
    const el = await render(<ProgressBar percent={42} />, null);
    const bar = el.querySelector('[role="progressbar"]')!;
    expect(bar.getAttribute("aria-valuenow")).toBe("42");
    expect((bar.firstElementChild as HTMLElement).style.width).toBe("42%");
  });
});

describe("useNow", () => {
  function Clock() {
    const now = useNow(1000);
    return <p>{now === null ? "pending" : `t=${now}`}</p>;
  }

  it("ticks on its interval after mounting", async () => {
    vi.useFakeTimers({ now: 1_000_000, toFake: ["Date", "setInterval", "clearInterval"] });
    const el = await render(<Clock />, null);
    expect(text(el)).toBe("t=1000000");
    const { act } = await import("react");
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(text(el)).toBe("t=1003000");
  });
});

describe("LiveStatusCell", () => {
  it("shows a placeholder until the clock has started", async () => {
    const el = await render(<LiveStatusCell room={room} roundId={7} now={null} open={false} onToggle={() => {}} />, null);
    expect(text(el)).toBe("—");
  });

  it("shows the speech in progress and offers to tune in", async () => {
    const onToggle = vi.fn();
    const now = findPhase("live");
    const el = await render(<LiveStatusCell room={room} roundId={7} now={now} open={false} onToggle={onToggle} />, null);
    expect(el.querySelector("[data-live-phase]")?.getAttribute("data-live-phase")).toBe("live");
    expect(byText(el, "button", /Tune in/)).not.toBeNull();
    await click(byText(el, "button", /Tune in/));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("labels check-in, and a decided round by who won", async () => {
    const checkIn = await render(<LiveStatusCell room={room} roundId={7} now={findPhase("check-in")} open={false} onToggle={() => {}} />, null);
    expect(text(checkIn)).toContain("Checking in");
    expect(text(checkIn)).toContain("Replay");

    const decidedAt = findPhase("decided");
    const decision = liveRoomState(room, 7, decidedAt).decision!;
    const el = await render(<LiveStatusCell room={room} roundId={7} now={decidedAt} open={true} onToggle={() => {}} />, null);
    expect(text(el)).toContain(`${decision.winner === "aff" ? "Alpha AB" : "Beta CD"} wins ${decision.ballots}`);
    expect(text(el)).toContain("100%");
    expect(text(el)).toContain("Close stream");
    expect(el.querySelector("button")?.getAttribute("aria-expanded")).toBe("true");
  });

  it("falls back to 'Ballots in' when the winning side has no entry", async () => {
    // Side 2 has no entry code, so a neg win can only be reported generically.
    let lone: LiveRoomInput | null = null;
    for (let sectionId = 1; sectionId < 200 && !lone; sectionId++) {
      const candidate: LiveRoomInput = { ...room, sectionId, entries: ["Only One"] };
      if (liveRoomState(candidate, 7, findPhase("decided", candidate)).decision?.winner === "neg") lone = candidate;
    }
    expect(lone).not.toBeNull();
    const el = await render(<LiveStatusCell room={lone!} roundId={7} now={findPhase("decided", lone!)} open={false} onToggle={() => {}} />, null);
    expect(text(el)).toContain("Ballots in");
  });
});

describe("LiveRoomPanel", () => {
  const panel = (now: number | null, input = room, onClose = () => {}) => <LiveRoomPanel room={input} roundId={7} now={now} onClose={onClose} />;

  it("renders nothing until the clock has started", async () => {
    const el = await render(panel(null), null);
    expect(el.innerHTML).toBe("");
  });

  it("shows a pre-round panel while checking in", async () => {
    const el = await render(panel(findPhase("check-in")), null);
    expect(text(el)).toContain("Starting soon");
    expect(text(el)).toContain("Alpha AB vs Beta CD");
    expect(text(el)).toContain("The judges are checking in.");
    expect(text(el)).toContain("Summaries post as each speech ends.");
    expect((byText(el, "button", /Listen live/) as HTMLButtonElement).disabled).toBe(true);
    expect(text(el)).not.toContain("watching");
  });

  it("streams a live speech with captions, a timeline and the feed", async () => {
    const el = await render(panel(livePastFirstSpeech()), null);
    expect(text(el)).toContain("LIVE");
    expect(text(el)).toMatch(/\d+ watching/);
    expect(text(el)).toContain("Simulated demo · 6× speed");
    expect(text(el)).toMatch(/\d+:\d\d left/);
    const timeline = el.querySelector('ol[aria-label="Speech order"]')!;
    expect(timeline.querySelectorAll("li").length).toBeGreaterThan(4);
    expect(timeline.textContent).toContain("1AC");
    expect(el.querySelectorAll("ol:not([aria-label]) li").length).toBeGreaterThan(0);
    // A finished speech has a summary and a listen button.
    expect(el.querySelector('button[aria-label^="Listen to "]')).not.toBeNull();
  });

  it("reads a finished speech aloud, and stops it", async () => {
    const el = await render(panel(livePastFirstSpeech()), null);
    const listen = el.querySelector('button[aria-label^="Listen to "]')!;
    const name = listen.getAttribute("aria-label")!.replace("Listen to ", "");
    await click(listen);
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(FakeUtterance.last?.text.length).toBeGreaterThan(0);
    expect(FakeUtterance.last?.rate).toBe(1.05);
    expect(el.querySelector(`button[aria-label="Stop ${name}"]`)).not.toBeNull();

    // The utterance ending clears the playing state.
    const { act } = await import("react");
    act(() => FakeUtterance.last!.onend!());
    expect(el.querySelector(`button[aria-label="Listen to ${name}"]`)).not.toBeNull();

    await click(el.querySelector(`button[aria-label="Listen to ${name}"]`));
    await click(el.querySelector(`button[aria-label="Stop ${name}"]`));
    expect(synth.cancel).toHaveBeenCalled();
    expect(el.querySelector(`button[aria-label="Listen to ${name}"]`)).not.toBeNull();
  });

  it("reads each new speech as it starts while listening live, and stops on request", async () => {
    const el = await render(panel(livePastFirstSpeech()), null);
    await click(byText(el, "button", /Listen live/));
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(text(el)).toContain("Stop listening");
    await click(byText(el, "button", /Stop listening/));
    expect(text(el)).toContain("Listen live");
    expect(synth.cancel).toHaveBeenCalled();
  });

  it("explains when the browser cannot read aloud", async () => {
    Reflect.deleteProperty(window, "speechSynthesis");
    const el = await render(panel(livePastFirstSpeech()), null);
    expect(text(el)).toContain("Read-aloud needs a browser with speech synthesis.");
    expect(byText(el, "button", /Listen live/)).toBeNull();
    expect(el.querySelector('button[aria-label^="Listen to "]')).toBeNull();
  });

  it("marks a decided round as ended and lists every speech summary, newest first", async () => {
    const el = await render(panel(findPhase("decided")), null);
    expect(text(el)).toContain("Ended");
    expect(text(el)).toContain("The round is over. Replay any speech below.");
    expect(text(el)).not.toContain("watching");
    expect(el.querySelectorAll('button[aria-label^="Listen to "]').length).toBeGreaterThan(3);
  });

  it("describes a speech event by its speaker count and labels speeches by entry", async () => {
    const el = await render(panel(findPhase("live", speechRoom), speechRoom), null);
    expect(text(el)).toContain("3 speakers");
    expect(text(el)).not.toContain(" vs ");
  });

  it("closes from its close button", async () => {
    const onClose = vi.fn();
    const el = await render(panel(findPhase("live"), room, onClose), null);
    await click(el.querySelector('[aria-label="Close stream"]'));
    expect(onClose).toHaveBeenCalledTimes(1);
    await settle();
  });
});
