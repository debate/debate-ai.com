/**
 * @fileoverview The admin "add a transcript to any video" box accepts
 * whatever an editor pastes, so every common YouTube link shape has to land
 * on the same id — and a non-YouTube string must not be mistaken for one.
 */

import { describe, expect, it } from "vitest";
import { parseYouTubeVideoId } from "../src/lib/youtube-video-id";

describe("parseYouTubeVideoId", () => {
  it.each([
    "dQw4w9WgXcQ",
    "  dQw4w9WgXcQ  ",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s",
    "youtube.com/watch?v=dQw4w9WgXcQ",
    "https://m.youtube.com/watch?feature=share&v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ?si=abc",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/live/dQw4w9WgXcQ",
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    "https://debate-ai.com/videos/watch?v=dQw4w9WgXcQ",
  ])("reads %s", (input) => {
    expect(parseYouTubeVideoId(input)).toBe("dQw4w9WgXcQ");
  });

  it.each(["", "not a video", "https://www.youtube.com/@channel", "https://youtu.be/short"])(
    "rejects %s",
    (input) => {
      expect(parseYouTubeVideoId(input)).toBeNull();
    },
  );
});
