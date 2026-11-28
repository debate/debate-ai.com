/**
 * @fileoverview `/api/settings` PUT's single-operation patches against a real
 * SQLite database. Each op (star/unstar, record a recent tool, word-limit and
 * outline-filter presets, saved argument collections, streak freeze/reminder/
 * mission result, news read/liked) is resolved against the row's *stored*
 * value rather than the caller's copy, so two devices editing at once cannot
 * overwrite one another. Failed ops answer 400 and write nothing.
 */

import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";

let db: ReturnType<typeof drizzle<typeof schema>>;
let signedInAs: string | null = "user-1";

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db }));
vi.mock("@/lib/auth/session", () => ({
  getUserId: async () => signedInAs,
  getUserIdOrUnavailable: async () => signedInAs,
}));

const { GET, PUT } = await import("@/app/api/settings/route");

const put = (body: unknown) =>
  PUT(new Request("https://d.ebate.app/api/settings", { method: "PUT", body: JSON.stringify(body) }) as never);
const settings = async () => (await GET(new Request("https://d.ebate.app/api/settings") as never)).json();

beforeEach(async () => {
  signedInAs = "user-1";
  db = drizzle(await freshSchemaClient(), { schema });
  const now = new Date();
  await db.insert(schema.user).values({ id: "user-1", name: "u", email: "u@example.com", createdAt: now, updatedAt: now });
});

describe("/api/settings favorite and recent tool ops", () => {
  it("stars and unstars one tool against the stored list, so a second device's star survives", async () => {
    await put({ addFavoriteTool: "/reason-editor" });
    await put({ addFavoriteTool: "/flow" });
    expect((await settings()).favoriteTools).toEqual(expect.arrayContaining(["/reason-editor", "/flow"]));

    const after = await (await put({ removeFavoriteTool: "/reason-editor" })).json();
    expect(after.favoriteTools).toContain("/flow");
    expect(after.favoriteTools).not.toContain("/reason-editor");
  });

  it("prunes a batch of tools in one write", async () => {
    await put({ favoriteTools: ["/a-tool", "/b-tool", "/c-tool"] });
    const after = await (await put({ removeFavoriteTools: ["/a-tool", "/c-tool"] })).json();
    expect(after.favoriteTools).toEqual(["/b-tool"]);
  });

  it("replaces the whole list when sent a plain favoriteTools array", async () => {
    const after = await (await put({ favoriteTools: ["/only-one"] })).json();
    expect(after.favoriteTools).toEqual(["/only-one"]);
  });

  it("rejects an op that is not an in-app path, or two ops at once", async () => {
    expect((await put({ addFavoriteTool: "https://evil.example/x" })).status).toBe(400);
    expect((await put({ addFavoriteTool: "/a", removeFavoriteTool: "/b" })).status).toBe(400);
    expect((await put({ recordRecentTool: "javascript:alert(1)" })).status).toBe(400);
  });

  it("records recent tools, most recent first, without duplicates", async () => {
    await put({ recordRecentTool: "/reason-editor" });
    await put({ recordRecentTool: "/flow" });
    const after = await (await put({ recordRecentTool: "/reason-editor" })).json();
    expect(after.recentTools[0]).toBe("/reason-editor");
    expect(after.recentTools.filter((href: string) => href === "/reason-editor")).toHaveLength(1);
    expect(after.recentTools).toContain("/flow");
  });
});

