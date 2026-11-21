/** @fileoverview Restoring saved work from an export file, against in-memory SQLite. */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { MAX_SAVED_JUDGE_DECISION_BYTES, MAX_SAVED_WORD_COUNT_ROUND_BYTES } from "@debate-ai/practice-rounds";
import { MAX_SAVED_PRACTICE_DEBATE_BYTES } from "@debate-ai/practice-vs-ai/backend";
import { describe, expect, it } from "vitest";
import * as schema from "../../database/schema";
import { applySchema } from "../../database/__tests__/schema-sql";
import { documents, practiceVsAiDebates, savedDrillSets, savedFlows, savedJudgeDecisions, savedRounds, savedSpeechSendLog, savedToolRecords, savedWordCountRounds, user } from "../../database/schema";
import { MAX_TOOL_RECORD_BYTES } from "@debate-ai/research-evidence/src/account-sync/toolRecordCollections";
import { exportAllOwnSavedData, exportOwnSavedItem, listOwnSavedItems, wordCountRoundTitle } from "../saved-data-items";
import { MAX_RESTORE_ITEMS, MAX_RESTORE_TOOL_RECORDS, parseRestoreFile, restoreOwnSavedData, restoreOwnToolRecords } from "../saved-data-restore";

async function freshDb() {
  const client = createClient({ url: ":memory:" });
  await applySchema(client);
  const db = drizzle(client, { schema });
  const row = (id: string) => ({ id, name: id, email: `${id}@example.com`, createdAt: new Date("2024-09-01"), updatedAt: new Date("2024-09-01") });
  await db.insert(user).values([row("a"), row("b")]);
  return db;
}

const flow = (id: number, content = "1AC") => ({ id, content, level: 0, columns: ["1AC", "1NC"], invert: false, focus: false, index: 0, lastFocus: [], children: [] });

const round = (id: number, flowIds: number[] = []) => ({
  id,
  tournamentName: "TOC",
  roundLevel: "Finals",
  debaters: { aff: ["A", "B"], neg: ["C", "D"] },
  judges: ["J"],
  flowIds,
  timestamp: 1,
  status: "completed",
});

const roundJudgeDecision = (id: string) => ({
  id,
  roundId: "round-1",
  paradigmName: "Tabula Rasa",
  sideNames: { primary: "Aff", secondary: "Neg" },
  result: { winner: "primary", keyVotingIssues: ["Impact calculus"], rationale: "Aff outweighs." },
  generatedAt: 1,
});

const speechEntry = (id: string) => ({ id, text: "Tariffs raise prices.", preview: "Tariffs raise prices.", atEnd: true, sentAt: 1 });

const wordCountRound = (roundId: string) => ({
  roundId,
  styleKey: "practicePublicForum",
  submittedSpeeches: [{ name: "AC", speaker: "aff", text: "Tariffs raise prices." }],
  createdAt: 1,
});

const drillSet = (roundId: string) => ({
  roundId,
  sideKey: "aff",
  drills: [{ kind: "frontline", rowIndex: 0, prompt: "Frontline the price turn.", difficulty: "medium" }],
  completedDrillIndexes: [0],
});

const STARTED = 1_762_000_000;

const vsBot = (over: Record<string, unknown> = {}) => ({
  id: "12",
  email: "old@example.com",
  botName: "Rookie Rick",
  botLevel: "Easy",
  topic: "Tariffs do more harm than good",
  stance: "against",
  history: [{ sender: "User", text: "Tariffs raise prices.", phase: "Opening Statements" }],
  phaseTimings: [{ name: "Opening Statements", userTime: 240, botTime: 240 }],
  outcome: "User conceded",
  createdAt: STARTED,
  ...over,
});

const NOW = new Date("2026-11-11T00:00:00Z");

