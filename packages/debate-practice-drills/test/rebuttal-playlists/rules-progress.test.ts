/**
 * @fileoverview Rebuttal Playlists: the curated lists, the pairing and drill
 * rules, playlist progress and the rank ladder, prompts and validation.
 */

import { describe, expect, it } from "vitest";

import { CHALLENGE_FORMATS } from "../../src/debate-challenges/types";
import { REBUTTAL_PLAYLISTS, findPlaylistVideo } from "../../src/rebuttal-playlists/playlists";
import { allPlaylistProgress, playlistProgress, rebuttalRank, totalRebuttals } from "../../src/rebuttal-playlists/progress";
import { coachPrompt, drillJudgePrompt, lastRebuttalName, parseDrillJudgeReply } from "../../src/rebuttal-playlists/prompts";
import {
  aiOwesRebuttal,
  applyAiRebuttal,
  applyDrillDecision,
  applyDrillMove,
  availableDrillMoves,
  canJoinDrill,
  createDrill,
  joinDrill,
  pickPartnerDrill,
  type DrillState,
} from "../../src/rebuttal-playlists/rules";
import { AI_PARTNER_ID, MAX_COACH_USES, PARTNER_WAIT_SECONDS, type RebuttalDrill } from "../../src/rebuttal-playlists/types";
import { parseNewRebuttalDrill, parseRebuttalDrillUpdate } from "../../src/rebuttal-playlists/validation";

const NOW = 1_800_000_000;
const REBUTTAL =
  "Extend our first contention: they dropped the link turn, so it's offense. Weigh it on probability — their impact needs four steps.";

function must(result: ReturnType<typeof applyDrillMove>): DrillState {
  if (!result.ok) throw new Error(result.error);
  return result.next;
}

describe("REBUTTAL_PLAYLISTS", () => {
  it("has ten playlists of ten distinct videos each, in known formats", () => {
    expect(REBUTTAL_PLAYLISTS).toHaveLength(10);
    expect(new Set(REBUTTAL_PLAYLISTS.map((p) => p.id)).size).toBe(10);
    const formats = new Set(CHALLENGE_FORMATS.map((f) => f.id));
    for (const playlist of REBUTTAL_PLAYLISTS) {
      expect(playlist.videos).toHaveLength(10);
      expect(new Set(playlist.videos.map((v) => v.videoId)).size).toBe(10);
      for (const video of playlist.videos) {
        expect(video.videoId).toMatch(/^[\w-]{11}$/);
        expect(formats.has(video.format)).toBe(true);
      }
    }
  });

  it("covers every level and several formats and styles", () => {
    expect(new Set(REBUTTAL_PLAYLISTS.map((p) => p.level))).toEqual(new Set(["novice", "varsity", "college"]));
    expect(new Set(REBUTTAL_PLAYLISTS.map((p) => p.style)).size).toBeGreaterThanOrEqual(5);
    expect(new Set(REBUTTAL_PLAYLISTS.map((p) => p.formatLabel)).size).toBeGreaterThanOrEqual(4);
  });
});

