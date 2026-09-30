import { describe, expect, it } from "vitest";

import { handleCategoryPathRedirect } from "../category-paths";

function redirectFor(url: string): Response | null {
  return handleCategoryPathRedirect(new Request(url));
}

describe("handleCategoryPathRedirect", () => {
  it("permanently redirects an old page to its category path, query intact", () => {
    const response = redirectFor("https://d.ebate.app/cards/coverage?topic=nato");
    expect(response?.status).toBe(308);
    expect(response?.headers.get("location")).toBe(
      "https://d.ebate.app/research/cards/coverage?topic=nato",
    );
  });

  it("moves lecture categories under /lectures", () => {
    expect(redirectFor("https://d.ebate.app/videos/topic_lectures")?.headers.get("location")).toBe(
      "https://d.ebate.app/lectures/topic_lectures",
    );
  });

  it("leaves pages that did not move alone", () => {
    expect(redirectFor("https://d.ebate.app/videos/pf")).toBeNull();
    expect(redirectFor("https://d.ebate.app/practice/drills")).toBeNull();
    expect(redirectFor("https://d.ebate.app/coaching")).toBeNull();
    expect(redirectFor("https://d.ebate.app/api/tournaments")).toBeNull();
  });
});