describe("parseRestoreFile", () => {
  it("reads a single-item export", () => {
    const parsed = parseRestoreFile({ kind: "flows", id: 3, title: "1AC", data: flow(3) });
    expect(parsed).toMatchObject({ ok: true, entries: [{ kind: "flows", doc: { id: 3 } }] });
  });

  it("reads every kind of a bulk archive and ignores non-object entries", () => {
    const parsed = parseRestoreFile({ exportedAt: "2026-01-01", docs: [{ id: 1 }, "junk"], flows: [{ id: 2 }], rounds: [], practiceRounds: [{ id: 4 }] });
    expect(parsed.ok && parsed.entries.map((e) => e.kind)).toEqual(["docs", "flows", "practiceRounds"]);
  });

  it("rejects files that aren't exports, are malformed, empty or too big", () => {
    expect(parseRestoreFile(null)).toMatchObject({ ok: false });
    expect(parseRestoreFile([1, 2])).toMatchObject({ ok: false });
    expect(parseRestoreFile({ kind: "watchHistory", id: 1 })).toMatchObject({ ok: false });
    expect(parseRestoreFile({ exportedAt: "x", flows: "nope" })).toMatchObject({ ok: false, error: expect.stringContaining("flows") });
    expect(parseRestoreFile({ exportedAt: "x", docs: [] })).toMatchObject({ ok: false, error: expect.stringContaining("nothing") });
    const many = Array.from({ length: MAX_RESTORE_ITEMS + 1 }, (_, i) => ({ id: i }));
    expect(parseRestoreFile({ exportedAt: "x", docs: many })).toMatchObject({ ok: false, error: expect.stringContaining("smaller") });
  });
});

