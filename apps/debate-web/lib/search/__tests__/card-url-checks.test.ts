import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/lib/database/schema";
import { applySchema } from "@/lib/database/__tests__/schema-sql";
import {
  attachCardUrlChecks,
  readCardUrlChecks,
  resetEnsuredCardUrlCheckTable,
  saveCardUrlChecks,
} from "../card-url-checks";

async function freshDb() {
  const client = createClient({ url: ":memory:" });
  await applySchema(client);
  return drizzle(client, { schema });
}

beforeEach(() => resetEnsuredCardUrlCheckTable());

describe("card URL checks", () => {
  it("saves each card's check and replaces it on the next run", async () => {
    const db = await freshDb();
    await saveCardUrlChecks(db, [{ cardId: 1, url: "https://a.org/x", status: "invalid", statusCode: 404, error: "HTTP 404" }], 100);
    await saveCardUrlChecks(db, [{ cardId: 1, url: "https://a.org/x", status: "valid", statusCode: 200 }], 200);

    const checks = await readCardUrlChecks(db, [{ id: 1, sourceUrl: "https://a.org/x" }]);
    expect(checks.get(1)).toEqual({ status: "valid", statusCode: 200, checkedAt: 200 });
  });

  it("saves pages larger than one upsert statement", async () => {
    const db = await freshDb();
    const checks = Array.from({ length: 40 }, (_, i) => ({ cardId: i + 1, url: `https://a.org/${i + 1}`, status: "valid" as const }));
    await saveCardUrlChecks(db, checks);
    const read = await readCardUrlChecks(db, checks.map((c) => ({ id: c.cardId, sourceUrl: c.url })));
    expect(read.size).toBe(40);
  });

  it("ignores a check made for a URL the card no longer stores", async () => {
    const db = await freshDb();
    await saveCardUrlChecks(db, [{ cardId: 1, url: "https://a.org/old", status: "valid" }]);
    expect((await readCardUrlChecks(db, [{ id: 1, sourceUrl: "https://a.org/new" }])).size).toBe(0);
  });

  it("attaches checks to cards and leaves unchecked cards alone", async () => {
    const db = await freshDb();
    await saveCardUrlChecks(db, [{ cardId: 1, url: "https://a.org/x", status: "error", error: "Timeout after 8000ms" }], 5);
    const cards = await attachCardUrlChecks(db, [
      { id: 1, sourceUrl: "https://a.org/x" },
      { id: 2, sourceUrl: "https://a.org/y" },
      { id: 3, sourceUrl: "" },
    ]);
    expect(cards[0].urlCheck).toEqual({ status: "error", error: "Timeout after 8000ms", checkedAt: 5 });
    expect(cards[1].urlCheck).toBeUndefined();
    expect(cards[2].urlCheck).toBeUndefined();
  });

  it("reads no checks, instead of failing a search, when the table does not exist", async () => {
    const client = createClient({ url: ":memory:" });
    const db = drizzle(client, { schema });
    expect((await readCardUrlChecks(db, [{ id: 1, sourceUrl: "https://a.org/x" }])).size).toBe(0);
  });
});
