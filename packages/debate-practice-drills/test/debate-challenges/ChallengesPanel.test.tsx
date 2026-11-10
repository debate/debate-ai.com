// @vitest-environment jsdom
/**
 * @fileoverview Render tests for the Online Challenges board: record, trophies,
 * the turn lists, sending a challenge, speaking, and collecting XP.
 */

import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChallengesPanel } from "../../src/debate-challenges/ui/ChallengesPanel";
import type { ChallengeBoardResponse, DebateChallenge, NewDebateChallenge } from "../../src/debate-challenges/types";
import { summarizeChallenges } from "../../src/debate-challenges/rewards";
import { button } from "../helpers/dom";
import { click, flush, mount, type, type Mounted } from "../helpers/mount";

const viewer = { id: "alice", name: "Alice", imageUrl: null };
const bob = { id: "bob", name: "Bob", imageUrl: null };

function challenge(extra: Partial<DebateChallenge>): DebateChallenge {
  return {
    id: "c1",
    status: "active",
    format: "pf",
    topic: "Resolved: data centers.",
    note: "",
    challenger: viewer,
    opponent: bob,
    vsAi: false,
    aiLevel: null,
    challengerSide: "aff",
    viewerSide: "aff",
    speeches: [{ side: "aff", authorId: "alice", text: "Aff case.", submittedAt: 1 }],
    turnId: "bob",
    deadlineAt: Math.floor(Date.now() / 1000) + 2 * 86400 + 3600,
    winnerSide: null,
    decisionMethod: null,
    decision: "",
    reward: null,
    moves: [],
    createdAt: 1,
    updatedAt: 1,
    completedAt: null,
    ...extra,
  };
}

function board(challenges: DebateChallenge[]): ChallengeBoardResponse {
  const { stats, trophies } = summarizeChallenges([]);
  return { viewer, challenges, stats, trophies };
}

let mounted: Mounted | null = null;
afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
});

describe("ChallengesPanel", () => {
  it("asks a signed-out reader to sign in", async () => {
    mounted = await mount(createElement(ChallengesPanel, { loadBoard: async () => null }));
    expect(mounted.container.textContent).toContain("Sign in");
  });

  it("shows the record, the trophy case, and who each round is waiting on", async () => {
    const yourTurn = challenge({ id: "mine", turnId: "alice", moves: ["speak", "concede"] });
    const theirs = challenge({ id: "theirs" });
    mounted = await mount(createElement(ChallengesPanel, { loadBoard: async () => board([yourTurn, theirs]) }));
    const text = mounted.container.textContent ?? "";
    expect(text).toContain("Your record");
    expect(text).toContain("First Victory");
    expect(text).toContain("Your speech");
    expect(text).toContain("Waiting on Bob · 2 days 1 hour left");
  });

  it("sends a speech on the viewer's turn and reloads", async () => {
    const updateChallenge = vi.fn(async () => challenge({}));
    const loadBoard = vi.fn(async () => board([challenge({ turnId: "alice", moves: ["speak"] })]));
    mounted = await mount(createElement(ChallengesPanel, { loadBoard, updateChallenge }));
    const textarea = mounted.container.querySelector("li textarea") as HTMLTextAreaElement;
    await type(textarea, "My rebuttal answers every argument they made.");
    await click(button(mounted.container, "Send speech"));
    await flush(async () => {});
    expect(updateChallenge).toHaveBeenCalledWith("c1", { action: "speak", text: "My rebuttal answers every argument they made." });
    expect(loadBoard).toHaveBeenCalledTimes(2);
  });

  it("collects a finished round's XP once and records it as Debater Level activity", async () => {
    const done = challenge({
      status: "complete",
      turnId: null,
      winnerSide: "aff",
      decisionMethod: "judge",
      decision: "Aff weighed better.",
      reward: { xp: 80, won: true, boost: 1.5, claimed: false },
      moves: ["claim"],
    });
    const updateChallenge = vi.fn(async () => done);
    const recordActivity = vi.fn();
    mounted = await mount(createElement(ChallengesPanel, { loadBoard: async () => board([done]), updateChallenge, recordActivity }));
    await flush(async () => {});
    expect(updateChallenge).toHaveBeenCalledWith("c1", { action: "claim" });
    expect(recordActivity.mock.calls).toEqual([
      ["challenge_played", 1],
      ["challenge_won", 1],
      ["challenge_boost", 2],
    ]);
    expect(mounted.container.textContent).toContain("+80 XP added to your Debater Level");
  });

  it("sends a challenge to the AI with the chosen topic and opening speech", async () => {
    const sendChallenge = vi.fn(async (_challenge: NewDebateChallenge) => challenge({}));
    mounted = await mount(createElement(ChallengesPanel, { loadBoard: async () => board([]), sendChallenge }));
    const form = mounted.container.querySelector('form[aria-label="New challenge"]') as HTMLFormElement;
    const speech = form.querySelector("textarea") as HTMLTextAreaElement;
    await type(speech, "Framework: util. Contention one: data centers strain the grid, raising prices for everyone.");
    await click(button(form, "Send challenge"));
    await flush(async () => {});
    expect(sendChallenge).toHaveBeenCalledTimes(1);
    const sent = sendChallenge.mock.calls[0][0];
    expect(sent).toMatchObject({ opponentId: "ai", aiLevel: "varsity", format: "pf", side: "aff" });
    expect(String(sent.topic)).toMatch(/^Resolved/);
  });
});
