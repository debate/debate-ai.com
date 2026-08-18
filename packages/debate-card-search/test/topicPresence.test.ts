import { beforeEach, describe, expect, it } from "vitest";
import {
  listPersistedActiveContributors,
  listPresenceHeartbeats,
  recordPersistedPresenceHeartbeat,
} from "../src/state/topicPresence";

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

const NOW = Date.parse("2026-08-18T12:00:00Z");

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listPresenceHeartbeats", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listPresenceHeartbeats()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("topicPresenceHeartbeats", "{not json");
    expect(listPresenceHeartbeats()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("topicPresenceHeartbeats", JSON.stringify({ not: "an array" }));
    expect(listPresenceHeartbeats()).toEqual([]);
  });
});

describe("recordPersistedPresenceHeartbeat", () => {
  it("persists a new heartbeat", () => {
    recordPersistedPresenceHeartbeat("solvency", "alice", NOW);
    expect(listPresenceHeartbeats()).toEqual([{ topic: "solvency", contributorId: "alice", lastSeenAt: NOW }]);
  });

  it("upserts a contributor's heartbeat for the same topic rather than duplicating it", () => {
    recordPersistedPresenceHeartbeat("solvency", "alice", NOW);
    recordPersistedPresenceHeartbeat("solvency", "alice", NOW + 60_000);

    expect(listPresenceHeartbeats()).toEqual([
      { topic: "solvency", contributorId: "alice", lastSeenAt: NOW + 60_000 },
    ]);
  });

  it("persists heartbeats for multiple contributors and topics independently", () => {
    recordPersistedPresenceHeartbeat("solvency", "alice", NOW);
    recordPersistedPresenceHeartbeat("solvency", "bob", NOW);
    recordPersistedPresenceHeartbeat("topicality", "alice", NOW);

    expect(listPresenceHeartbeats()).toEqual([
      { topic: "solvency", contributorId: "alice", lastSeenAt: NOW },
      { topic: "solvency", contributorId: "bob", lastSeenAt: NOW },
      { topic: "topicality", contributorId: "alice", lastSeenAt: NOW },
    ]);
  });
});

describe("listPersistedActiveContributors", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listPersistedActiveContributors("solvency", NOW)).toEqual([]);
  });

  it("lists only fresh, topic-scoped contributors, most recent first", () => {
    recordPersistedPresenceHeartbeat("solvency", "alice", NOW);
    recordPersistedPresenceHeartbeat("solvency", "bob", NOW - 10 * 60 * 1000);
    recordPersistedPresenceHeartbeat("topicality", "carol", NOW);

    expect(listPersistedActiveContributors("solvency", NOW)).toEqual([
      { contributorId: "alice", lastSeenAt: NOW },
    ]);
  });

  it("respects a custom staleAfterMs window", () => {
    recordPersistedPresenceHeartbeat("solvency", "alice", NOW - 10 * 60 * 1000);
    expect(listPersistedActiveContributors("solvency", NOW, 20 * 60 * 1000)).toEqual([
      { contributorId: "alice", lastSeenAt: NOW - 10 * 60 * 1000 },
    ]);
  });
});
