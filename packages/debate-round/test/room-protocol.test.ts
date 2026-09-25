import { describe, expect, it } from "vitest";
import {
  MAX_MESSAGE_BYTES,
  normalizeRole,
  normalizeRoomId,
  parseClientMessage,
  roomIdForRound,
} from "../src/webcam/room-protocol";

describe("normalizeRoomId", () => {
  it("lowercases and slugs ids, rejecting too short or long ones", () => {
    expect(normalizeRoomId("  Round 12 / Finals ")).toBe("round-12-finals");
    expect(normalizeRoomId("ab")).toBeNull();
    expect(normalizeRoomId("x".repeat(65))).toBeNull();
  });
});

describe("normalizeRole", () => {
  it("defaults unknown roles to speaker", () => {
    expect(normalizeRole("judge")).toBe("judge");
    expect(normalizeRole("admin")).toBe("speaker");
    expect(normalizeRole(null)).toBe("speaker");
  });
});

describe("parseClientMessage", () => {
  it("accepts signals and known room events", () => {
    expect(parseClientMessage(JSON.stringify({ type: "signal", to: "p1", payload: { sdp: "x" } }))).toEqual({
      type: "signal",
      to: "p1",
      payload: { sdp: "x" },
    });
    expect(parseClientMessage(JSON.stringify({ type: "room-event", event: "mute-state", payload: { muted: true } }))).toEqual({
      type: "room-event",
      event: "mute-state",
      payload: { muted: true },
    });
  });

  it("rejects malformed, unknown and oversized messages", () => {
    expect(parseClientMessage("{nope")).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: "signal", payload: {} }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: "room-event", event: "take-over" }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: "signal", to: "p", payload: "x".repeat(MAX_MESSAGE_BYTES) }))).toBeNull();
  });
});

describe("roomIdForRound", () => {
  it("derives a stable room from the round", () => {
    expect(roomIdForRound({ id: 7, tournamentName: "Berkeley", roundLevel: "Octas" })).toBe("round-7-berkeley-octas");
    expect(roomIdForRound({ id: 7 })).toBe("round-7");
  });
});
