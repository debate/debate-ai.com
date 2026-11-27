import { describe, expect, it } from "vitest";
import type { AuthorsDataset } from "@debate-ai/help-docs/lib/authors/types";
import snapshot from "../authors-snapshot.json";
import { listAuthorsFromDataset, profileFromDataset, searchWords } from "../author-queries";

const dataset = snapshot as unknown as AuthorsDataset;

describe("searchWords", () => {
  it("folds case, accents and punctuation", () => {
    expect(searchWords("  Slavoj  ŽIŽEK! ")).toEqual(["slavoj", "zizek"]);
    expect(searchWords(undefined)).toEqual([]);
  });
});

describe("listAuthorsFromDataset", () => {
  it("ranks by cards, then quoted cards, then name, and pages the result", () => {
    const first = listAuthorsFromDataset(dataset, { pageSize: 10 });
    expect(first.authors).toHaveLength(10);
    expect(first.total).toBe(dataset.authors.length);
    expect(first.totalPages).toBe(Math.ceil(dataset.authors.length / 10));
    for (let i = 1; i < first.authors.length; i++) {
      const [a, b] = [first.authors[i - 1]!, first.authors[i]!];
      expect([b.cardCount - a.cardCount, b.quoteCount - a.quoteCount].find((diff) => diff !== 0) ?? 0).toBeLessThanOrEqual(0);
    }
    expect(first.authors[0]!.slug).toBe("slavoj-zizek");
    const second = listAuthorsFromDataset(dataset, { pageSize: 10, page: 2 });
    expect(second.authors.map((author) => author.id)).not.toEqual(expect.arrayContaining([first.authors[0]!.id]));
  });

  it("finds a name by any of its words, ignoring accents", () => {
    expect(listAuthorsFromDataset(dataset, { q: "zizek" }).authors.map((author) => author.slug)).toEqual(["slavoj-zizek"]);
    expect(listAuthorsFromDataset(dataset, { q: "Wachowski" }).total).toBe(2);
    expect(listAuthorsFromDataset(dataset, { q: "lana wachowski" }).authors.map((author) => author.slug)).toEqual(["lana-wachowski"]);
  });

  it("finds a pen name through the alias", () => {
    expect(listAuthorsFromDataset(dataset, { q: "synergy" }).authors.map((author) => author.slug)).toContain("alex-gulakov");
  });

  it("clamps the page and page size", () => {
    const page = listAuthorsFromDataset(dataset, { page: 9999, pageSize: 100000 });
    expect(page.page).toBe(page.totalPages);
    expect(page.pageSize).toBe(100);
    expect(listAuthorsFromDataset(dataset, { q: "no such author zzz" })).toMatchObject({ total: 0, totalPages: 1, authors: [] });
  });
});

describe("profileFromDataset", () => {
  it("returns every card an author is credited on, with co-authors", () => {
    const profile = profileFromDataset(dataset, "michael-c-williams")!;
    expect(profile.author.cardCount).toBe(profile.cards.length);
    expect(profile.cards.some((card) => card.coAuthors.some((coAuthor) => coAuthor.slug === "keith-krause"))).toBe(true);
    expect(profile.cards.every((card) => "quoteText" in card === false)).toBe(true);
  });

  it("lists the newest cards first", () => {
    const years = profileFromDataset(dataset, "slavoj-zizek")!.cards.map((card) => card.yearNumber ?? -Infinity);
    expect(years).toEqual([...years].sort((a, b) => b - a));
  });

  it("returns null for an unknown slug", () => {
    expect(profileFromDataset(dataset, "nobody")).toBeNull();
  });
});
