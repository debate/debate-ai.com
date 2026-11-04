/**
 * @fileoverview The Speech AI pipeline's argument step: the model's pick of
 * the affirmative's argument and the 2NR's argument goes through
 * write-language and lands in the round's `videos.arg_1ac` / `arg_2nr`,
 * except on a row an admin edited.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

const chat = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai/write-language-chat", () => ({ writeLanguageChat: chat }));

import * as schema from "../../database/schema";
import { applySchema } from "../../database/__tests__/schema-sql";
import { videos } from "../../database/schema";
import { pickRoundArguments, saveRoundArguments } from "../speech-analysis";

async function freshDb() {
  const client = createClient({ url: ":memory:" });
  await applySchema(client);
  const db = drizzle(client, { schema });
  await db.insert(videos).values({
    videoId: "r1",
    source: "round",
    title: "Finals",
    publishedAt: "2024-09-01",
    publishedMs: 0,
    channel: "c",
    description: "",
    seasonYear: 2025,
    searchText: "",
    arg1ac: "Policy",
    arg2nr: "K",
  });
  return db;
}

const row = { title: "Finals", affTeam: "Kentucky", negTeam: "Michigan", judgeDecision: null };
const speeches = [
  { name: "1AC", startSeconds: 0, endSeconds: 480, transcript: "We affirm the space plan." },
  { name: "2NR", startSeconds: 5000, endSeconds: 5300, transcript: "Extend the cap K." },
];

describe("pickRoundArguments", () => {
  it("asks write-language with the round's deciding speeches and reads the tags", async () => {
    chat.mockResolvedValueOnce({ text: '{"aff":["Space Col"],"neg":["Cap K","Framework"]}' });
    const pick = await pickRoundArguments(
      { provider: "openrouter", key: "k", own: false } as any,
      row,
      { format: "policy" },
      speeches,
      null,
    );
    expect(pick).toEqual({ aff: "Space Col", neg: "Cap K, Framework" });
    const request = chat.mock.calls[0][0];
    expect(request.model).toBe("openrouter/free");
    expect(request.messages[0].content).toContain("Extend the cap K.");
  });

  it("throws when the reply names nothing", async () => {
    chat.mockResolvedValueOnce({ text: '{"aff":[],"neg":[]}' });
    await expect(
      pickRoundArguments({ provider: "anthropic", key: "k" } as any, row, { format: "policy" }, speeches, null),
    ).rejects.toThrow(/no argument/);
  });
});

describe("saveRoundArguments", () => {
  it("replaces the round's arguments with the pick", async () => {
    const db = await freshDb();
    expect(await saveRoundArguments(db, { videoId: "r1", adminEdited: false }, { aff: "Space Col", neg: "Cap K" })).toBe(true);
    const [saved] = await db.select().from(videos).where(eq(videos.videoId, "r1"));
    expect(saved.arg1ac).toBe("Space Col");
    expect(saved.arg2nr).toBe("Cap K");
  });

  it("keeps a side the model couldn't tell", async () => {
    const db = await freshDb();
    await saveRoundArguments(db, { videoId: "r1" }, { aff: null, neg: "Cap K" });
    const [saved] = await db.select().from(videos).where(eq(videos.videoId, "r1"));
    expect(saved.arg1ac).toBe("Policy");
    expect(saved.arg2nr).toBe("Cap K");
  });

  it("leaves an admin-edited row alone", async () => {
    const db = await freshDb();
    expect(await saveRoundArguments(db, { videoId: "r1", adminEdited: true }, { aff: "X", neg: "Y" })).toBe(false);
    const [saved] = await db.select().from(videos).where(eq(videos.videoId, "r1"));
    expect(saved.arg1ac).toBe("Policy");
  });
});
