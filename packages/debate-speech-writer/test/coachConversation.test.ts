import { beforeEach, describe, expect, it } from "vitest";
import {
  appendCoachConversationTurn,
  clearCoachConversationHistory,
  listCoachConversationTurns,
} from "../src/state/coachConversation";

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

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listCoachConversationTurns", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listCoachConversationTurns()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("coachConversation", "{not json");
    expect(listCoachConversationTurns()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("coachConversation", JSON.stringify({ not: "an array" }));
    expect(listCoachConversationTurns()).toEqual([]);
  });
});

describe("appendCoachConversationTurn", () => {
  it("saves a turn with a generated id and timestamp, and returns it", () => {
    const turn = appendCoachConversationTurn({ question: "What is topicality?", answer: "A voting issue." });

    expect(turn.question).toBe("What is topicality?");
    expect(turn.answer).toBe("A voting issue.");
    expect(typeof turn.id).toBe("string");
    expect(turn.id.length).toBeGreaterThan(0);
    expect(typeof turn.askedAt).toBe("number");
    expect(listCoachConversationTurns()).toEqual([turn]);
  });

  it("appends turns in order, oldest first", () => {
    appendCoachConversationTurn({ question: "Q1", answer: "A1" });
    appendCoachConversationTurn({ question: "Q2", answer: "A2" });

    const turns = listCoachConversationTurns();
    expect(turns.map((t) => t.question)).toEqual(["Q1", "Q2"]);
  });

  it("generates a distinct id for each turn even when called in quick succession", () => {
    const a = appendCoachConversationTurn({ question: "Q1", answer: "A1" });
    const b = appendCoachConversationTurn({ question: "Q2", answer: "A2" });
    expect(a.id).not.toBe(b.id);
  });

  it("caps stored history at the most recent 50 turns", () => {
    for (let i = 0; i < 55; i++) {
      appendCoachConversationTurn({ question: `Q${i}`, answer: `A${i}` });
    }

    const turns = listCoachConversationTurns();
    expect(turns).toHaveLength(50);
    expect(turns[0]?.question).toBe("Q5");
    expect(turns[49]?.question).toBe("Q54");
  });
});

describe("clearCoachConversationHistory", () => {
  it("removes every persisted turn", () => {
    appendCoachConversationTurn({ question: "Q1", answer: "A1" });
    clearCoachConversationHistory();
    expect(listCoachConversationTurns()).toEqual([]);
  });

  it("is a no-op when there's nothing stored", () => {
    clearCoachConversationHistory();
    expect(listCoachConversationTurns()).toEqual([]);
  });
});