describe("/api/settings word-limit preset ops", () => {
  it("adds, updates and removes a preset by name", async () => {
    const added = await (await put({ addWordLimitPreset: { name: "Rebuttal", wordLimit: 400 } })).json();
    expect(added.wordLimitPresets).toContainEqual({ name: "Rebuttal", wordLimit: 400 });

    const updated = await (await put({ updateWordLimitPreset: { name: "Rebuttal", wordLimit: 650 } })).json();
    expect(updated.wordLimitPresets).toContainEqual({ name: "Rebuttal", wordLimit: 650 });
    expect(updated.wordLimitPresets.filter((preset: { name: string }) => preset.name === "Rebuttal")).toHaveLength(1);

    const removed = await (await put({ removeWordLimitPreset: "Rebuttal" })).json();
    expect(removed.wordLimitPresets.some((preset: { name: string }) => preset.name === "Rebuttal")).toBe(false);
  });

  it("answers 400 and writes nothing when the op cannot apply", async () => {
    await put({ addWordLimitPreset: { name: "Rebuttal", wordLimit: 400 } });
    const before = (await settings()).wordLimitPresets;

    const duplicate = await put({ addWordLimitPreset: { name: "Rebuttal", wordLimit: 500 } });
    expect(duplicate.status).toBe(400);
    expect(typeof (await duplicate.json()).error).toBe("string");
    expect((await put({ updateWordLimitPreset: { name: "Nope", wordLimit: 500 } })).status).toBe(400);
    expect((await settings()).wordLimitPresets).toEqual(before);
  });

  it("treats removing a preset that is already gone as a no-op", async () => {
    const before = (await settings()).wordLimitPresets;
    expect((await put({ removeWordLimitPreset: "Nope" })).status).toBe(200);
    expect((await settings()).wordLimitPresets).toEqual(before);
  });

  it("refuses malformed or combined op bodies", async () => {
    expect((await put({ addWordLimitPreset: { name: "x" } })).status).toBe(400);
    expect((await put({ addWordLimitPreset: { name: "x", wordLimit: 5 }, removeWordLimitPreset: "x" })).status).toBe(400);
    expect((await put({ removeWordLimitPreset: "  " })).status).toBe(400);
  });
});

