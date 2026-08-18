import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRESENCE_STALE_AFTER_MS,
  buildPresenceSummaryText,
  listActiveContributors,
  recordPresenceHeartbeat,
  type PresenceHeartbeat,
} from "../src/lib/topic-presence";

const NOW = Date.parse("2026-08-18T12:00:00Z");

describe("recordPresenceHeartbeat", () => {
  it("adds a new heartbeat for a topic/contributor pair not seen before", () => {
    const result = recordPresenceHeartbeat([], "solvency", "alice", NOW);
    expect(result).toEqual([{ topic: "solvency", contributorId: "alice", lastSeenAt: NOW }]);
  });

  it("upserts — bumping an existing contributor's heartbeat rather than duplicating it", () => {
    const first = recordPresenceHeartbeat([], "solvency", "alice", NOW);
    const bumped = recordPresenceHeartbeat(first, "solvency", "alice", NOW + 60_000);

    expect(bumped).toEqual([{ topic: "solvency", contributorId: "alice", lastSeenAt: NOW + 60_000 }]);
  });

  it("keeps separate heartbeats for the same contributor across different topics", () => {
    const first = recordPresenceHeartbeat([], "solvency", "alice", NOW);
    const both = recordPresenceHeartbeat(first, "topicality", "alice", NOW);

    expect(both).toEqual([
      { topic: "solvency", contributorId: "alice", lastSeenAt: NOW },
      { topic: "topicality", contributorId: "alice", lastSeenAt: NOW },
    ]);
  });

  it("keeps separate heartbeats for different contributors on the same topic", () => {
    const first = recordPresenceHeartbeat([], "solvency", "alice", NOW);
    const both = recordPresenceHeartbeat(first, "solvency", "bob", NOW);

    expect(both).toEqual([
      { topic: "solvency", contributorId: "alice", lastSeenAt: NOW },
      { topic: "solvency", contributorId: "bob", lastSeenAt: NOW },
    ]);
  });

  it("does not mutate the input array", () => {
    const input: PresenceHeartbeat[] = [];
    recordPresenceHeartbeat(input, "solvency", "alice", NOW);
    expect(input).toEqual([]);
  });
});

describe("listActiveContributors", () => {
  const heartbeats: PresenceHeartbeat[] = [
    { topic: "solvency", contributorId: "alice", lastSeenAt: NOW },
    { topic: "solvency", contributorId: "bob", lastSeenAt: NOW - 4 * 60 * 1000 },
    { topic: "solvency", contributorId: "carol", lastSeenAt: NOW - 10 * 60 * 1000 },
    { topic: "topicality", contributorId: "dave", lastSeenAt: NOW },
  ];

  it("returns only contributors within the default freshness window, most recent first", () => {
    expect(listActiveContributors(heartbeats, "solvency", NOW)).toEqual([
      { contributorId: "alice", lastSeenAt: NOW },
      { contributorId: "bob", lastSeenAt: NOW - 4 * 60 * 1000 },
    ]);
  });

  it("excludes a heartbeat exactly at the stale boundary plus one millisecond", () => {
    const boundary = NOW - DEFAULT_PRESENCE_STALE_AFTER_MS - 1;
    const result = listActiveContributors(
      [{ topic: "solvency", contributorId: "alice", lastSeenAt: boundary }],
      "solvency",
      NOW,
    );
    expect(result).toEqual([]);
  });

  it("includes a heartbeat exactly at the stale boundary", () => {
    const boundary = NOW - DEFAULT_PRESENCE_STALE_AFTER_MS;
    const result = listActiveContributors(
      [{ topic: "solvency", contributorId: "alice", lastSeenAt: boundary }],
      "solvency",
      NOW,
    );
    expect(result).toEqual([{ contributorId: "alice", lastSeenAt: boundary }]);
  });

  it("scopes to the requested topic only", () => {
    expect(listActiveContributors(heartbeats, "topicality", NOW)).toEqual([
      { contributorId: "dave", lastSeenAt: NOW },
    ]);
  });

  it("returns an empty list for a topic with no heartbeats", () => {
    expect(listActiveContributors(heartbeats, "inherency", NOW)).toEqual([]);
  });

  it("respects a custom staleAfterMs window", () => {
    expect(listActiveContributors(heartbeats, "solvency", NOW, 5 * 60 * 1000)).toEqual([
      { contributorId: "alice", lastSeenAt: NOW },
      { contributorId: "bob", lastSeenAt: NOW - 4 * 60 * 1000 },
    ]);
    expect(listActiveContributors(heartbeats, "solvency", NOW, 60_000)).toEqual([
      { contributorId: "alice", lastSeenAt: NOW },
    ]);
  });

  it("excludes a heartbeat timestamped after now (clock skew)", () => {
    const result = listActiveContributors(
      [{ topic: "solvency", contributorId: "alice", lastSeenAt: NOW + 60_000 }],
      "solvency",
      NOW,
    );
    expect(result).toEqual([]);
  });
});

describe("buildPresenceSummaryText", () => {
  it("reports no one active when the list is empty", () => {
    expect(buildPresenceSummaryText([])).toBe("No one active right now.");
  });

  it("lists active contributors by id, in the order given", () => {
    expect(
      buildPresenceSummaryText([
        { contributorId: "alice", lastSeenAt: NOW },
        { contributorId: "bob", lastSeenAt: NOW - 1000 },
      ]),
    ).toBe("2 active now: alice, bob");
  });

  it("handles a single active contributor", () => {
    expect(buildPresenceSummaryText([{ contributorId: "alice", lastSeenAt: NOW }])).toBe("1 active now: alice");
  });
});
