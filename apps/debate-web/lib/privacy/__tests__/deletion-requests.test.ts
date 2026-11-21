/**
 * @fileoverview The admin deletion-request queue against a real in-memory
 * SQLite database: listing every user's requests pending-first, and status
 * changes that notify the requester.
 */
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { describe, expect, it, vi } from "vitest";
import * as schema from "../../database/schema";
import { applySchema } from "../../database/__tests__/schema-sql";
import { dataDeletionRequests, notifications, user } from "../../database/schema";
import {
  createDeletionRequest,
  deletionStatusNotice,
  listAllDeletionRequests,
  updateDeletionRequestStatus,
} from "../store";

async function freshDb() {
  const client = createClient({ url: ":memory:" });
  await applySchema(client);
  const db = drizzle(client, { schema });
  await db.insert(user).values(
    ["a", "b"].map((id) => ({
      id,
      name: `User ${id}`,
      email: `${id}@example.com`,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    })),
  );
  return { client, db };
}

async function fileAt(db: any, userId: string, when: string, status = "pending") {
  const [row] = await db
    .insert(dataDeletionRequests)
    .values({ userId, scope: "part", categories: '["flows"]', details: "", status, createdAt: new Date(when) })
    .returning();
  return row.id as number;
}

describe("listAllDeletionRequests", () => {
  it("lists pending requests oldest first, then worked ones newest first, with the requester", async () => {
    const { db } = await freshDb();
    const oldPending = await fileAt(db, "a", "2026-03-01");
    const newPending = await fileAt(db, "b", "2026-05-01");
    const oldDone = await fileAt(db, "a", "2026-01-15", "done");
    const newDeclined = await fileAt(db, "b", "2026-04-01", "declined");

    const rows = await listAllDeletionRequests(db as any);
    expect(rows.map((r) => r.id)).toEqual([oldPending, newPending, newDeclined, oldDone]);
    expect(rows[0]).toMatchObject({
      userId: "a",
      name: "User a",
      email: "a@example.com",
      scope: "part",
      categories: ["flows"],
      status: "pending",
      createdAt: "2026-03-01T00:00:00.000Z",
    });

    const pending = await listAllDeletionRequests(db as any, { status: "pending" });
    expect(pending.map((r) => r.id)).toEqual([oldPending, newPending]);
  });

  it("is empty before anyone has filed a request", async () => {
    const { db } = await freshDb();
    expect(await listAllDeletionRequests(db as any)).toEqual([]);
  });
});

describe("updateDeletionRequestStatus", () => {
  it("records the decision and notifies the requester with the note", async () => {
    const { db } = await freshDb();
    const created = await createDeletionRequest(db as any, "a", { scope: "all", categories: [], details: "Please" });

    const updated = await updateDeletionRequestStatus(db as any, { id: created.id, status: "done", note: "All gone." });
    expect(updated).toMatchObject({ id: created.id, status: "done", scope: "all", details: "Please" });

    const [stored] = await db.select().from(dataDeletionRequests).where(eq(dataDeletionRequests.id, created.id));
    expect(stored.status).toBe("done");
    const sent = await db.select().from(notifications).where(eq(notifications.userId, "a"));
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      type: "data_deletion_request_status",
      title: "Deletion request completed",
      body: "Your request to delete all of your data was completed. All gone.",
      link: "/settings?category=privacy",
    });
  });

  it("doesn't notify again when the status is unchanged", async () => {
    const { db } = await freshDb();
    const id = await fileAt(db, "b", "2026-02-01", "declined");
    const updated = await updateDeletionRequestStatus(db as any, { id, status: "declined", note: "" });
    expect(updated?.status).toBe("declined");
    expect(await db.select().from(notifications)).toEqual([]);
  });

  it("returns null for an unknown id", async () => {
    const { db } = await freshDb();
    expect(await updateDeletionRequestStatus(db as any, { id: 999, status: "done", note: "" })).toBeNull();
  });

  it("still saves the status when the notification can't be written", async () => {
    const { client, db } = await freshDb();
    const id = await fileAt(db, "a", "2026-02-01");
    await client.execute("DROP TABLE notifications");
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await updateDeletionRequestStatus(db as any, { id, status: "declined", note: "" }))?.status).toBe("declined");
    const [stored] = await db.select().from(dataDeletionRequests).where(eq(dataDeletionRequests.id, id));
    expect(stored.status).toBe("declined");
  });
});

describe("deletionStatusNotice", () => {
  it("names the categories by their labels", () => {
    expect(deletionStatusNotice({ scope: "part", categories: ["flows", "comments"] }, "declined", "")).toEqual({
      title: "Deletion request declined",
      body: "Your request to delete flows and round data, comments and forum posts was declined.",
    });
    expect(deletionStatusNotice({ scope: "part", categories: [] }, "pending", "").body).toBe(
      "Your request to delete part of your data was reopened.",
    );
  });
});
