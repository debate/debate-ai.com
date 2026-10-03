import { describe, expect, it } from "vitest";
import { PRODUCT_NEWS, buildAutoFeatureNews } from "@debate/community/src/lib/news-stream";
import { APP_FEATURES } from "../../src/lib/feature-catalog";

describe("buildAutoFeatureNews over the real catalog", () => {
  it("gives every uncovered APP_FEATURES href exactly one product spotlight", () => {
    const items = buildAutoFeatureNews(APP_FEATURES);
    const coveredHrefs = new Set(PRODUCT_NEWS.map((item) => item.href));
    const expectedCount = APP_FEATURES.filter((feature) => !coveredHrefs.has(feature.href)).length;
    expect(items).toHaveLength(expectedCount);
    expect(items.every((item) => item.category === "product")).toBe(true);
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
  });
});
