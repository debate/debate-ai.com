import { describe, expect, it } from "vitest";
import { sanitizeForFilename } from "../src/react/singleton.js";

describe("sanitizeForFilename", () => {
  it("leaves an already-safe key untouched", () => {
    expect(sanitizeForFilename("my-document_v2.final")).toBe("my-document_v2.final");
  });

  it("collapses path separators, the one character a browser's `download` filename can't carry", () => {
    expect(sanitizeForFilename("../../etc/passwd")).toBe("..-..-etc-passwd");
  });

  it("collapses runs of unsafe characters to a single dash", () => {
    expect(sanitizeForFilename("Round 1: Aff vs Neg?!")).toBe("Round-1-Aff-vs-Neg");
  });

  it("trims leading and trailing dashes left over from unsafe edges", () => {
    expect(sanitizeForFilename("::weird key::")).toBe("weird-key");
  });

  it("falls back to a generic name when nothing safe survives", () => {
    expect(sanitizeForFilename("???")).toBe("document");
    expect(sanitizeForFilename("")).toBe("document");
  });
});
