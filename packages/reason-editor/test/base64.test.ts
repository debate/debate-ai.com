import { describe, expect, it } from "vitest";
import { base64ToBytes, bytesToBase64 } from "../src/engine/ooxml/base64";

describe("base64 codec", () => {
  it("round-trips arbitrary bytes", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 255]);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  it("encodes ASCII the same way the platform does", () => {
    const bytes = new TextEncoder().encode("docx");
    expect(bytesToBase64(bytes)).toBe("ZG9jeA==");
  });

  it("decodes back to the original text", () => {
    expect(new TextDecoder().decode(base64ToBytes("ZG9jeA=="))).toBe("docx");
  });

  it("handles the empty buffer", () => {
    expect(bytesToBase64(new Uint8Array())).toBe("");
    expect(base64ToBytes("")).toEqual(new Uint8Array());
  });

  it("round-trips a payload larger than one chunk", () => {
    const big = new Uint8Array(100_000).map((_, i) => i % 256);
    expect(base64ToBytes(bytesToBase64(big))).toEqual(big);
  });
});
