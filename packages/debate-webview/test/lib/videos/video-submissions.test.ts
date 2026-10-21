/**
 * @fileoverview Pins how a viewer's pasted link becomes a library submission:
 * every common YouTube video link reduces to its id, and a channel link
 * reduces to the name the resync looks up — while anything that isn't
 * YouTube is turned away rather than queued for a moderator to puzzle over.
 */
import { describe, expect, it, vi } from "vitest";
import {
  fetchYouTubeOEmbed,
  isSubmissionKind,
  parseChannelName,
  parseYouTubeVideoId,
} from "../../../src/lib/videos/video-submissions";

describe("parseYouTubeVideoId", () => {
  it.each([
    ["dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s", "dQw4w9WgXcQ"],
    ["youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?si=abc", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/live/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ])("reads %s", (input, expected) => {
    expect(parseYouTubeVideoId(input)).toBe(expected);
  });

  it.each([
    "",
    "not a link",
    "https://vimeo.com/123456789",
    "https://evil.example/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/@SomeChannel",
    42,
  ])("rejects %s", (input) => {
    expect(parseYouTubeVideoId(input)).toBeNull();
  });
});

describe("parseChannelName", () => {
  it.each([
    ["https://www.youtube.com/@DebateArchive2", "@DebateArchive2"],
    ["youtube.com/@DebateArchive2/videos", "@DebateArchive2"],
    ["https://www.youtube.com/c/SomeDebate", "SomeDebate"],
    ["https://www.youtube.com/user/legacyname", "legacyname"],
    ["https://www.youtube.com/channel/UC1234567890abcdefghij", "UC1234567890abcdefghij"],
    ["@DebateArchive2", "@DebateArchive2"],
    ["  Debate Drills  ", "Debate Drills"],
  ])("reads %s", (input, expected) => {
    expect(parseChannelName(input)).toBe(expected);
  });

  it.each(["", "   ", "https://vimeo.com/someone", "https://www.youtube.com/", "x".repeat(201), null])(
    "rejects %s",
    (input) => {
      expect(parseChannelName(input)).toBeNull();
    },
  );
});

describe("isSubmissionKind", () => {
  it("accepts only the two submission kinds", () => {
    expect(isSubmissionKind("submit-video")).toBe(true);
    expect(isSubmissionKind("submit-channel")).toBe(true);
    expect(isSubmissionKind("edit")).toBe(false);
    expect(isSubmissionKind(undefined)).toBe(false);
  });
});

describe("fetchYouTubeOEmbed", () => {
  it("returns the title and channel YouTube reports", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ title: "Finals", author_name: "Debate Channel" })),
    );
    await expect(fetchYouTubeOEmbed("dQw4w9WgXcQ", fetchImpl as unknown as typeof fetch)).resolves.toEqual({
      title: "Finals",
      channel: "Debate Channel",
    });
  });

  it("gives up quietly when YouTube does not answer", async () => {
    const notFound = vi.fn(async () => new Response("Not Found", { status: 404 }));
    const throwing = vi.fn(async () => {
      throw new Error("offline");
    });
    await expect(fetchYouTubeOEmbed("dQw4w9WgXcQ", notFound as unknown as typeof fetch)).resolves.toBeNull();
    await expect(fetchYouTubeOEmbed("dQw4w9WgXcQ", throwing as unknown as typeof fetch)).resolves.toBeNull();
  });
});
