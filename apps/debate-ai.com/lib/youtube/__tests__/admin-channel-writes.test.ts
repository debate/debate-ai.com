/**
 * @fileoverview Exercises the admin YouTube channel write operations against a
 * real in-memory SQLite database. The upsert-on-duplicate-name behavior that
 * fixes channel add/re-enable cannot be seen through a mocked drizzle handle —
 * it depends on the unique index on `youtube_channels.name` actually firing.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "../../database/schema";
import { applySchema } from "../../database/__tests__/schema-sql";
import { youtubeChannels } from "../../database/schema";
import { addAdminChannel, editAdminChannel, normalizeChannelName } from "../admin-channel-writes";

async function freshDb() {
  const client = createClient({ url: ":memory:" });
  await applySchema(client);
  return drizzle(client, { schema });
}

describe("normalizeChannelName", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeChannelName("  somechannel  ")).toBe("somechannel");
  });

  it("returns null for empty or whitespace-only input", () => {
    expect(normalizeChannelName("")).toBeNull();
    expect(normalizeChannelName("   ")).toBeNull();
  });

  it("returns null for non-string input", () => {
    expect(normalizeChannelName(null)).toBeNull();
    expect(normalizeChannelName(42)).toBeNull();
  });

  it("rejects names longer than 200 characters", () => {
    expect(normalizeChannelName("a".repeat(201))).toBeNull();
    expect(normalizeChannelName("a".repeat(200))).toBe("a".repeat(200));
  });
});

describe("addAdminChannel", () => {
  it("inserts a new channel with enabled=true and the provided addedBy", async () => {
    const db = await freshDb();
    const { channel, error } = await addAdminChannel(db, { name: "newchannel" }, "admin@example.test");

    expect(error).toBeNull();
    expect(channel).not.toBeNull();
    expect(channel!.name).toBe("newchannel");
    expect(channel!.enabled).toBe(true);
    expect(channel!.addedBy).toBe("admin@example.test");
    expect(channel!.channelId).toBeNull();
  });

  it("re-enables a seeded channel that was previously paused instead of returning a conflict", async () => {
    const db = await freshDb();
    await db.insert(youtubeChannels).values({ name: "seededchannel", enabled: false, addedBy: null });

    const { channel, error } = await addAdminChannel(db, { name: "seededchannel" }, "admin@example.test");

    expect(error).toBeNull();
    expect(channel).not.toBeNull();
    expect(channel!.name).toBe("seededchannel");
    expect(channel!.enabled).toBe(true);
    expect(channel!.addedBy).toBe("admin@example.test");
  });

  it("is idempotent: adding an already-enabled channel returns the row without error", async () => {
    const db = await freshDb();
    await db.insert(youtubeChannels).values({ name: "existing", enabled: true, addedBy: "first@example.test" });

    const { channel, error } = await addAdminChannel(db, { name: "existing" }, "second@example.test");

    expect(error).toBeNull();
    expect(channel).not.toBeNull();
    expect(channel!.enabled).toBe(true);
    expect(channel!.addedBy).toBe("second@example.test");
  });

  it("rejects an empty name", async () => {
    const db = await freshDb();
    const { channel, error } = await addAdminChannel(db, { name: "   " }, "admin@example.test");

    expect(channel).toBeNull();
    expect(error).toBe("Channel name is required.");
  });

  it("creates exactly one row when adding the same name twice", async () => {
    const db = await freshDb();

    await addAdminChannel(db, { name: "dupcheck" }, "admin@example.test");
    await addAdminChannel(db, { name: "dupcheck" }, "admin@example.test");

    const rows = await db.select().from(youtubeChannels).where(eq(youtubeChannels.name, "dupcheck"));
    expect(rows).toHaveLength(1);
  });
});

describe("editAdminChannel", () => {
  it("toggles enabled on a channel", async () => {
    const db = await freshDb();
    const [row] = await db.insert(youtubeChannels).values({ name: "toggleme", enabled: true }).returning();

    const { channel, error } = await editAdminChannel(db, row.id, { enabled: false });

    expect(error).toBeNull();
    expect(channel).not.toBeNull();
    expect(channel!.enabled).toBe(false);
  });

  it("renames a channel", async () => {
    const db = await freshDb();
    const [row] = await db.insert(youtubeChannels).values({ name: "oldname", enabled: true }).returning();

    const { channel, error } = await editAdminChannel(db, row.id, { name: "newname" });

    expect(error).toBeNull();
    expect(channel).not.toBeNull();
    expect(channel!.name).toBe("newname");
  });

  it("returns an error when renaming to a name that already exists", async () => {
    const db = await freshDb();
    const [a] = await db.insert(youtubeChannels).values({ name: "alpha", enabled: true }).returning();
    await db.insert(youtubeChannels).values({ name: "beta", enabled: true });

    const { channel, error } = await editAdminChannel(db, a.id, { name: "beta" });

    expect(channel).toBeNull();
    expect(error).toContain("Another channel already uses that name");
  });

  it("returns an error for an invalid id", async () => {
    const db = await freshDb();
    const { channel, error } = await editAdminChannel(db, -1, { enabled: true });

    expect(channel).toBeNull();
    expect(error).toBe("Channel not found.");
  });
});
