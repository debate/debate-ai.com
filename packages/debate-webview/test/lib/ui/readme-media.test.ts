import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  README_BADGE_ROWS,
  README_BANNER,
  README_SHOWCASE,
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

/** Every imgur image in the README, normalised to one slash after the host. */
const readmeImgur = [...README.matchAll(/https:\/\/i\.imgur\.com\/+(\w+\.png)/g)].map(
  (match) => `https://i.imgur.com/${match[1]}`,
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

  it("uses the README's banner and every one of its imgur screenshots", () => {
    expect(readmeImgur[0]).toBe(README_BANNER);
    expect([README_BANNER, ...README_SHOWCASE.map((w) => w.image)]).toEqual(readmeImgur);
  });

  it("names each workspace the way the README's heading does", () => {
    for (const workspace of README_SHOWCASE) {
      expect(README).toContain(
        `### ${workspace.emoji} ${workspace.name}: ${workspace.expansion}`,
      );
    }
  });
});
