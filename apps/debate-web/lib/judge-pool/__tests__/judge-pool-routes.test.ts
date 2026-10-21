/**
 * @fileoverview `/api/judge-pool` against a real SQLite database: listing a
 * judge for circuit weekends, the pool an organizer sees, and a hire request
 * from send to accept.
 */

import { drizzle } from "drizzle-orm/libsql";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";

let db: ReturnType<typeof drizzle<typeof schema>>;
let signedInAs: string | null = "judge";

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db }));
vi.mock("@/lib/auth/session", () => ({ getUserId: async () => signedInAs }));

const { GET } = await import("@/app/api/judge-pool/route");
const { PUT } = await import("@/app/api/judge-pool/listing/route");
const { POST } = await import("@/app/api/judge-pool/hires/route");
const { PATCH } = await import("@/app/api/judge-pool/hires/[hireId]/route");

const json = (body: unknown) => ({ method: "POST", body: JSON.stringify(body) });

async function as<T>(userId: string | null, call: () => Promise<Response>): Promise<{ status: number; body: T }> {
  signedInAs = userId;
  const res = await call();
  return { status: res.status, body: (await res.json()) as T };
}

const getPool = (userId: string | null) =>
  as<Record<string, any>>(userId, () => GET());
const putListing = (userId: string, body: unknown) =>
  as<Record<string, any>>(userId, () => PUT(new Request("https://d.ebate.app/api/judge-pool/listing", { ...json(body), method: "PUT" }) as never));
const postHire = (userId: string, body: unknown) =>
  as<Record<string, any>>(userId, () => POST(new Request("https://d.ebate.app/api/judge-pool/hires", json(body)) as never));
const patchHire = (userId: string, id: string, action: string) =>
  as<Record<string, any>>(userId, () =>
    PATCH(new Request(`https://d.ebate.app/api/judge-pool/hires/${id}`, { ...json({ action }), method: "PATCH" }) as never, {
      params: Promise.resolve({ hireId: id }),
    }),
  );

const LISTING = {
  active: true,
  weekends: ["2026-10-17", "2026-11-21"],
  states: ["CA"],
  canTravel: true,
  formats: ["ld"],
  philosophy: "Tech over truth.",
};
const HIRE = { judgeId: "judge", tournamentName: "Bay Area Invitational", weekend: "2026-11-21", offer: "$300", message: "" };

describe("/api/judge-pool", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-12T12:00:00Z"));
    db = drizzle(await freshSchemaClient(), { schema });
    const now = new Date();
    await db.insert(schema.user).values(
      ["judge", "organizer", "guest"].map((id) => ({
        id,
        name: id,
        email: `${id}@example.com`,
        isAnonymous: id === "guest",
        createdAt: now,
        updatedAt: now,
      })),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is account-only", async () => {
    expect((await getPool(null)).status).toBe(401);
  });

  it("lists a judge for their weekends and shows them in everyone else's pool", async () => {
    const saved = await putListing("judge", LISTING);
    expect(saved.status).toBe(200);

    const own = await getPool("judge");
    expect(own.body.listing).toEqual(LISTING);
    expect(own.body.pool).toEqual([]);
    expect(own.body.paymentsConnected).toBe(false);

    const organizer = await getPool("organizer");
    expect(organizer.body.pool).toHaveLength(1);
    expect(organizer.body.pool[0]).toMatchObject({ ...LISTING, judge: { id: "judge", name: "judge" } });
  });

  it("drops passed weekends and hides a judge with none left", async () => {
    await putListing("judge", { ...LISTING, weekends: ["2026-10-17"] });
    vi.setSystemTime(new Date("2026-10-19T12:00:00Z"));
    expect((await getPool("organizer")).body.pool).toEqual([]);
    expect((await getPool("judge")).body.listing.weekends).toEqual([]);
  });

  it("refuses more than three weekends and guests", async () => {
    const tooMany = await putListing("judge", { ...LISTING, weekends: ["2026-10-17", "2026-10-24", "2026-10-31", "2026-11-07"] });
    expect(tooMany.status).toBe(400);
    expect((await putListing("guest", LISTING)).status).toBe(403);
  });

  it("sends a hire request, notifies the judge, and lets them accept", async () => {
    await putListing("judge", LISTING);

    const sent = await postHire("organizer", HIRE);
    expect(sent.status).toBe(201);
    expect(sent.body).toMatchObject({ status: "pending", tournamentName: "Bay Area Invitational", organizer: { id: "organizer" } });

    const judgeView = await getPool("judge");
    expect(judgeView.body.hires.map((hire: { id: string }) => hire.id)).toEqual([sent.body.id]);

    const accepted = await patchHire("judge", sent.body.id, "accept");
    expect(accepted.status).toBe(200);
    expect(accepted.body.status).toBe("accepted");

    const notes = await db.select().from(schema.notifications);
    expect(notes.map((note) => [note.userId, note.type])).toEqual([
      ["judge", "judge_hire"],
      ["organizer", "judge_hire"],
    ]);
    expect(notes[0].link).toBe("/practice/prep?section=partners#judge-pool");
  });

  it("refuses a weekend the judge didn't offer, a duplicate, and self-hire", async () => {
    await putListing("judge", LISTING);
    expect((await postHire("organizer", { ...HIRE, weekend: "2026-10-24" })).status).toBe(409);
    expect((await postHire("organizer", HIRE)).status).toBe(201);
    expect((await postHire("organizer", HIRE)).status).toBe(409);
    expect((await postHire("judge", HIRE)).status).toBe(400);
  });

  it("refuses hiring an unlisted judge and answering someone else's request", async () => {
    expect((await postHire("organizer", HIRE)).status).toBe(404);
    await putListing("judge", LISTING);
    const sent = await postHire("organizer", HIRE);
    expect((await patchHire("organizer", sent.body.id, "accept")).status).toBe(403);
    expect((await patchHire("guest", sent.body.id, "cancel")).status).toBe(404);
  });
});
