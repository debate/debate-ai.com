/**
 * @fileoverview The practice-challenge rules — who may move a challenge where,
 * and who hears about it. The API enforces these and the board draws its
 * buttons from them, so every case here is both a permission and a button.
 */

import { describe, expect, it } from "vitest";

import {
  applyChallengeAction,
  availableChallengeActions,
  type ChallengeState,
} from "../../../src/lib/practice-partners/challenge-actions";
import type { PracticeChallenge } from "../../../src/lib/practice-partners/types";

const pending: ChallengeState = {
  status: "pending",
  challengerId: "alice",
  opponentId: "bob",
  judgeId: null,
  judgeStatus: null,
};

describe("applyChallengeAction", () => {
  it("lets only the opponent accept, and tells the challenger", () => {
    expect(applyChallengeAction(pending, "alice", "accept", false)).toMatchObject({ ok: false, status: 403 });
    expect(applyChallengeAction(pending, "bob", "accept", false)).toEqual({
      ok: true,
      next: { ...pending, status: "accepted" },
      notify: ["alice"],
    });
  });

  it("refuses to answer a challenge twice", () => {
    const accepted = { ...pending, status: "accepted" as const };
    expect(applyChallengeAction(accepted, "bob", "decline", false)).toMatchObject({ ok: false, status: 409 });
  });

  it("tells an invited judge when the round is declined", () => {
    const withJudge = { ...pending, judgeId: "jen", judgeStatus: "invited" as const };
    const result = applyChallengeAction(withJudge, "bob", "decline", false);
    expect(result).toMatchObject({ ok: true, notify: ["alice", "jen"] });
  });

  it("sends a pending opponent to decline rather than cancel", () => {
    expect(applyChallengeAction(pending, "bob", "cancel", false)).toMatchObject({ ok: false, status: 409 });
    expect(applyChallengeAction(pending, "alice", "cancel", false)).toMatchObject({
      ok: true,
      next: { status: "cancelled" },
      notify: ["bob"],
    });
  });

  it("lets either debater call off an accepted round, but nobody else", () => {
    const accepted = { ...pending, status: "accepted" as const, judgeId: "jen", judgeStatus: "confirmed" as const };
    expect(applyChallengeAction(accepted, "bob", "cancel", false)).toMatchObject({ ok: true, notify: ["alice", "jen"] });
    expect(applyChallengeAction(accepted, "jen", "cancel", false)).toMatchObject({ ok: false, status: 403 });
  });

  it("lets an invited judge confirm or decline, and a confirmed one step down", () => {
    const invited = { ...pending, judgeId: "jen", judgeStatus: "invited" as const };
    expect(applyChallengeAction(invited, "jen", "confirm-judge", false)).toMatchObject({
      ok: true,
      next: { judgeId: "jen", judgeStatus: "confirmed" },
      notify: ["alice", "bob"],
    });
    expect(applyChallengeAction(invited, "jen", "decline-judge", false)).toMatchObject({
      ok: true,
      next: { judgeId: null, judgeStatus: null },
      notify: ["alice"],
    });
    expect(applyChallengeAction(invited, "jen", "withdraw-judge", false)).toMatchObject({ ok: false, status: 409 });
    const confirmed = { ...invited, judgeStatus: "confirmed" as const };
    expect(applyChallengeAction(confirmed, "jen", "withdraw-judge", false)).toMatchObject({
      ok: true,
      next: { judgeId: null },
    });
  });

  it("lets a judge volunteer pick up only an accepted, unjudged round they aren't debating in", () => {
    const accepted = { ...pending, status: "accepted" as const };
    expect(applyChallengeAction(accepted, "jen", "volunteer-judge", true)).toEqual({
      ok: true,
      next: { ...accepted, judgeId: "jen", judgeStatus: "confirmed" },
      notify: ["alice", "bob"],
    });
    expect(applyChallengeAction(accepted, "jen", "volunteer-judge", false)).toMatchObject({ ok: false, status: 403 });
    expect(applyChallengeAction(accepted, "alice", "volunteer-judge", true)).toMatchObject({ ok: false, status: 403 });
    expect(applyChallengeAction(pending, "jen", "volunteer-judge", true)).toMatchObject({ ok: false, status: 409 });
    const judged = { ...accepted, judgeId: "kim", judgeStatus: "confirmed" as const };
    expect(applyChallengeAction(judged, "jen", "volunteer-judge", true)).toMatchObject({ ok: false, status: 409 });
  });

  it("closes every door once a challenge is declined or cancelled", () => {
    const closed = { ...pending, status: "cancelled" as const, judgeId: "jen", judgeStatus: "invited" as const };
    for (const [viewer, action] of [
      ["bob", "accept"],
      ["alice", "cancel"],
      ["jen", "confirm-judge"],
    ] as const) {
      expect(applyChallengeAction(closed, viewer, action, true).ok).toBe(false);
    }
  });
});

describe("availableChallengeActions", () => {
  const person = (id: string) => ({ id, name: id, imageUrl: null });
  const challenge: PracticeChallenge = {
    id: "c1",
    status: "pending",
    challenger: person("alice"),
    opponent: person("bob"),
    judge: person("jen"),
    judgeStatus: "invited",
    format: "pf",
    topic: "Resolved: …",
    message: "",
    proposedAt: null,
    roomId: "practice-c1",
    createdAt: 0,
    updatedAt: 0,
  };

  it("offers each person in the round only their own moves", () => {
    expect(availableChallengeActions(challenge, "alice", false)).toEqual(["cancel"]);
    expect(availableChallengeActions(challenge, "bob", false)).toEqual(["accept", "decline"]);
    expect(availableChallengeActions(challenge, "jen", true)).toEqual(["confirm-judge", "decline-judge"]);
    expect(availableChallengeActions(challenge, "stranger", true)).toEqual([]);
  });

  it("offers an unjudged accepted round to judge volunteers outside it", () => {
    const open = { ...challenge, status: "accepted" as const, judge: null, judgeStatus: null };
    expect(availableChallengeActions(open, "stranger", true)).toEqual(["volunteer-judge"]);
    expect(availableChallengeActions(open, "stranger", false)).toEqual([]);
  });
});
