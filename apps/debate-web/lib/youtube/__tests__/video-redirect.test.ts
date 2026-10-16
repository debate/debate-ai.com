import { describe, expect, it } from "vitest";
import { youtubeWatchRedirect } from "../video-redirect";

describe("youtubeWatchRedirect", () => {
  it("routes a path-based video link directly to YouTube", () => {
    const destination = youtubeWatchRedirect(new Request("https://debate-ai.com/youtube/dQw4w9WgXcQ?t=43&foo=ignored"));

    expect(destination?.toString()).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=43");
  });

  it("supports YouTube-style query links and approved playback parameters", () => {
    const destination = youtubeWatchRedirect(
      new Request("https://debate-ai.com/youtube/watch?v=dQw4w9WgXcQ&list=PL123&index=2&si=share-token"),
    );

    expect(destination?.toString()).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123&index=2&si=share-token",
    );
  });

  it("does not turn invalid, non-video, or mutating requests into redirects", () => {
    expect(youtubeWatchRedirect(new Request("https://debate-ai.com/youtube/too-short"))).toBeNull();
    expect(youtubeWatchRedirect(new Request("https://debate-ai.com/not-youtube?v=dQw4w9WgXcQ"))).toBeNull();
    expect(youtubeWatchRedirect(new Request("https://debate-ai.com/youtube/dQw4w9WgXcQ", { method: "POST" }))).toBeNull();
  });
});