describe("restoreOwnSavedData", () => {
  it("brings back a deleted flow and round under their original ids", async () => {
    const db = await freshDb();
    const report = await restoreOwnSavedData(
      db,
      "a",
      [
        { kind: "flows", doc: { kind: "flows", id: 7, createdAt: "2025-01-02T00:00:00.000Z", data: flow(7, "Tariffs 1AC") } },
        { kind: "rounds", doc: { kind: "rounds", id: 9, data: round(9, [7]) } },
      ],
      { now: NOW },
    );
    expect(report).toEqual({ restored: { docs: 0, flows: 1, rounds: 1, practiceRounds: 0, wordCountRounds: 0, drills: 0, judgeDecisions: 0, speeches: 0 }, restoredToolRecords: 0, skipped: [] });
    const [savedFlow] = await db.select().from(savedFlows);
    expect(savedFlow).toMatchObject({ userId: "a", clientId: 7, label: "Tariffs 1AC", createdAt: new Date("2025-01-02T00:00:00Z"), updatedAt: NOW });
    expect(JSON.parse(savedFlow.data)).toEqual(flow(7, "Tariffs 1AC"));
    expect(await listOwnSavedItems(db, "a", "rounds")).toMatchObject([{ id: 9, href: "/debate?roundId=9" }]);
  });

  it("never overwrites an item still in the account, so restoring twice is harmless", async () => {
    const db = await freshDb();
    await db.insert(savedFlows).values({ userId: "a", clientId: 7, label: "Current", data: JSON.stringify(flow(7, "Current")) });
    const entries = [{ kind: "flows" as const, doc: { title: "Old", data: flow(7, "Old") } }];
    const report = await restoreOwnSavedData(db, "a", entries, { now: NOW });
    expect(report.skipped).toEqual([{ kind: "flows", title: "Old", reason: "Already in your account." }]);
    expect((await db.select().from(savedFlows))[0].label).toBe("Current");
  });

  it("restores into the caller's account even when another user has the same local id", async () => {
    const db = await freshDb();
    await db.insert(savedRounds).values({ userId: "b", clientId: 9, data: JSON.stringify(round(9)) });
    const report = await restoreOwnSavedData(db, "a", [{ kind: "rounds", doc: { data: round(9) } }], { now: NOW });
    expect(report.restored.rounds).toBe(1);
    expect(await listOwnSavedItems(db, "b", "rounds")).toHaveLength(1);
  });

  it("skips invalid flows and rounds with a reason instead of failing the whole file", async () => {
    const db = await freshDb();
    const report = await restoreOwnSavedData(
      db,
      "a",
      [
        { kind: "flows", doc: { title: "Broken", data: { id: 1 } } },
        { kind: "rounds", doc: { data: "not a round" } },
        { kind: "practiceRounds", doc: { title: "Vs bot" } },
        { kind: "flows", doc: { data: flow(2) } },
      ],
      { now: NOW },
    );
    expect(report.restored).toEqual({ docs: 0, flows: 1, rounds: 0, practiceRounds: 0, wordCountRounds: 0, drills: 0, judgeDecisions: 0, speeches: 0 });
    expect(report.skipped).toEqual([
      { kind: "flows", title: "Broken", reason: "Not a valid flow." },
      { kind: "rounds", title: "Untitled round", reason: "Not a valid round." },
      { kind: "practiceRounds", title: "Vs bot", reason: "Not a valid practice debate." },
    ]);
  });

  it("brings back a deleted practice debate as the caller's, without trusting its result", async () => {
    const db = await freshDb();
    const report = await restoreOwnSavedData(
      db,
      "a",
      [
        { kind: "practiceRounds", doc: { id: 12, title: "Tariffs", result: "win", data: vsBot() } },
        { kind: "practiceRounds", doc: { id: 13, data: vsBot({ topic: "Ban TikTok", outcome: undefined, createdAt: STARTED + 60 }) } },
      ],
      { now: NOW, email: "a@example.com" },
    );
    expect(report).toEqual({ restored: { docs: 0, flows: 0, rounds: 0, practiceRounds: 2, wordCountRounds: 0, drills: 0, judgeDecisions: 0, speeches: 0 }, restoredToolRecords: 0, skipped: [] });
    const rows = await db.select().from(practiceVsAiDebates);
    const conceded = rows.find((r) => r.topic === "Tariffs do more harm than good")!;
    expect(conceded).toMatchObject({ userId: "a", email: "a@example.com", botName: "Rookie Rick", outcome: "User conceded", result: "loss" });
    expect(conceded.createdAt.getTime()).toBe(STARTED * 1000);
    expect(JSON.parse(conceded.data)).toMatchObject({ email: "a@example.com", history: [{ text: "Tariffs raise prices." }] });
    expect(rows.find((r) => r.topic === "Ban TikTok")).toMatchObject({ outcome: "", result: "pending" });
    expect((await listOwnSavedItems(db, "a", "practiceRounds")).map((r) => r.title).sort()).toEqual(["Ban TikTok", "Tariffs do more harm than good"]);
  });

  it("keeps a practice debate's saved Coach debrief through Export and Restore", async () => {
    const db = await freshDb();
    const debrief = { personaId: "socratic", text: "Why did your link hold?", savedAt: STARTED + 600 };
    const [row] = await db
      .insert(practiceVsAiDebates)
      .values({ userId: "a", botName: "Rookie Rick", topic: "Tariffs do more harm than good", data: JSON.stringify(vsBot({ debrief })), createdAt: new Date(STARTED * 1000) })
      .returning({ id: practiceVsAiDebates.id });
    const exported = await exportOwnSavedItem(db, "a", "practiceRounds", row.id);
    await db.delete(practiceVsAiDebates);

    const doc = JSON.parse(exported!.body) as Record<string, unknown>;
    const report = await restoreOwnSavedData(db, "a", [{ kind: "practiceRounds", doc }], { now: NOW });
    expect(report.restored.practiceRounds).toBe(1);
    const [restored] = await db.select().from(practiceVsAiDebates);
    expect(JSON.parse(restored.data).debrief).toEqual(debrief);

    // A malformed debrief makes the whole record invalid, like any other bad field.
    const bad = await restoreOwnSavedData(db, "a", [{ kind: "practiceRounds", doc: { data: vsBot({ topic: "Other", debrief: { text: 1 } }) } }], { now: NOW });
    expect(bad.skipped.map((s) => s.reason)).toEqual(["Not a valid practice debate."]);
  });

  it("keeps a practice debate's Judge feedback style through Export and Restore", async () => {
    const db = await freshDb();
    const [row] = await db
      .insert(practiceVsAiDebates)
      .values({ userId: "a", botName: "Rookie Rick", topic: "Tariffs do more harm than good", data: JSON.stringify(vsBot({ judgeFeedbackStyle: "fact-checker" })), createdAt: new Date(STARTED * 1000) })
      .returning({ id: practiceVsAiDebates.id });
    const exported = await exportOwnSavedItem(db, "a", "practiceRounds", row.id);
    await db.delete(practiceVsAiDebates);

    const doc = JSON.parse(exported!.body) as Record<string, unknown>;
    const report = await restoreOwnSavedData(db, "a", [{ kind: "practiceRounds", doc }], { now: NOW });
    expect(report.restored.practiceRounds).toBe(1);
    const [restored] = await db.select().from(practiceVsAiDebates);
    expect(JSON.parse(restored.data).judgeFeedbackStyle).toBe("fact-checker");

    const bad = await restoreOwnSavedData(db, "a", [{ kind: "practiceRounds", doc: { data: vsBot({ topic: "Other", judgeFeedbackStyle: 7 }) } }], { now: NOW });
    expect(bad.skipped.map((s) => s.reason)).toEqual(["Not a valid practice debate."]);
  });

  it("skips a practice debate still in the account, by id or by topic, opponent and start time", async () => {
    const db = await freshDb();
    const [kept] = await db
      .insert(practiceVsAiDebates)
      .values({ userId: "a", botName: "Rookie Rick", topic: "Kept", data: JSON.stringify(vsBot({ topic: "Kept" })) })
      .returning({ id: practiceVsAiDebates.id });
    // Another user's row with the same id, topic and start doesn't count as the caller's.
    await db.insert(practiceVsAiDebates).values({ userId: "b", botName: "Rookie Rick", topic: "Tariffs do more harm than good", data: "{}", createdAt: new Date(STARTED * 1000) });
    const file = [{ kind: "practiceRounds" as const, doc: { id: 999, data: vsBot() } }];
    const first = await restoreOwnSavedData(db, "a", [{ kind: "practiceRounds", doc: { id: kept.id, title: "Kept", data: vsBot({ topic: "Kept", createdAt: STARTED + 5 }) } }, ...file], { now: NOW });
    expect(first.restored.practiceRounds).toBe(1);
    expect(first.skipped).toEqual([{ kind: "practiceRounds", title: "Kept", reason: "Already in your account." }]);
    // Restoring the same file again finds the copy it just wrote.
    const again = await restoreOwnSavedData(db, "a", file, { now: NOW });
    expect(again.skipped.map((s) => s.reason)).toEqual(["Already in your account."]);
    expect(await db.select().from(practiceVsAiDebates).where(eq(practiceVsAiDebates.userId, "a"))).toHaveLength(2);
  });

  it("skips invalid or oversized practice debates with a reason", async () => {
    const db = await freshDb();
    const report = await restoreOwnSavedData(
      db,
      "a",
      [
        { kind: "practiceRounds", doc: { title: "No topic", data: vsBot({ topic: "" }) } },
        { kind: "practiceRounds", doc: { data: vsBot({ history: [{ sender: "User", text: "x".repeat(MAX_SAVED_PRACTICE_DEBATE_BYTES) }] }) } },
      ],
      { now: NOW },
    );
    expect(report.skipped).toEqual([
      { kind: "practiceRounds", title: "No topic", reason: "Not a valid practice debate." },
      { kind: "practiceRounds", title: "Practice debate", reason: "Too large to save to your account." },
    ]);
    expect(await db.select().from(practiceVsAiDebates)).toHaveLength(0);
  });

  it("brings back word-count rounds and drill sets under their own roundId", async () => {
    const db = await freshDb();
    const parsed = parseRestoreFile({
      exportedAt: "2026-01-01",
      wordCountRounds: [{ kind: "wordCountRounds", id: 1, roundId: "round-1", createdAt: "2025-03-04T00:00:00.000Z", data: wordCountRound("round-1") }],
      drills: [{ kind: "drills", id: 2, roundId: "7", data: drillSet("7") }],
    });
    if (!parsed.ok) throw new Error(parsed.error);
    const report = await restoreOwnSavedData(db, "a", parsed.entries, { now: NOW });
    expect(report).toEqual({ restored: { docs: 0, flows: 0, rounds: 0, practiceRounds: 0, wordCountRounds: 1, drills: 1, judgeDecisions: 0, speeches: 0 }, restoredToolRecords: 0, skipped: [] });
    const [wc] = await db.select().from(savedWordCountRounds);
    expect(wc).toMatchObject({ userId: "a", clientId: "round-1", createdAt: new Date("2025-03-04T00:00:00Z"), updatedAt: NOW });
    expect(JSON.parse(wc.data)).toEqual(wordCountRound("round-1"));
    const [drills] = await db.select().from(savedDrillSets);
    expect(drills).toMatchObject({ userId: "a", clientId: "7", createdAt: NOW, updatedAt: NOW });
    expect(JSON.parse(drills.data)).toEqual(drillSet("7"));
  });

  it("skips a word-count round or drill set still in the account, and never overwrites it", async () => {
    const db = await freshDb();
    await db.insert(savedWordCountRounds).values({ userId: "a", clientId: "round-1", data: JSON.stringify({ ...wordCountRound("round-1"), submittedSpeeches: [] }) });
    await db.insert(savedDrillSets).values({ userId: "a", clientId: "7", data: JSON.stringify({ ...drillSet("7"), drills: [] }) });
    // Same roundIds under another user don't count as the caller's.
    await db.insert(savedWordCountRounds).values({ userId: "b", clientId: "round-2", data: JSON.stringify(wordCountRound("round-2")) });
    const report = await restoreOwnSavedData(
      db,
      "a",
      [
        { kind: "wordCountRounds", doc: { title: "Word-count round · 1 speech", data: wordCountRound("round-1") } },
        { kind: "drills", doc: { title: "Round 7 · 1 drill", data: drillSet("7") } },
        { kind: "wordCountRounds", doc: { data: wordCountRound("round-2") } },
      ],
      { now: NOW },
    );
    expect(report.restored.wordCountRounds).toBe(1);
    expect(report.skipped).toEqual([
      { kind: "wordCountRounds", title: "Word-count round · 1 speech", reason: "Already in your account." },
      { kind: "drills", title: "Round 7 · 1 drill", reason: "Already in your account." },
    ]);
    const mine = await db.select().from(savedWordCountRounds).where(eq(savedWordCountRounds.userId, "a"));
    expect(mine.map((r) => r.clientId).sort()).toEqual(["round-1", "round-2"]);
    expect(JSON.parse(mine.find((r) => r.clientId === "round-1")!.data).submittedSpeeches).toEqual([]);
    expect(JSON.parse((await db.select().from(savedDrillSets))[0].data).drills).toEqual([]);
  });

  it("skips invalid or oversized word-count rounds and drill sets with a reason", async () => {
    const db = await freshDb();
    const report = await restoreOwnSavedData(
      db,
      "a",
      [
        { kind: "wordCountRounds", doc: { data: { ...wordCountRound("r"), styleKey: "noSuchStyle" } } },
        { kind: "wordCountRounds", doc: { data: { ...wordCountRound("big"), submittedSpeeches: [{ name: "AC", speaker: "aff", text: "x".repeat(MAX_SAVED_WORD_COUNT_ROUND_BYTES) }] } } },
        { kind: "drills", doc: { data: { ...drillSet("7"), drills: [{ kind: "nope" }] } } },
        { kind: "drills", doc: { title: "No data" } },
      ],
      { now: NOW },
    );
    expect(report.restored).toEqual({ docs: 0, flows: 0, rounds: 0, practiceRounds: 0, wordCountRounds: 0, drills: 0, judgeDecisions: 0, speeches: 0 });
    expect(report.skipped.map((s) => s.reason)).toEqual([
      "Not a valid word-count round.",
      "Too large to save to your account.",
      "Not a valid drill set.",
      "Not a valid drill set.",
    ]);
    expect(await db.select().from(savedWordCountRounds)).toHaveLength(0);
    expect(await db.select().from(savedDrillSets)).toHaveLength(0);
  });

  it("restores a deleted document as a new top-level row with a narrowed format", async () => {
    const db = await freshDb();
    const report = await restoreOwnSavedData(
      db,
      "a",
      [{ kind: "docs", doc: { kind: "docs", id: 4242, title: "  Aff file ", format: "exe", content: "<p>Card</p>", createdAt: "garbage" } }],
      { now: NOW, author: "Ada" },
    );
    expect(report.restored.docs).toBe(1);
    const [doc] = await db.select().from(documents);
    expect(doc).toMatchObject({ userId: "a", title: "Aff file", format: "html", content: "<p>Card</p>", parentId: null, isFolder: false, author: "Ada", createdAt: NOW });
    expect(doc.id).not.toBe(4242);
  });

  it("skips a document that is still the caller's, but restores one whose id belongs to someone else", async () => {
    const db = await freshDb();
    const [mine] = await db.insert(documents).values({ title: "Mine", userId: "a" }).returning();
    const [theirs] = await db.insert(documents).values({ title: "Theirs", userId: "b" }).returning();
    const report = await restoreOwnSavedData(
      db,
      "a",
      [
        { kind: "docs", doc: { id: mine.id, title: "Mine", content: "x" } },
        { kind: "docs", doc: { id: theirs.id, title: "Copy", content: "y" } },
        { kind: "docs", doc: { title: "No content" } },
      ],
      { now: NOW },
    );
    expect(report.restored.docs).toBe(1);
    expect(report.skipped.map((s) => s.reason)).toEqual(["Already in your account.", "Not a valid document."]);
    expect((await db.select().from(documents)).find((d) => d.title === "Theirs")?.userId).toBe("b");
  });

  it("brings back judge decisions and sent speeches under their own ids", async () => {
    const db = await freshDb();
    const report = await restoreOwnSavedData(
      db,
      "a",
      [
        { kind: "judgeDecisions", doc: { kind: "judgeDecisions", title: "Aff wins", createdAt: "2026-02-01T00:00:00.000Z", data: roundJudgeDecision("d1") } },
        { kind: "speeches", doc: { kind: "speeches", title: "Tariffs", data: speechEntry("s1") } },
      ],
      { now: NOW },
    );
    expect(report.restored).toMatchObject({ judgeDecisions: 1, speeches: 1 });
    expect(report.skipped).toEqual([]);
    const [decisionRow] = await db.select().from(savedJudgeDecisions);
    expect(decisionRow).toMatchObject({ userId: "a", clientId: "d1", roundId: "round-1" });
    expect(decisionRow.createdAt.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(await db.select().from(savedSpeechSendLog)).toMatchObject([{ userId: "a", clientId: "s1" }]);
  });

  it("skips a judge decision or sent speech still in the account, but not one only another user has", async () => {
    const db = await freshDb();
    await db.insert(savedJudgeDecisions).values([
      { userId: "a", clientId: "d1", roundId: "round-1", data: "{}" },
      { userId: "b", clientId: "d2", roundId: "round-1", data: "{}" },
    ]);
    await db.insert(savedSpeechSendLog).values({ userId: "a", clientId: "s1", data: "{}" });
    const report = await restoreOwnSavedData(
      db,
      "a",
      [
        { kind: "judgeDecisions", doc: { data: roundJudgeDecision("d1") } },
        { kind: "judgeDecisions", doc: { data: roundJudgeDecision("d2") } },
        { kind: "speeches", doc: { data: speechEntry("s1") } },
      ],
      { now: NOW },
    );
    expect(report.restored).toMatchObject({ judgeDecisions: 1, speeches: 0 });
    expect(report.skipped).toEqual([
      { kind: "judgeDecisions", title: "Judge decision", reason: "Already in your account." },
      { kind: "speeches", title: "Sent speech", reason: "Already in your account." },
    ]);
    // The existing row is never overwritten.
    expect((await db.select().from(savedJudgeDecisions).where(eq(savedJudgeDecisions.clientId, "d1")))[0].data).toBe("{}");
  });

  it("skips invalid or oversized judge decisions and sent speeches with a reason", async () => {
    const db = await freshDb();
    const huge = { ...roundJudgeDecision("d9"), result: { winner: "primary", keyVotingIssues: [], rationale: "x".repeat(MAX_SAVED_JUDGE_DECISION_BYTES) } };
    const report = await restoreOwnSavedData(
      db,
      "a",
      [
        { kind: "judgeDecisions", doc: { title: "Bad", data: { ...roundJudgeDecision("d1"), result: { winner: "tie" } } } },
        { kind: "judgeDecisions", doc: { title: "Huge", data: huge } },
        { kind: "speeches", doc: { title: "Bad speech", data: { id: "s1", text: "t" } } },
      ],
      { now: NOW },
    );
    expect(report.restored).toMatchObject({ judgeDecisions: 0, speeches: 0 });
    expect(report.skipped.map((s) => [s.title, s.reason])).toEqual([
      ["Bad", "Not a valid judge decision."],
      ["Huge", "Too large to save to your account."],
      ["Bad speech", "Not a valid sent speech."],
    ]);
    expect(await db.select().from(savedJudgeDecisions)).toEqual([]);
  });

  it("round-trips Export all: delete everything, restore the archive, get it back", async () => {
    const db = await freshDb();
    await db.insert(savedFlows).values({ userId: "a", clientId: 1, label: "1AC", data: JSON.stringify(flow(1)) });
    await db.insert(savedRounds).values({ userId: "a", clientId: 2, label: "TOC Finals", data: JSON.stringify(round(2, [1])) });
    await db.insert(documents).values({ title: "Blocks", content: "<p>b</p>", userId: "a" });
    await db.insert(savedWordCountRounds).values({ userId: "a", clientId: "round-1", data: JSON.stringify(wordCountRound("round-1")) });
    await db.insert(savedDrillSets).values({ userId: "a", clientId: "7", data: JSON.stringify(drillSet("7")) });
    await db.insert(practiceVsAiDebates).values({ userId: "a", botName: "Rookie Rick", topic: "Tariffs do more harm than good", outcome: "User conceded", result: "loss", data: JSON.stringify(vsBot()), createdAt: new Date(STARTED * 1000) });
    await db.insert(savedJudgeDecisions).values({ userId: "a", clientId: "d1", roundId: "round-1", data: JSON.stringify(roundJudgeDecision("d1")) });
    await db.insert(savedSpeechSendLog).values({ userId: "a", clientId: "s1", data: JSON.stringify(speechEntry("s1")) });
    const single = await exportOwnSavedItem(db, "a", "flows", 1);
    const archive = await exportAllOwnSavedData(db, "a", NOW);
    await db.delete(savedFlows);
    await db.delete(savedRounds);
    await db.delete(documents);
    await db.delete(savedWordCountRounds);
    await db.delete(savedDrillSets);
    await db.delete(practiceVsAiDebates);
    await db.delete(savedJudgeDecisions);
    await db.delete(savedSpeechSendLog);

    const parsed = parseRestoreFile(JSON.parse(archive.body));
    if (!parsed.ok) throw new Error(parsed.error);
    const report = await restoreOwnSavedData(db, "a", parsed.entries, { now: NOW });
    expect(report).toEqual({ restored: { docs: 1, flows: 1, rounds: 1, practiceRounds: 1, wordCountRounds: 1, drills: 1, judgeDecisions: 1, speeches: 1 }, restoredToolRecords: 0, skipped: [] });
    expect((await listOwnSavedItems(db, "a", "docs")).map((d) => d.title)).toEqual(["Blocks"]);
    expect((await listOwnSavedItems(db, "a", "practiceRounds")).map((d) => d.title)).toEqual(["Tariffs do more harm than good"]);
    expect((await listOwnSavedItems(db, "a", "wordCountRounds")).map((d) => d.title)).toEqual([wordCountRoundTitle(JSON.stringify(wordCountRound("round-1")))]);
    expect((await listOwnSavedItems(db, "a", "drills")).map((d) => d.title)).toEqual(["Round 7 · 1 drill"]);
    expect((await listOwnSavedItems(db, "a", "judgeDecisions")).map((d) => d.title)).toEqual(["Aff wins · Tabula Rasa"]);
    expect((await listOwnSavedItems(db, "a", "speeches")).map((d) => d.title)).toEqual(["Tariffs raise prices."]);

    // The single-item file of the same flow is now a no-op.
    const again = parseRestoreFile(JSON.parse(single!.body));
    if (!again.ok) throw new Error(again.error);
    expect((await restoreOwnSavedData(db, "a", again.entries, { now: NOW })).skipped).toHaveLength(1);
  });
});

describe("tool data in an export file", () => {
  const pin = (roundId: string) => ({ roundId, pinnedAt: 1 });

  it("reads the archive's toolRecords per collection, and a file holding only tool data", () => {
    const parsed = parseRestoreFile({ exportedAt: "x", flows: [], toolRecords: { pinnedDebates: [pin("r1"), pin("r2")], flowKeymap: [] } });
    expect(parsed).toEqual({ ok: true, entries: [], toolRecords: [{ collection: "pinnedDebates", records: [pin("r1"), pin("r2")] }] });
    expect(parseRestoreFile({ kind: "flows", id: 3, data: flow(3) })).toMatchObject({ ok: true, toolRecords: [] });
  });

  it("rejects malformed or oversized tool data, and a file whose tool data is empty", () => {
    expect(parseRestoreFile({ exportedAt: "x", toolRecords: [] })).toMatchObject({ ok: false, error: expect.stringContaining("toolRecords") });
    expect(parseRestoreFile({ exportedAt: "x", toolRecords: { pinnedDebates: "nope" } })).toMatchObject({ ok: false, error: expect.stringContaining("toolRecords.pinnedDebates") });
    expect(parseRestoreFile({ exportedAt: "x", toolRecords: { pinnedDebates: [] } })).toMatchObject({ ok: false, error: expect.stringContaining("nothing") });
    const many = Array.from({ length: MAX_RESTORE_TOOL_RECORDS + 1 }, (_, i) => pin(`r${i}`));
    expect(parseRestoreFile({ exportedAt: "x", toolRecords: { pinnedDebates: many } })).toMatchObject({ ok: false, error: expect.stringContaining("smaller") });
  });

  it("adds records the account lacks under their own id, for the caller only", async () => {
    const db = await freshDb();
    const report = await restoreOwnSavedData(db, "a", [], { now: NOW, toolRecords: [{ collection: "pinnedDebates", records: [pin("r1"), pin("r2")] }] });
    expect(report.restoredToolRecords).toBe(2);
    expect(report.skipped).toEqual([]);
    const rows = await db.select().from(savedToolRecords);
    expect(rows.map((r) => [r.userId, r.collection, r.clientId])).toEqual([
      ["a", "pinnedDebates", "r1"],
      ["a", "pinnedDebates", "r2"],
    ]);
    expect(JSON.parse(rows[0].data)).toEqual(pin("r1"));
    expect(rows[0].createdAt).toEqual(NOW);
  });

  it("never overwrites a record still in the account, and sums skips into one line per tool and reason", async () => {
    const db = await freshDb();
    await db.insert(savedToolRecords).values({ userId: "a", collection: "pinnedDebates", clientId: "r1", data: JSON.stringify({ roundId: "r1", pinnedAt: 99 }) });
    // Another user's record under the same id doesn't count as the caller's.
    await db.insert(savedToolRecords).values({ userId: "b", collection: "pinnedDebates", clientId: "r2", data: "{}" });
    const huge = { roundId: "big", note: "x".repeat(MAX_TOOL_RECORD_BYTES) };
    const { restored, skipped } = await restoreOwnToolRecords(
      db,
      "a",
      [
        { collection: "pinnedDebates", records: [pin("r1"), pin("r2"), pin("r2"), { pinnedAt: 1 }, "junk", huge] },
        { collection: "retiredTool", records: [{ id: "1" }] },
      ],
      NOW,
    );
    expect(restored).toBe(1);
    expect(skipped).toEqual([
      { kind: "toolRecords", title: "Pinned Debates · 2 records", reason: "Already in your account." },
      { kind: "toolRecords", title: "Pinned Debates · 2 records", reason: "Not valid Pinned Debates records." },
      { kind: "toolRecords", title: "Pinned Debates · 1 record", reason: "Too large to save to your account." },
      { kind: "toolRecords", title: "retiredTool · 1 record", reason: "This tool no longer saves to your account." },
    ]);
    const mine = await db.select().from(savedToolRecords).where(eq(savedToolRecords.userId, "a"));
    expect(mine.map((r) => r.clientId).sort()).toEqual(["r1", "r2"]);
    expect(JSON.parse(mine.find((r) => r.clientId === "r1")!.data).pinnedAt).toBe(99);
  });

  it("strips what the collection's redact holds back before saving", async () => {
    const db = await freshDb();
    const source = { id: "s1", type: "s3", name: "Bucket", credentials: { bucket: "b", region: "us", secretAccessKey: "shh", accessKeyId: "id" } };
    const { restored } = await restoreOwnToolRecords(db, "a", [{ collection: "fileSources", records: [source] }], NOW);
    expect(restored).toBe(1);
    const [row] = await db.select().from(savedToolRecords);
    expect(JSON.parse(row.data).credentials).toEqual({ bucket: "b", region: "us" });
  });

  it("writes hundreds of records in batches", async () => {
    const db = await freshDb();
    const records = Array.from({ length: 250 }, (_, i) => pin(`r${i}`));
    const { restored } = await restoreOwnToolRecords(db, "a", [{ collection: "pinnedDebates", records }], NOW);
    expect(restored).toBe(250);
    expect(await db.select().from(savedToolRecords)).toHaveLength(250);
  });

  it("round-trips Export all: tool data deleted from the account comes back, and a second restore adds nothing", async () => {
    const db = await freshDb();
    await db.insert(savedToolRecords).values([
      { userId: "a", collection: "pinnedDebates", clientId: "r1", data: JSON.stringify(pin("r1")) },
      { userId: "a", collection: "flowKeymap", clientId: "next", data: JSON.stringify({ id: "next", keys: ["Tab"] }) },
    ]);
    const archive = JSON.parse((await exportAllOwnSavedData(db, "a")).body);
    await db.delete(savedToolRecords);
    const parsed = parseRestoreFile(archive);
    if (!parsed.ok) throw new Error(parsed.error);
    const first = await restoreOwnSavedData(db, "a", parsed.entries, { now: NOW, toolRecords: parsed.toolRecords });
    expect(first.restoredToolRecords).toBe(2);
    const again = await restoreOwnSavedData(db, "a", parsed.entries, { now: NOW, toolRecords: parsed.toolRecords });
    expect(again.restoredToolRecords).toBe(0);
    expect(again.skipped.map((s) => s.title).sort()).toEqual(["Flow Editor Shortcuts · 1 record", "Pinned Debates · 1 record"]);
  });
});
