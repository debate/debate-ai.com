/**
 * @fileoverview The rules for what each person in a practice challenge may do
 * to it — the one copy of them.
 *
 * `PATCH /api/practice-partners/challenges/[id]` runs {@link applyChallengeAction}
 * against the stored row and writes whatever it returns; the board runs
 * {@link availableChallengeActions} (which is the same function, tried once per
 * action) to decide which buttons to draw. Because both read the same rules, a
 * button is never offered for an action the API will refuse, and the API never
 * accepts one the board would not offer.
 *
 * Pure: no database, no clock, no names. The result says who should hear about
 * the change; the route turns that into notification rows with the actor's
 * name in them ({@link challengeNotificationTitle}).
 *
 * @module lib/practice-partners/challenge-actions
 */

import type { ChallengeAction, ChallengeStatus, JudgeStatus, PracticeChallenge } from "./types";

/** The parts of a challenge the rules read and write. */
export interface ChallengeState {
  status: ChallengeStatus;
  challengerId: string;
  opponentId: string;
  judgeId: string | null;
  judgeStatus: JudgeStatus;
}

export type ChallengeActionResult =
  | {
      ok: true;
      next: ChallengeState;
      /** Everyone who should get a notification about this change — never the actor. */
      notify: string[];
    }
  | {
      ok: false;
      /** 403 when the viewer has no part in this action, 409 when the challenge is past it. */
      status: 403 | 409;
      error: string;
    };

export const CHALLENGE_ACTIONS: readonly ChallengeAction[] = [
  "accept",
  "decline",
  "cancel",
  "confirm-judge",
  "decline-judge",
  "volunteer-judge",
  "withdraw-judge",
];

export function isChallengeAction(value: unknown): value is ChallengeAction {
  return typeof value === "string" && (CHALLENGE_ACTIONS as readonly string[]).includes(value);
}

const forbidden = (error: string): ChallengeActionResult => ({ ok: false, status: 403, error });
const conflict = (error: string): ChallengeActionResult => ({ ok: false, status: 409, error });

/** Ids to tell, minus the actor and any empty seat, each once. */
function audience(actorId: string, ...ids: (string | null)[]): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id) && id !== actorId))];
}

/**
 * Applies one action by one viewer to a challenge.
 *
 * @param state - The challenge as stored.
 * @param viewerId - Who is acting.
 * @param action - What they are doing.
 * @param viewerIsJudgeVolunteer - Whether the viewer's profile has judging
 *   switched on; only consulted for `volunteer-judge`, since picking up a round
 *   is the one action open to someone who is not already in it.
 */
export function applyChallengeAction(
  state: ChallengeState,
  viewerId: string,
  action: ChallengeAction,
  viewerIsJudgeVolunteer: boolean,
): ChallengeActionResult {
  const isChallenger = state.challengerId === viewerId;
  const isOpponent = state.opponentId === viewerId;
  const isJudge = state.judgeId !== null && state.judgeId === viewerId;
  const live = state.status === "pending" || state.status === "accepted";

  switch (action) {
    case "accept":
    case "decline": {
      if (!isOpponent) return forbidden("Only the debater who was challenged can answer it.");
      if (state.status !== "pending") return conflict("This challenge has already been answered.");
      if (action === "accept") {
        return { ok: true, next: { ...state, status: "accepted" }, notify: audience(viewerId, state.challengerId) };
      }
      // A declined round has nothing left to judge, so the judge hears about it too.
      return {
        ok: true,
        next: { ...state, status: "declined" },
        notify: audience(viewerId, state.challengerId, state.judgeId),
      };
    }

    case "cancel": {
      if (!isChallenger && !isOpponent) return forbidden("Only the two debaters can call a round off.");
      if (!live) return conflict("This challenge is already closed.");
      // Before an answer, the opponent's way out is "decline" — which says
      // something different to the challenger than "cancelled" does.
      if (isOpponent && state.status === "pending") return conflict("Decline the challenge instead.");
      return {
        ok: true,
        next: { ...state, status: "cancelled" },
        notify: audience(viewerId, state.challengerId, state.opponentId, state.judgeId),
      };
    }

    case "confirm-judge":
    case "decline-judge": {
      if (!isJudge) return forbidden("Only the invited judge can answer a judging invitation.");
      if (!live) return conflict("This challenge is already closed.");
      if (state.judgeStatus !== "invited") return conflict("You have already answered this invitation.");
      if (action === "confirm-judge") {
        return {
          ok: true,
          next: { ...state, judgeStatus: "confirmed" },
          notify: audience(viewerId, state.challengerId, state.opponentId),
        };
      }
      return {
        ok: true,
        next: { ...state, judgeId: null, judgeStatus: null },
        notify: audience(viewerId, state.challengerId),
      };
    }

    case "withdraw-judge": {
      if (!isJudge) return forbidden("You are not judging this round.");
      if (!live) return conflict("This challenge is already closed.");
      if (state.judgeStatus !== "confirmed") return conflict("Answer the invitation instead.");
      return {
        ok: true,
        next: { ...state, judgeId: null, judgeStatus: null },
        notify: audience(viewerId, state.challengerId, state.opponentId),
      };
    }

    case "volunteer-judge": {
      if (isChallenger || isOpponent) return forbidden("You can't judge a round you're debating in.");
      if (!viewerIsJudgeVolunteer) return forbidden("Turn on “Volunteer to judge” in your practice profile first.");
      if (state.status !== "accepted") return conflict("Only an accepted round can be picked up by a judge.");
      if (state.judgeId !== null) return conflict("This round already has a judge.");
      return {
        ok: true,
        next: { ...state, judgeId: viewerId, judgeStatus: "confirmed" },
        notify: audience(viewerId, state.challengerId, state.opponentId),
      };
    }
  }
}

/** A board challenge in the shape the rules read. */
export function challengeState(challenge: PracticeChallenge): ChallengeState {
  return {
    status: challenge.status,
    challengerId: challenge.challenger.id,
    opponentId: challenge.opponent.id,
    judgeId: challenge.judge?.id ?? null,
    judgeStatus: challenge.judgeStatus,
  };
}

/** The actions a viewer may take on a challenge right now, in {@link CHALLENGE_ACTIONS} order. */
export function availableChallengeActions(
  challenge: PracticeChallenge,
  viewerId: string,
  viewerIsJudgeVolunteer: boolean,
): ChallengeAction[] {
  const state = challengeState(challenge);
  return CHALLENGE_ACTIONS.filter(
    (action) => applyChallengeAction(state, viewerId, action, viewerIsJudgeVolunteer).ok,
  );
}

/** The notification line the people in a challenge get when `actorName` takes `action`. */
export function challengeNotificationTitle(action: ChallengeAction, actorName: string): string {
  switch (action) {
    case "accept":
      return `${actorName} accepted your practice challenge`;
    case "decline":
      return `${actorName} declined a practice challenge`;
    case "cancel":
      return `${actorName} called off a practice round`;
    case "confirm-judge":
      return `${actorName} will judge your practice round`;
    case "decline-judge":
      return `${actorName} can't judge your practice round`;
    case "volunteer-judge":
      return `${actorName} volunteered to judge your practice round`;
    case "withdraw-judge":
      return `${actorName} stepped down as judge of your practice round`;
  }
}
