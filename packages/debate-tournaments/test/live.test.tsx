import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { DEMO_TOURN_ID } from "../src/host/demo-account";
import {
  DEMO_SPEED,
  formatClock,
  isLiveDemo,
  liveFeed,
  liveRoomState,
  liveRoundState,
  liveSchedule,
  segmentSummary,
  segmentTranscript,
  spokenSoFar,
  type LiveRoomInput,
} from "../src/ui/live/demo-live";
import { LiveRoundBadge, LiveStatusCell } from "../src/ui/live/LiveRoom";
import { PAIRINGS_EMBLEM, Schematic } from "../src/ui/pages/RoundPage";

const room: LiveRoomInput = { sectionId: 4242, eventAbbr: "VCX", eventType: "debate", entries: ["Alpha AB", "Beta CD"], judgeCount: 3 };

/** Steps through one loop and returns the first `now` that lands in `phase`. */
function findPhase(phase: string, input = room, roundId = 7): number {
  for (let now = 0; now < 30 * 60_000; now += 5_000) if (liveRoomState(input, roundId, now).phase === phase) return now;
  throw new Error(`no ${phase} frame`);
}

describe("demo live simulation", () => {
  it("only applies to the demo tournament", () => {
    expect(isLiveDemo(DEMO_TOURN_ID)).toBe(true);
    expect(isLiveDemo(12)).toBe(false);
  });

  it("uses each event's speech order", () => {
    expect(liveSchedule("VCX", "debate").map((s) => s.name)).toContain("2NR");
    expect(liveSchedule("VLD", "debate")[0].name).toBe("AC");
    expect(liveSchedule("VPF", "debate").at(-1)?.name).toBe("Con Final Focus");
    expect(liveSchedule("VPRL", "debate").at(-1)?.name).toBe("PMR");
    expect(liveSchedule("OO", "speech", ["A1", "B2"]).map((s) => s.entryCode)).toEqual(["A1", "B2"]);
  });

  it("is deterministic for a room and moment", () => {
    const now = 1_790_000_000_000;
    expect(liveRoomState(room, 7, now)).toEqual(liveRoomState(room, 7, now));
  });

  it("marks exactly one current segment while live, with progress between 0 and 100", () => {
    const state = liveRoomState(room, 7, findPhase("live"));
    expect(state.segments.filter((s) => s.status === "current")).toHaveLength(1);
    expect(state.current).not.toBeNull();
    expect(state.percent).toBeGreaterThanOrEqual(0);
    expect(state.percent).toBeLessThanOrEqual(100);
    expect(state.viewers).toBeGreaterThan(0);
  });

  it("advances at DEMO_SPEED and loops through check-in, live and decided", () => {
    const start = findPhase("live");
    const a = liveRoomState(room, 7, start);
    const b = liveRoomState(room, 7, start + 10_000);
    expect(b.elapsedMs - a.elapsedMs).toBe(10_000 * DEMO_SPEED);
    const decided = liveRoomState(room, 7, findPhase("decided"));
    expect(decided.percent).toBe(100);
    expect(decided.decision?.ballots).toMatch(/^[23]-[01]$/);
    expect(liveRoomState(room, 7, findPhase("check-in")).percent).toBe(0);
  });

  it("summarizes the round for the pairings index", () => {
    const state = liveRoundState(7, "VLD", "debate", 0);
    expect(["check-in", "live", "decided"]).toContain(state.phase);
  });

  it("writes transcripts, summaries and a feed from the room's entries", () => {
    const [first] = liveSchedule("VCX", "debate");
    const transcript = segmentTranscript(room, first);
    expect(transcript.join(" ")).toContain("Alpha AB");
    expect(transcript.join(" ")).toContain("intellectual property");
    expect(segmentSummary(room, first)).toContain("Alpha AB");
    expect(spokenSoFar(transcript, 0.01)).toHaveLength(1);
    expect(spokenSoFar(transcript, 1)).toEqual(transcript);

    const decided = liveRoomState(room, 7, findPhase("decided"));
    const feed = liveFeed(room, decided);
    expect(feed[0].text).toMatch(/^Decision: /);
    expect(feed.at(-1)?.text).toContain("started");
  });

  it("formats the debate clock", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(125_000)).toBe("2:05");
  });
});

describe("live UI", () => {
  const round = {
    id: 7,
    name: 1,
    label: null,
    type: "prelim",
    tz: null,
    startTime: null,
    Event: { id: 1, name: "Varsity Policy", abbr: "VCX", type: "debate" },
    Sections: { "1": { id: 4242, letter: "1", flight: null, Entries: { "1": { id: 1, code: "Alpha AB", side: 1 }, "2": { id: 2, code: "Beta CD", side: 2 } } } },
  };

  it("renders the status cell with the current speech and a tune-in button", () => {
    const html = renderToString(<LiveStatusCell room={room} roundId={7} now={findPhase("live")} open={false} onToggle={() => {}} />);
    expect(html).toContain('data-live-phase="live"');
    expect(html).toContain("Tune in");
    expect(html).toContain('role="progressbar"');
  });

  it("renders nothing time-dependent before mount", () => {
    expect(renderToString(<LiveStatusCell room={room} roundId={7} now={null} open={false} onToggle={() => {}} />)).toContain("—");
    expect(renderToString(<LiveRoundBadge roundId={7} eventAbbr="VCX" eventType="debate" now={null} />)).toBe("");
  });

  it("adds a Live column to the demo's pairings only", () => {
    expect(renderToString(<Schematic round={round} live />)).toContain(">Live<");
    expect(renderToString(<Schematic round={round} />)).not.toContain(">Live<");
  });

  it("shows the emblem in the pairings header on every tournament", () => {
    expect(renderToString(<Schematic round={round} />)).toContain(PAIRINGS_EMBLEM);
  });
});
