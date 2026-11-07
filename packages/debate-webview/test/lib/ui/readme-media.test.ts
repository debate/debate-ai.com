import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  README_BADGE_ROWS,
} from "../../../src/lib/ui/features/readme-media";

const README = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..", "README.md"),
  "utf8",
);

/** Decodes the `&amp;` entities an HTML attribute may carry. */
const attr = (value: string) => value.replace(/&amp;/g, "&");

/** The README's centered badge block: the first `<p align="center">`. */
const badgeBlock = README.slice(
  README.indexOf('<p align="center">'),
  README.indexOf("</p>") + "</p>".length,
);

describe("readme-media", () => {
  it("mirrors every badge in the root README's badge block, in order", () => {
    const readmeBadges = [...badgeBlock.matchAll(/<img[^>]*?\ssrc="([^"]+)"/g)]
      .map((match) => attr(match[1]))
      .filter((src) => !src.startsWith("https://i.imgur.com/"));
    expect(README_BADGE_ROWS.flat().map((badge) => badge.src)).toEqual(readmeBadges);
  });

  it("links each badge where the README does", () => {
    for (const badge of README_BADGE_ROWS.flat()) {
      if (badge.href) expect(README).toContain(`href="${badge.href}"`);
    }
  });
});
