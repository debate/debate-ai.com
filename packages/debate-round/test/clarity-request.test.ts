/** Unit tests for `round/clarity-request` — the judge's "be more clear" request. */

import { describe, expect, it } from "vitest";

import {
  isRoundJudge,
  parseClarityRequest,
  shouldShowClarityRequest,
  takeClarityRequestSlot,
} from "../src/round/clarity-request";
import { parseClientMessage } from "../src/webcam/room-protocol";
import type { Round } from "../src/types/flow";

const round = {
  id: 1,
  tournamentName: "Glenbrooks",
  roundLevel: "Octos",
  debaters: { aff: ["a1@x.com", "a2@x.com"], neg: ["n1@x.com", "n2@x.com"] },
  judges: ["Judge@x.com"],
  flowIds: [],
  timestamp: 0,
  status: "active",
} as Round;

const oneAC = { speaker: "1A", secondary: false };

describe("isRoundJudge", () => {
  it("matches a judge email case-insensitively", () => {
    expect(isRoundJudge(round, [null, " judge@X.com "])).toBe(true);
    expect(isRoundJudge(round, ["a1@x.com"])).toBe(false);
    expect(isRoundJudge(undefined, ["judge@x.com"])).toBe(false);
  });
});

describe("shouldShowClarityRequest", () => {
  it("shows only to the seated debater giving the speech", () => {
    const base = { round, speech: oneAC, speechTimerRunning: false };
    expect(shouldShowClarityRequest({ ...base, viewerEmails: ["a1@x.com"] })).toBe(true);
    expect(shouldShowClarityRequest({ ...base, viewerEmails: ["a2@x.com"] })).toBe(false);
    expect(shouldShowClarityRequest({ ...base, viewerEmails: ["n1@x.com"], speechTimerRunning: true })).toBe(false);
  });

  it("never shows to the judge", () => {
    expect(
      shouldShowClarityRequest({ round, viewerEmails: ["judge@x.com"], speech: oneAC, speechTimerRunning: true }),
    ).toBe(false);
  });

  it("falls back to a running timer when the viewer isn't seated", () => {
    const base = { round, viewerEmails: ["guest@x.com"], speech: oneAC };
    expect(shouldShowClarityRequest({ ...base, speechTimerRunning: true })).toBe(true);
    expect(shouldShowClarityRequest({ ...base, speechTimerRunning: false })).toBe(false);
  });
});

describe("parseClarityRequest", () => {
  it("accepts a speech name and rejects junk", () => {
    expect(parseClarityRequest({ speechName: "1AC", sentAt: 5 })).toEqual({ speechName: "1AC", sentAt: 5 });
    expect(parseClarityRequest({ speechName: "1AC" })).toEqual({ speechName: "1AC", sentAt: 0 });
    expect(parseClarityRequest({ speechName: "" })).toBeNull();
    expect(parseClarityRequest(null)).toBeNull();
  });

  it("is a room event the relay accepts", () => {
    const raw = JSON.stringify({ type: "room-event", event: "clarity-request", payload: { speechName: "1AC" } });
    expect(parseClientMessage(raw)).toMatchObject({ event: "clarity-request" });
  });
});

describe("takeClarityRequestSlot", () => {
  it("rate-limits each speech separately", () => {
    const sent = new Map<string, number>();
    expect(takeClarityRequestSlot(sent, "1AC", 1000)).toBe(true);
    expect(takeClarityRequestSlot(sent, "1AC", 3000)).toBe(false);
    expect(takeClarityRequestSlot(sent, "1NC", 3000)).toBe(true);
    expect(takeClarityRequestSlot(sent, "1AC", 6000)).toBe(true);
  });
});
