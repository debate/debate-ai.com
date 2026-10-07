import { describe, expect, it } from "vitest";

import { handleVideoListingRedirect, videoListingPath } from "../video-listing";

describe("videoListingPath", () => {
  it("opens a season as the library filtered to that year", () => {
    expect(videoListingPath("/videos/2025")).toBe("/videos?year=2025");
  });

  it("opens a season's tournament as a year filter plus a search for its name", () => {
    expect(videoListingPath("/videos/2025/college-ndt")).toBe("/videos?year=2025&q=college+ndt");
    expect(videoListingPath("/videos/2025/toc/", "?sort=Views")).toBe("/videos?sort=Views&year=2025&q=toc");
  });

  it("maps the archive season to the legacy filter", () => {
    expect(videoListingPath("/videos/archive/ndt")).toBe("/videos?year=legacy&q=ndt");
  });

  it("leaves categories, watch pages and other paths alone", () => {
    expect(videoListingPath("/videos")).toBeNull();
    expect(videoListingPath("/videos/pf")).toBeNull();
    expect(videoListingPath("/videos/2022/ndt/finals")).toBeNull();
    expect(videoListingPath("/videos/2022/ndt/finals/dartmouth-sv-michigan-pr")).toBeNull();
    expect(videoListingPath("/tournaments/2025/ndt")).toBeNull();
  });
});

describe("handleVideoListingRedirect", () => {
  it("redirects a tournament address to the filtered library", () => {
    const response = handleVideoListingRedirect(new Request("https://d.ebate.app/videos/2025/ndt"));
    expect(response?.status).toBe(302);
    expect(response?.headers.get("location")).toBe("https://d.ebate.app/videos?year=2025&q=ndt");
  });

  it("ignores non-GET requests", () => {
    expect(handleVideoListingRedirect(new Request("https://d.ebate.app/videos/2025", { method: "POST" }))).toBeNull();
  });
});
