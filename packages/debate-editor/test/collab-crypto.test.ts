import { describe, expect, it } from "vitest";

import {
  ROOM_KEY_BYTES,
  base64ToBytes,
  bytesToBase64,
  decodeShareCode,
  decryptBlob,
  encodeShareCode,
  encryptBlob,
  generateRoomKeyBytes,
  importRoomKey,
} from "../src/editor/collab/collab-crypto";

const ROOM = "0123456789abcdef";

describe("room keys and sealed blobs", () => {
  it("generates 32 random bytes", () => {
    const a = generateRoomKeyBytes();
    const b = generateRoomKeyBytes();
    expect(a.byteLength).toBe(ROOM_KEY_BYTES);
    expect(a).not.toEqual(b);
  });

  it("rejects a key of the wrong length", () => {
    expect(() => importRoomKey(new Uint8Array(16))).toThrow(/32 bytes/);
  });

  it("round-trips through encrypt/decrypt with a fresh IV each time", async () => {
    const key = await importRoomKey(generateRoomKeyBytes());
    const plain = new TextEncoder().encode("hello room");
    const a = await encryptBlob(key, plain);
    const b = await encryptBlob(key, plain);
    expect(a).not.toEqual(b);
    expect(new TextDecoder().decode(await decryptBlob(key, a))).toBe("hello room");
  });

  it("refuses a too-short or tampered blob", async () => {
    const key = await importRoomKey(generateRoomKeyBytes());
    await expect(decryptBlob(key, new Uint8Array(12))).rejects.toThrow(/too short/);
    const sealed = await encryptBlob(key, new Uint8Array([1, 2, 3]));
    sealed[sealed.length - 1]! ^= 0xff;
    await expect(decryptBlob(key, sealed)).rejects.toThrow();
  });

  it("refuses a blob sealed under another key", async () => {
    const k1 = await importRoomKey(generateRoomKeyBytes());
    const k2 = await importRoomKey(generateRoomKeyBytes());
    const sealed = await encryptBlob(k1, new Uint8Array([9]));
    await expect(decryptBlob(k2, sealed)).rejects.toThrow();
  });
});

describe("base64", () => {
  it("round-trips arbitrary and large byte arrays", () => {
    const small = new Uint8Array([0, 1, 254, 255]);
    expect(bytesToBase64(small)).toBe("AAH+/w==");
    expect(base64ToBytes("AAH+/w==")).toEqual(small);

    const big = new Uint8Array(0x8000 * 2 + 7).map((_, i) => i % 256);
    expect(base64ToBytes(bytesToBase64(big))).toEqual(big);
  });
});

describe("share codes", () => {
  const key = new Uint8Array(ROOM_KEY_BYTES).map((_, i) => 250 - i);

  it("round-trips a v1 code", () => {
    const code = encodeShareCode(ROOM, key);
    expect(code.startsWith("cmshare1.")).toBe(true);
    expect(code).not.toMatch(/[+/=]/);
    expect(decodeShareCode(`  ${code}  `)).toEqual({ roomId: ROOM, keyBytes: key });
  });

  it("round-trips a v2 code carrying a dotted minimum version", () => {
    const code = encodeShareCode(ROOM, key, "1.2.3-beta.4");
    expect(code.startsWith("cmshare2.")).toBe(true);
    expect(decodeShareCode(code)).toEqual({ roomId: ROOM, keyBytes: key, minVersion: "1.2.3-beta.4" });
  });

  it.each([
    ["wrong prefix", `nope.${ROOM}.AAAA`],
    ["too few parts", "cmshare1.abc"],
    ["bad room id", "cmshare1.XYZ.AAAA"],
    ["short key", `cmshare1.${ROOM}.AAAA`],
    ["invalid base64", `cmshare1.${ROOM}.%%%%`],
    ["bad min version", `cmshare2.${ROOM}.AAAA.x.y`],
  ])("rejects %s", (_label, code) => {
    expect(decodeShareCode(code)).toBeNull();
  });
});
