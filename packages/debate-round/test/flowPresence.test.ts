import { beforeEach, describe, expect, it } from "vitest";
import {
  listActiveEditorsForFlow,
  listFlowPresenceHeartbeats,
  mergeRemoteFlowPresence,
} from "../src/state/flowPresence";
import type { FlowPresenceHeartbeat } from "../src/flow/flow-presence";

/** Minimal in-memory `localStorage` mock — this package's Vitest environment is `node`, with no DOM. */
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

const NOW = Date.parse("2026-09-04T12:00:00Z");

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listFlowPresenceHeartbeats", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listFlowPresenceHeartbeats()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("flowPresenceHeartbeats", "{not json");
    expect(listFlowPresenceHeartbeats()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("flowPresenceHeartbeats", JSON.stringify({ not: "an array" }));
    expect(listFlowPresenceHeartbeats()).toEqual([]);
  });
});

describe("mergeRemoteFlowPresence", () => {
  it("caches a freshly pulled heartbeat set for a flow", () => {
    const remote: FlowPresenceHeartbeat[] = [{ flowId: 7, authorId: "alice", lastSeenAt: NOW }];
    mergeRemoteFlowPresence(7, remote);
    expect(listFlowPresenceHeartbeats()).toEqual(remote);
  });

  it("replaces a flow's cached heartbeats wholesale rather than upserting individual rows", () => {
    mergeRemoteFlowPresence(7, [
      { flowId: 7, authorId: "alice", lastSeenAt: NOW },
      { flowId: 7, authorId: "bob", lastSeenAt: NOW },
    ]);
    // bob stopped polling — the server no longer reports them, so a fresh
    // pull with only alice should drop bob entirely, not just leave him stale.
    mergeRemoteFlowPresence(7, [{ flowId: 7, authorId: "alice", lastSeenAt: NOW + 4_000 }]);

    expect(listFlowPresenceHeartbeats()).toEqual([{ flowId: 7, authorId: "alice", lastSeenAt: NOW + 4_000 }]);
  });

  it("leaves other flows' cached heartbeats untouched", () => {
    mergeRemoteFlowPresence(7, [{ flowId: 7, authorId: "alice", lastSeenAt: NOW }]);
    mergeRemoteFlowPresence(9, [{ flowId: 9, authorId: "carol", lastSeenAt: NOW }]);

    expect(listFlowPresenceHeartbeats()).toEqual([
      { flowId: 7, authorId: "alice", lastSeenAt: NOW },
      { flowId: 9, authorId: "carol", lastSeenAt: NOW },
    ]);
  });
});

describe("listActiveEditorsForFlow", () => {
  it("reads active editors from the cached, last-pulled heartbeat snapshot", () => {
    mergeRemoteFlowPresence(7, [
      { flowId: 7, authorId: "alice", lastSeenAt: NOW },
      { flowId: 7, authorId: "bob", lastSeenAt: NOW - 60_000 },
    ]);

    expect(listActiveEditorsForFlow(7, NOW)).toEqual([{ authorId: "alice", lastSeenAt: NOW }]);
  });

  it("supports excluding the viewer's own id", () => {
    mergeRemoteFlowPresence(7, [
      { flowId: 7, authorId: "alice", lastSeenAt: NOW },
      { flowId: 7, authorId: "bob", lastSeenAt: NOW },
    ]);

    expect(listActiveEditorsForFlow(7, NOW, { excludeAuthorId: "alice" })).toEqual([
      { authorId: "bob", lastSeenAt: NOW },
    ]);
  });

  it("returns an empty list for a flow with no cached heartbeats", () => {
    expect(listActiveEditorsForFlow(42, NOW)).toEqual([]);
  });
});