describe("drill rules", () => {
  it("pairs a waiting drill with a student on the other side only", () => {
    const waiting = createDrill({ creatorId: "alice", side: "aff", vsAi: false }, NOW);
    expect(waiting.status).toBe("waiting");
    expect(canJoinDrill(waiting, "bob", "neg", NOW + 10)).toBe(true);
    expect(canJoinDrill(waiting, "bob", "aff", NOW + 10)).toBe(false);
    expect(canJoinDrill(waiting, "alice", "neg", NOW + 10)).toBe(false);
    expect(canJoinDrill(waiting, "bob", "neg", NOW + PARTNER_WAIT_SECONDS)).toBe(false);
    expect(joinDrill(waiting, "bob")).toMatchObject({ partnerId: "bob", status: "writing" });
  });

  it("picks the oldest joinable drill and skips blocked starters", () => {
    const entry = (id: string, creatorId: string, createdAt: number) => ({
      id,
      state: createDrill({ creatorId, side: "neg", vsAi: false }, createdAt),
    });
    const list = [entry("new", "carol", NOW), entry("old", "dave", NOW - 100), entry("blocked", "eve", NOW - 500)];
    expect(pickPartnerDrill(list, "bob", "aff", NOW, new Set(["eve"]))?.id).toBe("old");
    expect(pickPartnerDrill(list, "bob", "neg", NOW)).toBeNull();
  });

  it("lets the starter write while waiting, and judges once both rebuttals are in", () => {
    let state = createDrill({ creatorId: "alice", side: "aff", vsAi: false }, NOW);
    state = must(applyDrillMove(state, "alice", "submit", NOW, REBUTTAL));
    expect(state.status).toBe("waiting");
    expect(applyDrillMove(state, "alice", "submit", NOW, REBUTTAL)).toMatchObject({ ok: false, status: 409 });
    state = joinDrill(state, "bob");
    const result = applyDrillMove(state, "bob", "submit", NOW, REBUTTAL);
    expect(result.ok && result.next.status).toBe("judging");
    expect(result.ok && result.notify).toEqual(["alice"]);
    const judged = applyDrillDecision((result as { next: DrillState }).next, "neg", NOW + 5);
    expect(judged).toMatchObject({ status: "complete", winnerSide: "neg", completedAt: NOW + 5 });
  });

  it("refuses short rebuttals and strangers", () => {
    const state = createDrill({ creatorId: "alice", side: "aff", vsAi: true }, NOW);
    expect(applyDrillMove(state, "alice", "submit", NOW, "too short")).toMatchObject({ ok: false, status: 400 });
    expect(applyDrillMove(state, "mallory", "submit", NOW, REBUTTAL)).toMatchObject({ ok: false, status: 403 });
  });

  it("caps coach requests per side", () => {
    let state = createDrill({ creatorId: "alice", side: "neg", vsAi: true }, NOW);
    for (let i = 0; i < MAX_COACH_USES; i++) state = must(applyDrillMove(state, "alice", "coach", NOW, REBUTTAL));
    expect(applyDrillMove(state, "alice", "coach", NOW, REBUTTAL)).toMatchObject({ ok: false, status: 429 });
  });

  it("switches a waiting drill to the AI, which then owes and gives its rebuttal", () => {
    let state = createDrill({ creatorId: "alice", side: "aff", vsAi: false }, NOW);
    expect(availableDrillMoves(state, "alice", NOW)).toEqual(["submit", "coach", "use_ai", "cancel"]);
    state = must(applyDrillMove(state, "alice", "use_ai", NOW));
    expect(state.partnerId).toBe(AI_PARTNER_ID);
    expect(aiOwesRebuttal(state)).toBe(true);
    state = applyAiRebuttal(state, "AI's 2NR.")!;
    expect(state.status).toBe("writing");
    state = must(applyDrillMove(state, "alice", "submit", NOW, REBUTTAL));
    expect(state.status).toBe("judging");
  });

  it("only lets the starter cancel, and only while waiting", () => {
    const state = createDrill({ creatorId: "alice", side: "aff", vsAi: false }, NOW);
    expect(must(applyDrillMove(state, "alice", "cancel", NOW)).status).toBe("cancelled");
    expect(applyDrillMove(joinDrill(state, "bob"), "alice", "cancel", NOW)).toMatchObject({ ok: false, status: 409 });
  });
});

function drill(extra: Partial<RebuttalDrill>): RebuttalDrill {
  const seat = (side: "aff" | "neg") => ({ side, person: null, submitted: false, text: null, coachLeft: 3 });
  return {
    id: "d",
    playlistId: "pf-finals",
    videoId: "OB3bJ_RN0RY",
    format: "pf",
    topic: "t",
    status: "writing",
    vsAi: true,
    viewerSide: "aff",
    aff: seat("aff"),
    neg: seat("neg"),
    winnerSide: null,
    decision: "",
    moves: [],
    createdAt: 1,
    updatedAt: 1,
    completedAt: null,
    ...extra,
  };
}

