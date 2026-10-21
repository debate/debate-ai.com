import { describe, expect, it } from "vitest";

import { isLikelyArticleUrl } from "../../../src/lib/url-detection/article-url";

describe("isLikelyArticleUrl", () => {
  it("accepts a page with a path on a news or journal site", () => {
    expect(isLikelyArticleUrl("https://www.brookings.edu/articles/some-policy-piece/")).toBe(true);
    expect(isLikelyArticleUrl("http://example.org/2026/10/story.html")).toBe(true);
  });

  it("rejects homepages, non-web URLs and garbage", () => {
    expect(isLikelyArticleUrl("https://nytimes.com/")).toBe(false);
    expect(isLikelyArticleUrl("chrome://extensions/")).toBe(false);
    expect(isLikelyArticleUrl("not a url")).toBe(false);
  });

  it("rejects search, video, social and app pages", () => {
    expect(isLikelyArticleUrl("https://www.google.com/search?q=nuclear")).toBe(false);
    expect(isLikelyArticleUrl("https://docs.google.com/document/d/abc/edit")).toBe(false);
    expect(isLikelyArticleUrl("https://www.youtube.com/watch?v=abcdefghijk")).toBe(false);
    expect(isLikelyArticleUrl("https://x.com/someone/status/1")).toBe(false);
    expect(isLikelyArticleUrl("https://d.ebate.app/videos")).toBe(false);
  });
});
