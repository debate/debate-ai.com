import { afterEach, describe, expect, it } from "vitest";
import { buildEmbedUrl, describePlayerError, isPlayerMessage, pipEmbedUrl, playerOrigin, watchUrl } from "../src/components/videos/player/youtubeEmbed";

/** Stand in for a browser so `buildEmbedUrl` can read an origin. */
function withOrigin(origin: string) {
  (globalThis as unknown as { window?: unknown }).window = { location: { origin } };
}

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
});

describe("buildEmbedUrl", () => {
  it("always enables the JS API and declares the embedding origin", () => {
    withOrigin("https://debate-ai.com");
    const url = new URL(buildEmbedUrl("OXdffJy8HIs"));

    expect(url.pathname).toBe("/embed/OXdffJy8HIs");
    expect(url.searchParams.get("enablejsapi")).toBe("1");
    // Without `origin`, YouTube answers error 153 for JS-API embeds it cannot attribute.
    expect(url.searchParams.get("origin")).toBe("https://debate-ai.com");
    expect(url.searchParams.get("widget_referrer")).toBe("https://debate-ai.com");
  });

  it("omits the origin when there is no usable one", () => {
    withOrigin("null");
    expect(buildEmbedUrl("OXdffJy8HIs")).not.toContain("origin=");

    delete (globalThis as unknown as { window?: unknown }).window;
    expect(buildEmbedUrl("OXdffJy8HIs")).not.toContain("origin=");
  });

  it("carries autoplay and a whole-second start offset", () => {
    withOrigin("https://debate-ai.com");
    const url = new URL(buildEmbedUrl("OXdffJy8HIs", { autoplay: true, startSeconds: 91.7 }));

    expect(url.searchParams.get("autoplay")).toBe("1");
    expect(url.searchParams.get("start")).toBe("91");
  });

  it("leaves out a start offset at the beginning of the video", () => {
    expect(buildEmbedUrl("OXdffJy8HIs", { startSeconds: 0 })).not.toContain("start=");
  });
});

describe("describePlayerError", () => {
  it("explains the embed-configuration failure the players hit", () => {
    expect(describePlayerError(153)).toMatch(/YouTube blocked this embed/);
  });

  it("falls back to naming an unknown code", () => {
    expect(describePlayerError(999)).toContain("999");
  });
});

describe("watchUrl", () => {
  it("links to the current position when playback has started", () => {
    expect(watchUrl("OXdffJy8HIs", 42.9)).toBe("https://www.youtube.com/watch?v=OXdffJy8HIs&t=42");
    expect(watchUrl("OXdffJy8HIs")).toBe("https://www.youtube.com/watch?v=OXdffJy8HIs");
  });
});

describe("pipEmbedUrl", () => {
  it("loads the same-origin wrapper so the embed has a referrer inside PiP", () => {
    withOrigin("https://d.ebate.app");
    const url = new URL(pipEmbedUrl("OXdffJy8HIs", { autoplay: true, startSeconds: 61.7 }));

    expect(url.origin).toBe("https://d.ebate.app");
    expect(url.pathname).toBe("/youtube-player.html");
    expect(url.searchParams.get("vid")).toBe("OXdffJy8HIs");
    expect(url.searchParams.get("autoplay")).toBe("1");
    expect(url.searchParams.get("start")).toBe("61");
    expect(url.searchParams.get("origin")).toBe("https://d.ebate.app");
  });
});

describe("player messages", () => {
  const youtube = { src: "https://www.youtube.com/embed/OXdffJy8HIs", contentWindow: {} } as HTMLIFrameElement;
  const wrapper = { src: "https://d.ebate.app/youtube-player.html?vid=x", contentWindow: {} } as HTMLIFrameElement;

  it("addresses commands to whichever page the iframe loaded", () => {
    expect(playerOrigin(youtube)).toBe("https://www.youtube.com");
    expect(playerOrigin(wrapper)).toBe("https://d.ebate.app");
    expect(playerOrigin(null)).toBe("https://www.youtube.com");
  });

  it("accepts YouTube, and the wrapper only from its own frame", () => {
    expect(isPlayerMessage({ origin: "https://www.youtube.com", source: null } as MessageEvent, null)).toBe(true);
    expect(
      isPlayerMessage({ origin: "https://d.ebate.app", source: wrapper.contentWindow } as MessageEvent, wrapper),
    ).toBe(true);
    expect(isPlayerMessage({ origin: "https://d.ebate.app", source: {} } as MessageEvent, wrapper)).toBe(false);
    expect(
      isPlayerMessage({ origin: "https://evil.example", source: wrapper.contentWindow } as MessageEvent, wrapper),
    ).toBe(false);
  });
});