describe("progress", () => {
  const submitted = (side: "aff" | "neg") => ({ side, person: null, submitted: true, text: "x", coachLeft: 3 });

  it("counts videos redone per side, both sides, and wins; ignores cancelled drills", () => {
    const pf = REBUTTAL_PLAYLISTS.find((p) => p.id === "pf-finals")!;
    const [a, b] = pf.videos;
    const drills = [
      drill({ id: "1", videoId: a.videoId, viewerSide: "aff", aff: submitted("aff"), status: "complete", winnerSide: "aff" }),
      drill({ id: "2", videoId: a.videoId, viewerSide: "neg", neg: submitted("neg") }),
      drill({ id: "3", videoId: b.videoId, viewerSide: "neg", neg: submitted("neg") }),
      drill({ id: "4", videoId: pf.videos[2].videoId, viewerSide: "aff", aff: submitted("aff"), status: "cancelled" }),
      drill({ id: "5", videoId: pf.videos[3].videoId, viewerSide: "aff" }),
    ];
    const progress = playlistProgress(pf, drills);
    expect(progress).toMatchObject({ total: 10, done: 2, bothSides: 1, affDone: 1, negDone: 2, wins: 1, percent: 20 });
    expect(totalRebuttals(allPlaylistProgress(REBUTTAL_PLAYLISTS, drills))).toBe(3);
  });

  it("climbs the rank ladder", () => {
    expect(rebuttalRank(0)).toMatchObject({ rank: { title: "Novice" }, next: { title: "JV" }, toNext: 0 });
    expect(rebuttalRank(10).rank.title).toBe("JV");
    expect(rebuttalRank(10).toNext).toBe(50);
    expect(rebuttalRank(500)).toMatchObject({ rank: { title: "GOAT" }, next: null, toNext: 100 });
  });
});

describe("prompts and validation", () => {
  const video = findPlaylistVideo("policy-finals", "_XU92LHHk2Y")!;

  it("names each format's last rebuttal", () => {
    expect(lastRebuttalName("policy", "aff")).toBe("2AR");
    expect(lastRebuttalName("ld", "neg")).toBe("NR");
    expect(lastRebuttalName("pf", "aff")).toMatch(/Final Focus/);
  });

  it("asks the coach to critique the argument without rewriting it, and the judge for JSON", () => {
    const coach = coachPrompt({ format: "policy", video }, "neg", "my draft");
    expect(coach).toContain("2NR");
    expect(coach).toContain("never the person");
    expect(coach).toContain("my draft");
    expect(drillJudgePrompt({ format: "policy", video }, "A", "N")).toContain('"winner"');
    expect(parseDrillJudgeReply('{"winner":"neg","reason":"Better collapse."}')).toEqual({ winner: "neg", reason: "Better collapse." });
  });

  it("only accepts a video on the named playlist", () => {
    expect(parseNewRebuttalDrill({ playlistId: "policy-finals", videoId: "_XU92LHHk2Y", side: "aff", partner: "ai" }).ok).toBe(true);
    expect(parseNewRebuttalDrill({ playlistId: "pf-finals", videoId: "_XU92LHHk2Y", side: "aff", partner: "ai" }).ok).toBe(false);
    expect(parseNewRebuttalDrill({ playlistId: "policy-finals", videoId: "_XU92LHHk2Y", side: "x", partner: "ai" }).ok).toBe(false);
    expect(parseRebuttalDrillUpdate({ action: "submit", text: "hi" })).toEqual({ ok: true, value: { action: "submit", text: "hi" } });
    expect(parseRebuttalDrillUpdate({ action: "concede" }).ok).toBe(false);
  });
});
