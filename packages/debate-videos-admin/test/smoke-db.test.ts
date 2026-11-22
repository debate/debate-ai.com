import { describe, it, expect } from "vitest";
import { freshDb } from "./helpers/db";
import { youtubeRoundVideos } from "@/lib/database/schema";

describe("freshDb smoke", () => {
  it("creates a db and inserts a row", async () => {
    const db = await freshDb();
    await db.insert(youtubeRoundVideos).values({
      id: "aaaaaaaaaaa",
      title: "Round a",
      publishedAt: "2026-03-01",
      channel: "Ch",
      views: 1,
      description: "d",
    });
    const rows = await db.select().from(youtubeRoundVideos);
    expect(rows).toHaveLength(1);
  });
});