describe("/api/settings saved argument collection ops", () => {
  it("adds, retags, renames and removes a collection", async () => {
    const added = await (await put({ addSavedArgumentCollection: { name: "Case A", tags: ["economy", "trade"] } })).json();
    expect(added.savedArgumentCollections).toContainEqual({ name: "Case A", tags: ["economy", "trade"] });

    const retagged = await (await put({ updateSavedArgumentCollectionTags: { name: "Case A", tags: ["trade"] } })).json();
    expect(retagged.savedArgumentCollections).toContainEqual({ name: "Case A", tags: ["trade"] });

    const renamed = await (await put({ renameSavedArgumentCollection: { oldName: "Case A", newName: "Case B" } })).json();
    const names = renamed.savedArgumentCollections.map((collection: { name: string }) => collection.name);
    expect(names).toContain("Case B");
    expect(names).not.toContain("Case A");

    const removed = await (await put({ removeSavedArgumentCollection: "Case B" })).json();
    expect(removed.savedArgumentCollections).toEqual([]);
  });

  it("answers 400 for a duplicate, an unknown name, or empty tags, and leaves the stored list alone", async () => {
    await put({ addSavedArgumentCollection: { name: "Case A", tags: ["economy"] } });
    const before = (await settings()).savedArgumentCollections;

    for (const body of [
      { addSavedArgumentCollection: { name: "case a", tags: ["x"] } },
      { addSavedArgumentCollection: { name: "Empty", tags: [] } },
      { updateSavedArgumentCollectionTags: { name: "Missing", tags: ["x"] } },
      { renameSavedArgumentCollection: { oldName: "Missing", newName: "Other" } },
    ]) {
      const res = await put(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(typeof (await res.json()).error).toBe("string");
    }
    expect((await settings()).savedArgumentCollections).toEqual(before);
  });

  it("treats removing a collection that is already gone as a no-op", async () => {
    await put({ addSavedArgumentCollection: { name: "Case A", tags: ["economy"] } });
    const before = (await settings()).savedArgumentCollections;
    expect((await put({ removeSavedArgumentCollection: "Missing" })).status).toBe(200);
    expect((await settings()).savedArgumentCollections).toEqual(before);
  });

  it("refuses malformed or combined op bodies", async () => {
    expect((await put({ addSavedArgumentCollection: "Case" })).status).toBe(400);
    expect((await put({ removeSavedArgumentCollection: "" })).status).toBe(400);
    expect(
      (await put({ addSavedArgumentCollection: { name: "a", tags: ["b"] }, removeSavedArgumentCollection: "a" })).status,
    ).toBe(400);
  });
});

describe("/api/settings outline filter preset ops", () => {
  it("treats removing a missing preset as a no-op, and rejects a malformed add", async () => {
    const before = (await settings()).outlineFilterPresets;
    expect((await put({ removeOutlineFilterPreset: "Nope" })).status).toBe(200);
    expect((await settings()).outlineFilterPresets).toEqual(before);
    expect((await put({ addOutlineFilterPreset: { name: "x", filter: "not-a-filter" } })).status).toBe(400);
    expect((await put({ addOutlineFilterPreset: { name: "x", filter: {} }, removeOutlineFilterPreset: "x" })).status).toBe(400);
  });
});

describe("/api/settings quest streak ops", () => {
  it("spends freezes, toggles the reminder and records mission results without clobbering each other", async () => {
    await put({ recordStreakFreezeDayKey: "2025-03-01" });
    await put({ setLapseReminderEnabled: true });
    await put({ recordMissionResultDay: { dayKey: "2025-03-02", isComplete: false } });
    await put({ recordStreakFreezeDayKey: "2025-03-01" });
    const final = await (await put({ recordMissionResultDay: { dayKey: "2025-03-02", isComplete: true } })).json();

    expect(final.questStreakSync).toEqual({
      lapseReminderEnabled: true,
      freezeDayKeys: ["2025-03-01"],
      missionResultDays: [{ dayKey: "2025-03-02", isComplete: true }],
    });
  });

  it("starts from an empty sync when none is stored", async () => {
    expect((await settings()).questStreakSync).toBeNull();
    const body = await (await put({ setLapseReminderEnabled: false })).json();
    expect(body.questStreakSync).toEqual({ lapseReminderEnabled: false, freezeDayKeys: [] });
  });

  it("rejects a bad day key, a non-boolean reminder and a malformed mission result", async () => {
    expect((await put({ recordStreakFreezeDayKey: "March 1" })).status).toBe(400);
    expect((await put({ setLapseReminderEnabled: "yes" })).status).toBe(400);
    expect((await put({ recordMissionResultDay: { dayKey: "2025-03-02" } })).status).toBe(400);
    expect((await settings()).questStreakSync).toBeNull();
  });
});

describe("/api/settings news ops", () => {
  it("records reads and toggles likes against the stored lists", async () => {
    await put({ recordNewsRead: "story-1" });
    const read = await (await put({ recordNewsRead: "story-2" })).json();
    expect(read.newsRead).toEqual(expect.arrayContaining(["story-1", "story-2"]));

    await put({ addNewsLiked: "story-1" });
    await put({ addNewsLiked: "story-2" });
    const unliked = await (await put({ removeNewsLiked: "story-1" })).json();
    expect(unliked.newsLiked).toEqual(["story-2"]);
  });

  it("rejects an invalid id and a combined like op", async () => {
    expect((await put({ recordNewsRead: "" })).status).toBe(400);
    expect((await put({ addNewsLiked: "a", removeNewsLiked: "b" })).status).toBe(400);
    expect((await put({ addNewsLiked: 5 })).status).toBe(400);
  });

  it("replaces the whole read and liked lists from a plain sync", async () => {
    const body = await (await put({ newsRead: ["a", "b"], newsLiked: ["b"] })).json();
    expect(body).toMatchObject({ newsRead: ["a", "b"], newsLiked: ["b"] });
  });
});

describe("/api/settings request gating", () => {
  it("answers 400 with the list of supported keys when nothing known is sent", async () => {
    const res = await put({ unknown: true });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("Provide at least one of");
  });

  it("keeps one user's op from touching another's row", async () => {
    await put({ addFavoriteTool: "/mine" });
    const now = new Date();
    await db.insert(schema.user).values({ id: "user-2", name: "v", email: "v@example.com", createdAt: now, updatedAt: now });
    signedInAs = "user-2";
    expect((await settings()).favoriteTools).not.toContain("/mine");
  });
});
