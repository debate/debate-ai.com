import { describe, expect, it } from "vitest";
import { getRoundParticipantEmails } from "../src/round/round-participants";
import type { Round } from "../src/types/flow";

function makeRound(overrides: Partial<Round> = {}): Round {
  return {
    id: 1,
    tournamentName: "Blake",
    roundLevel: "Prelim 1",
    debaters: {
      aff: ["aff1@example.com", "aff2@example.com"],
      neg: ["neg1@example.com", "neg2@example.com"],
    },
    judges: ["judge@example.com"],
    spectators: ["spectator@example.com"],
    flowIds: [1],
    timestamp: Date.now(),
    status: "active",
    ...overrides,
  };
}

describe("getRoundParticipantEmails", () => {
  it("returns an empty array when no round is passed", () => {
    expect(getRoundParticipantEmails(undefined)).toEqual([]);
    expect(getRoundParticipantEmails(null)).toEqual([]);
  });

  it("collects every debater, judge and spectator email on the round", () => {
    const emails = getRoundParticipantEmails(makeRound());
    expect(emails).toEqual([
      "aff1@example.com",
      "aff2@example.com",
      "neg1@example.com",
      "neg2@example.com",
      "judge@example.com",
      "spectator@example.com",
    ]);
  });

  it("omits spectators when the round has none", () => {
    const emails = getRoundParticipantEmails(makeRound({ spectators: undefined }));
    expect(emails).toEqual([
      "aff1@example.com",
      "aff2@example.com",
      "neg1@example.com",
      "neg2@example.com",
      "judge@example.com",
    ]);
  });

  it("ignores blank/whitespace-only entries", () => {
    const emails = getRoundParticipantEmails(
      makeRound({
        debaters: { aff: ["aff1@example.com", ""], neg: ["  ", "neg2@example.com"] },
        judges: [""],
        spectators: ["   "],
      }),
    );
    expect(emails).toEqual(["aff1@example.com", "neg2@example.com"]);
  });

  it("dedupes case-insensitively, keeping the first-seen casing", () => {
    const emails = getRoundParticipantEmails(
      makeRound({
        debaters: { aff: ["Same@Example.com", "aff2@example.com"], neg: ["neg1@example.com", "neg2@example.com"] },
        judges: ["same@example.com"],
        spectators: [" SAME@EXAMPLE.COM "],
      }),
    );
    expect(emails).toEqual(["Same@Example.com", "aff2@example.com", "neg1@example.com", "neg2@example.com"]);
  });

  it("trims surrounding whitespace from a returned email", () => {
    const emails = getRoundParticipantEmails(
      makeRound({
        debaters: { aff: ["  aff1@example.com  ", "aff2@example.com"], neg: ["neg1@example.com", "neg2@example.com"] },
        judges: [],
        spectators: [],
      }),
    );
    expect(emails[0]).toBe("aff1@example.com");
  });

  it("degrades gracefully when debaters/judges are missing entirely", () => {
    const round = makeRound({
      debaters: undefined as unknown as Round["debaters"],
      judges: undefined as unknown as string[],
      spectators: ["spectator@example.com"],
    });
    expect(getRoundParticipantEmails(round)).toEqual(["spectator@example.com"]);
  });
});
