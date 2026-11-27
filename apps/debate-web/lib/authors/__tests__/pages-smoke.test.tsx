import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/database/context", () => ({
  getDBFromContext: async () => {
    throw new Error("no database");
  },
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));

describe("authors pages", () => {
  it("renders the index with a search result", async () => {
    const { default: Page } = await import("../../../app/authors/page");
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ q: "pinker" }) }));
    expect(html).toContain("/authors/steven-pinker");
  });

  it("renders an author's cards with quotations", async () => {
    const { default: Page } = await import("../../../app/authors/[slug]/page");
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ slug: "steven-pinker" }) }));
    expect(html).toContain("Steven Pinker");
    expect(html).toContain("<details");
    expect(html).toContain("application/ld+json");
  });

  it("redirects a near-miss slug to search and 404s nonsense", async () => {
    const { default: Page } = await import("../../../app/authors/[slug]/page");
    await expect(Page({ params: Promise.resolve({ slug: "pinker" }) })).rejects.toThrow(/REDIRECT \/authors\?q=/);
    await expect(Page({ params: Promise.resolve({ slug: "zzzzqqq" }) })).rejects.toThrow("NOT_FOUND");
  });
});
