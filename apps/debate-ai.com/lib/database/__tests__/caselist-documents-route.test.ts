/**
 * @fileoverview `/api/caselist-documents` against a real SQLite database.
 *
 * The route used to match school and team with drizzle's `ilike`, which
 * compiles to Postgres' `ILIKE`. D1 rejects that as a syntax error, so every
 * team page's documents request came back as a 500.
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { caselistDocuments } from "@/lib/database/schema";
import { applySchema } from "@/lib/database/__tests__/schema-sql";

let db: ReturnType<typeof drizzle<typeof schema>>;

vi.mock("@/lib/database/context", () => ({
  getDBFromContext: async () => db,
}));

const { GET } = await import("@/app/api/caselist-documents/route");

/** A document row shaped like the caselist sync's output. */
function doc(overrides: Partial<typeof caselistDocuments.$inferInsert> = {}) {
  return {
    id: 1,
    pathHash: "h1",
    caselistSlug: "hspolicy26",
    caselistLabel: "HS Policy 2025-26",
    school: "Monte Vista HS Independent",
    team: "Balaji & Muthuraman",
    side: "Aff",
    fileName: "1AC.docx",
    archivePath: "hspolicy26/Monte Vista HS Independent/Balaji & Muthuraman/1AC.docx",
    html: "<p>1AC</p>",
    ...overrides,
  };
}

/** Calls the route with the given query string. */
async function get(query: string) {
  const res = await GET(new Request(`https://d.ebate.app/api/caselist-documents?${query}`));
  return { status: res.status, body: await res.json() };
}

describe("GET /api/caselist-documents", () => {
  beforeEach(async () => {
    const client = createClient({ url: ":memory:" });
    await applySchema(client);
    db = drizzle(client, { schema });
    await db.insert(caselistDocuments).values([
      doc(),
      doc({ id: 2, pathHash: "h2", team: "Other Team", fileName: "1NC.docx" }),
    ]);
  });

  it("finds a team's documents instead of failing on SQLite", async () => {
    const { status, body } = await get(
      "school=Monte+Vista+HS+Independent&team=Balaji+%26+Muthuraman&limit=50",
    );
    expect(status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.documents.map((d: { id: number }) => d.id)).toEqual([1]);
  });

  it("matches school and team case-insensitively", async () => {
    const { body } = await get("school=monte+vista+hs+independent&team=BALAJI+%26+MUTHURAMAN");
    expect(body.total).toBe(1);
  });

  it("does not treat the value as a LIKE pattern", async () => {
    const { body } = await get("school=Monte%25");
    expect(body.total).toBe(0);
  });

  it("requires a school or a team", async () => {
    expect((await get("limit=5")).status).toBe(400);
  });
});
