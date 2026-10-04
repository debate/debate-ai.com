import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Card, PredictionMarket, Round } from "../src/index";

const srcDir = path.join(import.meta.dirname, "../src");
const files = readdirSync(srcDir).filter((f) => f.endsWith(".d.ts") && f !== "index.d.ts");

/** True when the line before `index` (skipping blank lines) closes a JSDoc block. */
function hasDocAbove(lines: string[], index: number): boolean {
  let i = index - 1;
  while (i >= 0 && lines[i].trim() === "") i--;
  return i >= 0 && lines[i].trim().endsWith("*/");
}

describe("@types/debate documentation", () => {
  it("has declaration files to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const lines = readFileSync(path.join(srcDir, file), "utf8").split("\n");

    it(`${file}: every exported type has a description`, () => {
      const missing = lines
        .map((line, i) => ({ line, i }))
        .filter(({ line }) => /^export (interface|type) /.test(line))
        .filter(({ i }) => !hasDocAbove(lines, i))
        .map(({ line }) => line);
      expect(missing).toEqual([]);
    });

    it(`${file}: every interface field has a description`, () => {
      const missing: string[] = [];
      let inInterface = false;
      lines.forEach((line, i) => {
        if (/^export interface .*\{$/.test(line)) inInterface = true;
        else if (/^\}/.test(line)) inInterface = false;
        else if (inInterface && /^ {2}(readonly )?["\w]+\??(:|\()/.test(line) && !hasDocAbove(lines, i)) {
          missing.push(line.trim());
        }
      });
      expect(missing).toEqual([]);
    });
  }

  it("exports types that resolve through the barrel", () => {
    const round: Round = {
      id: 1,
      tournamentName: "Glenbrooks",
      roundLevel: "Octos",
      debaters: { aff: ["A", "B"], neg: ["C", "D"] },
      judges: [],
      flowIds: [],
      timestamp: 0,
      status: "pending",
    };
    const card: Card = { summary: "s", author: null, author_type: null, cite: null, year: "ND", url: null };
    const market = {} as PredictionMarket;
    expect(round.status).toBe("pending");
    expect(card.year).toBe("ND");
    expect(market).toBeDefined();
  });
});
