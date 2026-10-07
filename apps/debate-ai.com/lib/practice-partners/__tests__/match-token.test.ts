/**
 * @fileoverview The anonymous-match token: it round-trips for the viewer it
 * was minted for, and opens for nobody else, after expiry, or once tampered.
 */

import { describe, expect, it } from "vitest";
import { MATCH_TOKEN_TTL_SECONDS, openMatchToken, sealMatchToken } from "@/lib/practice-partners/match-token";

const SECRET = "test-secret";
const NOW = 1_800_000_000;

describe("match token", () => {
  it("opens to the matched debater for the viewer it was minted for", async () => {
    const token = await sealMatchToken(SECRET, { viewerId: "viewer", opponentId: "opponent-123" }, NOW);
    expect(token).not.toContain("opponent-123");
    expect(await openMatchToken(SECRET, token, "viewer", NOW + 60)).toBe("opponent-123");
  });

  it("looks different every time, even for the same debater", async () => {
    const a = await sealMatchToken(SECRET, { viewerId: "viewer", opponentId: "opponent" }, NOW);
    const b = await sealMatchToken(SECRET, { viewerId: "viewer", opponentId: "opponent" }, NOW);
    expect(a).not.toBe(b);
  });

  it("refuses another viewer, a different secret, expiry, tampering and junk", async () => {
    const token = await sealMatchToken(SECRET, { viewerId: "viewer", opponentId: "opponent" }, NOW);
    expect(await openMatchToken(SECRET, token, "someone-else", NOW)).toBeNull();
    expect(await openMatchToken("other-secret", token, "viewer", NOW)).toBeNull();
    expect(await openMatchToken(SECRET, token, "viewer", NOW + MATCH_TOKEN_TTL_SECONDS + 1)).toBeNull();
    const flipped = `${token.slice(0, -2)}${token.endsWith("AA") ? "BB" : "AA"}`;
    expect(await openMatchToken(SECRET, flipped, "viewer", NOW)).toBeNull();
    expect(await openMatchToken(SECRET, "not a token!", "viewer", NOW)).toBeNull();
    expect(await openMatchToken(SECRET, 42, "viewer", NOW)).toBeNull();
  });
});
