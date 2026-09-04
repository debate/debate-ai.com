import { describe, expect, it } from "vitest";
import {
  DEFAULT_FLOW_PRESENCE_STALE_AFTER_MS,
  buildFlowPresenceSummaryText,
  listActiveFlowEditors,
  recordFlowPresenceHeartbeat,
  type FlowPresenceHeartbeat,
} from "../src/flow/flow-presence";

const NOW = Date.parse("2026-09-04T12:00:00Z");

describe("recordFlowPresenceHeartbeat", () => {
  it("adds a new heartbeat for a flow/author pair not seen before", () => {
    const result = recordFlowPresenceHeartbeat([], 7, "alice", NOW);
    expect(result).toEqual([{ flowId: 7, authorId: "alice", lastSeenAt: NOW }]);
  });

  it("upserts — bumping an existing author's heartbeat rather than duplicating it", () => {
    const first = recordFlowPresenceHeartbeat([], 7, "alice", NOW);
    const bumped = recordFlowPresenceHeartbeat(first, 7, "alice", NOW + 5_000);

    expect(bumped).toEqual([{ flowId: 7, authorId: "alice", lastSeenAt: NOW + 5_000 }]);
  });

  it("keeps separate heartbeats for the same author across different flows", () => {
    const first = recordFlowPresenceHeartbeat([], 7, "alice", NOW);
    const both = recordFlowPresenceHeartbeat(first, 9, "alice", NOW);

    expect(both).toEqual([
      { flowId: 7, authorId: "alice", lastSeenAt: NOW },
      { flowId: 9, authorId: "alice", lastSeenAt: NOW },
    ]);
  });

  it("keeps separate heartbeats for different authors on the same flow", () => {
    const first = recordFlowPresenceHeartbeat([], 7, "alice", NOW);
    const both = recordFlowPresenceHeartbeat(first, 7, "bob", NOW);

    expect(both).toEqual([
      { flowId: 7, authorId: "alice", lastSeenAt: NOW },
      { flowId: 7, authorId: "bob", lastSeenAt: NOW },
    ]);
  });

  it("does not mutate the input array", () => {
    const input: FlowPresenceHeartbeat[] = [];
    recordFlowPresenceHeartbeat(input, 7, "alice", NOW);
    expect(input).toEqual([]);
  });
});

describe("listActiveFlowEditors", () => {
  const heartbeats: FlowPresenceHeartbeat[] = [
    { flowId: 7, authorId: "alice", lastSeenAt: NOW },
    { flowId: 7, authorId: "bob", lastSeenAt: NOW - 10_000 },
    { flowId: 7, authorId: "carol", lastSeenAt: NOW - 30_000 },
    { flowId: 9, authorId: "dave", lastSeenAt: NOW },
  ];

  it("returns only authors within the default freshness window, most recent first", () => {
    expect(listActiveFlowEditors(heartbeats, 7, NOW)).toEqual([
      { authorId: "alice", lastSeenAt: NOW },
      { authorId: "bob", lastSeenAt: NOW - 10_000 },
    ]);
  });

  it("excludes a heartbeat exactly at the stale boundary plus one millisecond", () => {
    const boundary = NOW - DEFAULT_FLOW_PRESENCE_STALE_AFTER_MS - 1;
    const result = listActiveFlowEditors(
      [{ flowId: 7, authorId: "alice", lastSeenAt: boundary }],
      7,
      NOW,
    );
    expect(result).toEqual([]);
  });

  it("includes a heartbeat exactly at the stale boundary", () => {
    const boundary = NOW - DEFAULT_FLOW_PRESENCE_STALE_AFTER_MS;
    const result = listActiveFlowEditors(
      [{ flowId: 7, authorId: "alice", lastSeenAt: boundary }],
      7,
      NOW,
    );
    expect(result).toEqual([{ authorId: "alice", lastSeenAt: boundary }]);
  });

  it("scopes to the requested flow only", () => {
    expect(listActiveFlowEditors(heartbeats, 9, NOW)).toEqual([{ authorId: "dave", lastSeenAt: NOW }]);
  });

  it("returns an empty list for a flow with no heartbeats", () => {
    expect(listActiveFlowEditors(heartbeats, 42, NOW)).toEqual([]);
  });

  it("respects a custom staleAfterMs window", () => {
    expect(listActiveFlowEditors(heartbeats, 7, NOW, { staleAfterMs: 15_000 })).toEqual([
      { authorId: "alice", lastSeenAt: NOW },
      { authorId: "bob", lastSeenAt: NOW - 10_000 },
    ]);
    expect(listActiveFlowEditors(heartbeats, 7, NOW, { staleAfterMs: 5_000 })).toEqual([
      { authorId: "alice", lastSeenAt: NOW },
    ]);
  });

  it("excludes a heartbeat timestamped after now (clock skew)", () => {
    const result = listActiveFlowEditors(
      [{ flowId: 7, authorId: "alice", lastSeenAt: NOW + 5_000 }],
      7,
      NOW,
    );
    expect(result).toEqual([]);
  });

  it("excludes the given excludeAuthorId — the viewer's own heartbeat", () => {
    expect(listActiveFlowEditors(heartbeats, 7, NOW, { excludeAuthorId: "alice" })).toEqual([
      { authorId: "bob", lastSeenAt: NOW - 10_000 },
    ]);
  });
});

describe("buildFlowPresenceSummaryText", () => {
  it("reports no one else editing when the list is empty", () => {
    expect(buildFlowPresenceSummaryText([])).toBe("No one else editing right now.");
  });

  it("lists active editors by id, in the order given, singular wording for one", () => {
    expect(buildFlowPresenceSummaryText([{ authorId: "alice", lastSeenAt: NOW }])).toBe(
      "1 teammate editing now: alice",
    );
  });

  it("uses plural wording for more than one", () => {
    expect(
      buildFlowPresenceSummaryText([
        { authorId: "alice", lastSeenAt: NOW },
        { authorId: "bob", lastSeenAt: NOW - 1_000 },
      ]),
    ).toBe("2 teammates editing now: alice, bob");
  });
});
