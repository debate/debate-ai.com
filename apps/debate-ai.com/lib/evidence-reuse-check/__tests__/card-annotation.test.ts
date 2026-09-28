/**
 * @fileoverview Exercises the reuse check's card annotation against a real
 * SQLite `card_ai_analyses` table with the model call stubbed: the request it
 * sends, that a card is generated once and then served from the cache, and
 * that a refusal or malformed answer is reported rather than saved.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../../database/schema";
import { cardAiAnalyses } from "../../database/schema";

vi.mock("@/lib/env", () => ({ getEnv: (key: string) => (key === "ANTHROPIC_API_KEY" ? "test-key" : undefined) }));

import { annotateCard, annotationCardHash, readSavedAnnotations } from "../card-annotation";

const migrationPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../drizzle/0053_card_ai_analyses.sql",
);

async function freshDb() {
  const client = createClient({ url: ":memory:" });
  // `card_ai_analyses.user_id` references `user`; only its key matters here.
  await client.execute("CREATE TABLE `user` (`id` text PRIMARY KEY NOT NULL)");
  for (const statement of readFileSync(migrationPath, "utf8").split("--> statement-breakpoint")) {
    const sql = statement.trim();
    if (sql) await client.execute(sql);
  }
  return drizzle(client, { schema });
}

const card = {
  tag: "Automation displaces workers",
  cite: "Smith 23",
  fullcite: "Smith 23 [Jane Smith, Professor of Economics at MIT, https://example.com/story]",
  markup: "<p><mark>Automation will displace</mark> millions</p>",
  spoken: "",
  fulltext: "Automation will displace millions",
};

const annotation = {
  claim: "Automation will displace millions of workers.",
  supportScore: 5,
  authorQuality: { rating: "strong", qualifications: "MIT economist", concerns: "" },
  flaws: [{ flaw: "No timeframe", severity: "medium", explanation: "The card never says when." }],
};

function modelResponse(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

describe("annotateCard", () => {
  let db: Awaited<ReturnType<typeof freshDb>>;
  const fetchMock = vi.fn();

  beforeEach(async () => {
    db = await freshDb();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks for schema-constrained JSON, saves it, and serves the saved copy after", async () => {
    fetchMock.mockResolvedValueOnce(
      modelResponse({
        model: "claude-opus-5",
        stop_reason: "end_turn",
        content: [{ type: "thinking", thinking: "" }, { type: "text", text: JSON.stringify(annotation) }],
      }),
    );

    expect(await annotateCard(db, card, null)).toEqual({ ok: true, annotation, cached: false });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      model: "claude-opus-5",
      fallbacks: "default",
      output_config: { format: { type: "json_schema" } },
    });
    expect(body.messages[0].content).toContain("Citation: Smith 23 [Jane Smith");
    expect(init.headers["anthropic-beta"]).toBe("server-side-fallback-2026-07-01");

    expect(await annotateCard(db, card, null)).toEqual({ ok: true, annotation, cached: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const hash = await annotationCardHash(card);
    expect((await readSavedAnnotations(db, [hash])).get(hash)).toEqual(annotation);
  });

  it("reports a refusal without saving anything", async () => {
    fetchMock.mockResolvedValueOnce(modelResponse({ stop_reason: "refusal", content: [] }));
    expect(await annotateCard(db, card, null)).toMatchObject({ ok: false, status: 422 });
    expect(await db.$count(cardAiAnalyses)).toBe(0);
  });

  it("rejects an answer that is not an annotation", async () => {
    fetchMock.mockResolvedValueOnce(
      modelResponse({ stop_reason: "end_turn", content: [{ type: "text", text: "## Not JSON" }] }),
    );
    expect(await annotateCard(db, card, null)).toMatchObject({ ok: false, status: 502 });
    expect(await db.$count(cardAiAnalyses)).toBe(0);
  });
});
