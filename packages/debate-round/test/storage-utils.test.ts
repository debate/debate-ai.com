import { describe, expect, it } from "vitest";
import { estimateSize, formatBytes } from "../src/utils/storage-utils";

describe("estimateSize", () => {
  it("measures a plain ASCII string in bytes", () => {
    expect(estimateSize("hello")).toBe(5);
  });

  it("counts multi-byte characters by their encoded length", () => {
    expect(estimateSize("é")).toBe(2);
    expect(estimateSize("")).toBe(0);
  });
});

describe("formatBytes", () => {
  it("labels zero explicitly", () => {
    expect(formatBytes(0)).toBe("0 Bytes");
  });

  it("scales through the unit table", () => {
    expect(formatBytes(512)).toBe("512 Bytes");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1024 * 1024)).toBe("1 MB");
    expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe("3 GB");
  });

  it("rounds to at most two decimals", () => {
    expect(formatBytes(1234567)).toBe("1.18 MB");
  });
});
