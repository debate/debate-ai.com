/**
 * @fileoverview Practice Partners request validation — every option checked
 * against the shared lists, and the proposed-time window.
 */

import { describe, expect, it } from "vitest";

import {
  parseChallengeId,
  parseNewChallenge,
  parseProfile,
  readStoredPreferences,
  roomIdForChallenge,
  storedPreferences,
} from "../validation";

const profile = {
  asCompetitor: true,
  asJudge: false,
  formats: ["pf", "pf", "ld"],
  styles: ["kritiks"],
  speed: "fast",
  level: "varsity",
  availability: "  weeknights  ",
  note: "",
};

describe("parseProfile", () => {
  it("accepts a valid profile, de-duplicating and trimming", () => {
    expect(parseProfile(profile)).toEqual({
      ok: true,
      value: { ...profile, formats: ["pf", "ld"], availability: "weeknights" },
    });
  });

  it("rejects an option that isn't on the shared list", () => {
    expect(parseProfile({ ...profile, styles: ["vibes"] })).toMatchObject({ ok: false });
    expect(parseProfile({ ...profile, speed: "ludicrous" })).toMatchObject({ ok: false });
  });

  it("requires a format once a role is switched on, but not for a hidden draft", () => {
    expect(parseProfile({ ...profile, formats: [] })).toMatchObject({ ok: false });
    expect(parseProfile({ ...profile, asCompetitor: false, formats: [] })).toMatchObject({ ok: true });
  });

  it("caps free text", () => {
    expect(parseProfile({ ...profile, note: "x".repeat(501) })).toMatchObject({ ok: false });
  });
});

describe("readStoredPreferences", () => {
  it("round-trips what storedPreferences writes", () => {
    const parsed = parseProfile(profile);
    if (!parsed.ok) throw new Error(parsed.error);
    const { asCompetitor: _a, asJudge: _j, ...prefs } = parsed.value;
    expect(readStoredPreferences(storedPreferences(prefs))).toEqual(prefs);
  });

  it("drops retired ids and falls back on bad JSON instead of failing the board", () => {
    expect(readStoredPreferences('{"formats":["pf","retired"],"speed":"warp"}')).toMatchObject({
      formats: ["pf"],
      speed: "moderate",
    });
    expect(readStoredPreferences("not json")).toMatchObject({ formats: [], level: "novice" });
  });
});

describe("parseNewChallenge", () => {
  const now = 1_800_000_000;
  const challenge = { opponentId: "bob", format: "ld", topic: " Resolved: … ", proposedAt: now + 3600 };

  it("accepts a valid challenge", () => {
    expect(parseNewChallenge(challenge, now)).toEqual({
      ok: true,
      value: { opponentId: "bob", judgeId: null, format: "ld", topic: "Resolved: …", message: "", proposedAt: now + 3600 },
    });
  });

  it("needs a resolution and a known format", () => {
    expect(parseNewChallenge({ ...challenge, topic: "  " }, now)).toMatchObject({ ok: false });
    expect(parseNewChallenge({ ...challenge, format: "chess" }, now)).toMatchObject({ ok: false });
  });

  it("refuses an opponent who is also the judge", () => {
    expect(parseNewChallenge({ ...challenge, judgeId: "bob" }, now)).toMatchObject({ ok: false });
  });

  it("allows a time a few minutes past, but not hours past or a season ahead", () => {
    expect(parseNewChallenge({ ...challenge, proposedAt: now - 60 }, now)).toMatchObject({ ok: true });
    expect(parseNewChallenge({ ...challenge, proposedAt: now - 7200 }, now)).toMatchObject({ ok: false });
    expect(parseNewChallenge({ ...challenge, proposedAt: now + 200 * 86400 }, now)).toMatchObject({ ok: false });
    expect(parseNewChallenge({ ...challenge, proposedAt: null }, now)).toMatchObject({ ok: true, value: { proposedAt: null } });
  });
});

describe("challenge ids and rooms", () => {
  it("accepts only minted UUIDs", () => {
    expect(parseChallengeId("0f8b6c9e-1d2a-4c3b-9e8f-7a6b5c4d3e2f")).toMatchObject({ ok: true });
    expect(parseChallengeId("../etc")).toMatchObject({ ok: false });
  });

  it("derives a room code the webcam rooms accept", () => {
    expect(roomIdForChallenge("0F8B6C9E-1d2a-4c3b-9e8f-7a6b5c4d3e2f")).toBe("practice-0f8b6c9e");
  });
});
