/**
 * @fileoverview Covers the persistence seam's in-memory implementation, the
 * browser client that calls the vs-bot routes, the persona fallbacks the bot
 * falls back on when the model is unreachable, and the bot roster helpers.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createInMemoryDebateStore } from "../src/backend/store";
import {
  personalityClarificationRequest,
  personalityErrorResponse,
} from "../src/backend/persona-fallbacks";
import {
  ALL_BOTS,
  BOT_LEVELS,
  DEFAULT_PHASE_TIMINGS,
  MAX_PHASE_SECONDS,
  MAX_TOPIC_LENGTH,
  MIN_PHASE_SECONDS,
  PREDEFINED_TOPICS,
  findBot,
} from "../src/ui/bots";
import { getSpeechRecognition } from "../src/ui/speech-recognition";
import {
  DEFAULT_VSBOT_BASE_URL,
  concedeDebate,
  createDebate,
  judgeDebate,
  sendDebateMessage,
} from "../src/client";
import type { DebateVsBotRecord } from "../src/backend/types";

const record = (
  overrides: Partial<Omit<DebateVsBotRecord, "id">> = {},
): Omit<DebateVsBotRecord, "id"> => ({
  email: "debater@example.com",
  botName: "Rookie Rick",
  botLevel: "Easy",
  topic: "Should AI rule the world?",
  stance: "for",
  history: [],
  phaseTimings: [],
  createdAt: 1_700_000_000,
  ...overrides,
});

describe("createInMemoryDebateStore", () => {
  it("returns a fresh id per debate", async () => {
    const store = createInMemoryDebateStore();
    const first = await store.createDebate(record());
    const second = await store.createDebate(record());
    expect(first).not.toBe(second);
  });

  it("reads a debate back by id", async () => {
    const store = createInMemoryDebateStore();
    const id = await store.createDebate(record({ topic: "Free college" }));
    expect(await store.getDebate(id)).toMatchObject({
      id,
      topic: "Free college",
    });
  });

  it("returns null for an unknown id", async () => {
    expect(await createInMemoryDebateStore().getDebate("nope")).toBeNull();
  });

  it("returns the user's most recent debate", async () => {
    const store = createInMemoryDebateStore();
    await store.createDebate(record({ topic: "older", createdAt: 100 }));
    await store.createDebate(record({ topic: "newer", createdAt: 200 }));

    expect(await store.getLatestDebate("debater@example.com")).toMatchObject({
      topic: "newer",
    });
  });

  it("keeps each user's debates separate", async () => {
    const store = createInMemoryDebateStore();
    await store.createDebate(record({ email: "a@example.com", topic: "a" }));
    await store.createDebate(record({ email: "b@example.com", topic: "b" }));

    expect(await store.getLatestDebate("a@example.com")).toMatchObject({
      topic: "a",
    });
    expect(await store.getLatestDebate("c@example.com")).toBeNull();
  });

  it("appends a turn to a debate's history", async () => {
    const store = createInMemoryDebateStore();
    const id = await store.createDebate(record());

    await store.appendMessage?.(id, { sender: "Bot", text: "my turn" });

    expect((await store.getDebate(id))?.history).toEqual([
      { sender: "Bot", text: "my turn" },
    ]);
  });

  it("ignores an append to an unknown debate", async () => {
    const store = createInMemoryDebateStore();
    await expect(
      store.appendMessage?.("nope", { sender: "Bot", text: "x" }),
    ).resolves.toBeUndefined();
  });

  it("records a debate's outcome", async () => {
    const store = createInMemoryDebateStore();
    const id = await store.createDebate(record());
    await store.setOutcome(id, "User conceded");
    expect((await store.getDebate(id))?.outcome).toBe("User conceded");
  });

  it("ignores an outcome for an unknown debate", async () => {
    await expect(
      createInMemoryDebateStore().setOutcome("nope", "x"),
    ).resolves.toBeUndefined();
  });

  it("starts every user at a zeroed gamification profile", async () => {
    expect(
      await createInMemoryDebateStore().getGamificationProfile?.("u1"),
    ).toEqual({ score: 0, badges: [], currentStreak: 0 });
  });

  it("applies an award to the profile", async () => {
    const store = createInMemoryDebateStore();
    await store.applyGamificationAward?.(
      "u1",
      { points: 10, action: "win", badgesAwarded: ["First Win"], newScore: 10 },
      { debateType: "user_vs_bot", topic: "t", result: "win" },
    );

    expect(await store.getGamificationProfile?.("u1")).toMatchObject({
      score: 10,
      badges: ["First Win"],
    });
  });

  it("accumulates badges across rounds", async () => {
    const store = createInMemoryDebateStore();
    const context = {
      debateType: "user_vs_bot",
      topic: "t",
      result: "win" as const,
    };
    await store.applyGamificationAward?.(
      "u1",
      { points: 10, action: "win", badgesAwarded: ["First Win"], newScore: 10 },
      context,
    );
    await store.applyGamificationAward?.(
      "u1",
      { points: 10, action: "win", badgesAwarded: ["Streak"], newScore: 20 },
      context,
    );

    expect(await store.getGamificationProfile?.("u1")).toMatchObject({
      score: 20,
      badges: ["First Win", "Streak"],
    });
  });
});

describe("persona fallbacks", () => {
  it("stays in character when generation fails", () => {
    const line = personalityErrorResponse("Yoda", "Something went wrong.");
    expect(line).not.toBe("Something went wrong.");
    expect(line).toContain("Dagobah");
  });

  it("opens the apology with the persona's own catchphrase", () => {
    expect(personalityErrorResponse("Darth Vader", "fallback")).toMatch(
      /disturbing/i,
    );
  });

  it("falls back to the caller's line for a bot with no scripted apology", () => {
    expect(personalityErrorResponse("Nobody", "Something went wrong.")).toBe(
      "Something went wrong.",
    );
  });

  it("asks for clarification in character", () => {
    expect(personalityClarificationRequest("Rafiki")).toContain("Haha!");
  });

  it("falls back to a plain clarification for an unknown bot", () => {
    expect(personalityClarificationRequest("Nobody")).toBe(
      "Could you please clarify your question or provide an opening statement?",
    );
  });

  it("scripts an apology and a clarification for every bot on the roster", () => {
    for (const bot of ALL_BOTS) {
      expect(personalityErrorResponse(bot.name, "DEFAULT"), bot.name).not.toBe(
        "DEFAULT",
      );
      expect(personalityClarificationRequest(bot.name), bot.name).not.toBe(
        "Could you please clarify your question or provide an opening statement?",
      );
    }
  });
});

describe("bot roster", () => {
  it("finds a bot by name", () => {
    expect(findBot("Yoda").name).toBe("Yoda");
  });

  it.each([null, undefined, "", "Nobody"])(
    "falls back to the first bot for %j",
    (name) => {
      expect(findBot(name)).toBe(ALL_BOTS[0]);
    },
  );

  it("gives every bot a level from the published ladder", () => {
    for (const bot of ALL_BOTS) {
      expect(BOT_LEVELS, bot.name).toContain(bot.level);
    }
  });

  it("gives every bot a name, quote and rating", () => {
    for (const bot of ALL_BOTS) {
      expect(bot.name, bot.name).toBeTruthy();
      expect(bot.quote, bot.name).toBeTruthy();
      expect(bot.rating, bot.name).toBeGreaterThan(0);
    }
  });

  it("names each bot only once", () => {
    const names = ALL_BOTS.map((b) => b.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("offers starter topics inside the length cap", () => {
    expect(PREDEFINED_TOPICS.length).toBeGreaterThan(0);
    for (const topic of PREDEFINED_TOPICS) {
      expect(topic.length).toBeLessThanOrEqual(MAX_TOPIC_LENGTH);
    }
  });

  it("keeps every default phase clock inside the allowed bounds", () => {
    expect(DEFAULT_PHASE_TIMINGS.length).toBeGreaterThan(0);
    for (const phase of DEFAULT_PHASE_TIMINGS) {
      expect(phase.time, phase.name).toBeGreaterThanOrEqual(MIN_PHASE_SECONDS);
      expect(phase.time, phase.name).toBeLessThanOrEqual(MAX_PHASE_SECONDS);
    }
  });
});

describe("getSpeechRecognition", () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).window;
  });

  it("reports nothing outside a browser", () => {
    expect(getSpeechRecognition()).toBeNull();
  });

  it("reports nothing when the browser lacks the api", () => {
    (globalThis as Record<string, unknown>).window = {};
    expect(getSpeechRecognition()).toBeNull();
  });

  it("prefers the unprefixed constructor", () => {
    const standard = class {};
    const prefixed = class {};
    (globalThis as Record<string, unknown>).window = {
      SpeechRecognition: standard,
      webkitSpeechRecognition: prefixed,
    };
    expect(getSpeechRecognition()).toBe(standard);
  });

  it("falls back to the webkit-prefixed constructor", () => {
    const prefixed = class {};
    (globalThis as Record<string, unknown>).window = {
      webkitSpeechRecognition: prefixed,
    };
    expect(getSpeechRecognition()).toBe(prefixed);
  });
});

describe("vs-bot browser client", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  const ok = (body: unknown) =>
    ({ ok: true, json: async () => body }) as unknown as Response;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const urlOf = () => fetchMock.mock.lastCall?.[0] as string;
  const initOf = () => fetchMock.mock.lastCall?.[1] as RequestInit;
  const bodyOf = () => JSON.parse(initOf().body as string);

  it("posts to the app's own routes by default", async () => {
    fetchMock.mockResolvedValue(ok({ debateId: "d1" }));
    await createDebate({ botName: "Yoda", botLevel: "Hard", topic: "t" } as never);
    expect(urlOf()).toBe(`${DEFAULT_VSBOT_BASE_URL}/create`);
  });

  it("sends the session cookie rather than a bearer token", async () => {
    fetchMock.mockResolvedValue(ok({ debateId: "d1" }));
    await createDebate({ botName: "Yoda", botLevel: "Hard", topic: "t" } as never);

    expect(initOf().credentials).toBe("include");
    expect(initOf().headers).toEqual({ "Content-Type": "application/json" });
  });

  it("honors a base url override", async () => {
    fetchMock.mockResolvedValue(ok({ debateId: "d1" }));
    await createDebate({ botName: "Yoda" } as never, {
      baseUrl: "https://api.test/vsbot",
    });
    expect(urlOf()).toBe("https://api.test/vsbot/create");
  });

  it("converts the create response's stored timings back to one duration", async () => {
    fetchMock.mockResolvedValue(
      ok({
        debateId: "d1",
        phaseTimings: [
          { name: "Opening Statements", userTime: 240, botTime: 180 },
        ],
      }),
    );

    const result = await createDebate({ botName: "Yoda" } as never);

    expect(result.phaseTimings).toEqual([
      { name: "Opening Statements", time: 240 },
    ]);
  });

  it("leaves the timings undefined when the server sends none", async () => {
    fetchMock.mockResolvedValue(ok({ debateId: "d1" }));
    expect((await createDebate({ botName: "Yoda" } as never)).phaseTimings)
      .toBeUndefined();
  });

  it("asks the bot for its next turn", async () => {
    fetchMock.mockResolvedValue(ok({ response: "my turn" }));
    const result = await sendDebateMessage({
      botName: "Yoda",
      debateId: "d1",
    } as never);

    expect(urlOf()).toContain("/debate");
    expect(result).toEqual({ response: "my turn" });
  });

  it("concedes with the transcript so far", async () => {
    fetchMock.mockResolvedValue(ok({ message: "conceded" }));
    await concedeDebate("d1", [{ sender: "User", text: "I give up" }]);

    expect(urlOf()).toContain("/concede");
    expect(bodyOf()).toEqual({
      debateId: "d1",
      history: [{ sender: "User", text: "I give up" }],
    });
  });

  it("concedes with an empty transcript when none is given", async () => {
    fetchMock.mockResolvedValue(ok({ message: "conceded" }));
    await concedeDebate("d1");
    expect(bodyOf()).toEqual({ debateId: "d1", history: [] });
  });

  it("asks the judge to score a finished round", async () => {
    fetchMock.mockResolvedValue(ok({ result: "win" }));
    const result = await judgeDebate({ history: [], debateId: "d1" });

    expect(urlOf()).toContain("/judge");
    expect(result).toEqual({ result: "win" });
  });

  it("surfaces the server's error message", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "model unavailable" }),
    } as unknown as Response);

    await expect(judgeDebate({ history: [] })).rejects.toThrow(
      "Failed to judge debate: model unavailable",
    );
  });

  it("falls back to a bare failure message for a non-JSON error body", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("not json");
      },
    } as unknown as Response);

    await expect(judgeDebate({ history: [] })).rejects.toThrow(
      "Failed to judge debate",
    );
  });

  it("passes an abort signal through", async () => {
    fetchMock.mockResolvedValue(ok({ debateId: "d1" }));
    const controller = new AbortController();
    await createDebate({ botName: "Yoda" } as never, {
      signal: controller.signal,
    });
    expect(initOf().signal).toBe(controller.signal);
  });
});
