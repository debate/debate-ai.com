/**
 * @fileoverview Round-trips `SevenZipWriter` archives through a small 7z reader
 * written from 7-Zip's `7zFormat.txt`: the signature header's CRCs and
 * offsets, every property of the archive header (including the variable-length
 * NUMBER encoding at its byte-length boundaries), and the packed Deflate
 * stream, inflated back with Node's zlib and checked against the input.
 */

import { inflateRawSync } from "node:zlib"
import { describe, expect, it } from "vitest"

import { SharedDeflate } from "../../src/lib/deflate"
import { buildHeader, buildSignatureHeader, crc32, SevenZipWriter } from "../../src/lib/seven-zip"

/** Cursor over a byte array with 7z's primitive readers. */
class Reader {
  offset = 0
  constructor(private readonly bytes: Uint8Array) {}
  byte(): number {
    if (this.offset >= this.bytes.length) throw new Error("read past end")
    return this.bytes[this.offset++]
  }
  uint32(): number {
    let v = 0
    for (let i = 0; i < 4; i++) v |= this.byte() << (8 * i)
    return v >>> 0
  }
  uint64(): bigint {
    let v = 0n
    for (let i = 0; i < 8; i++) v |= BigInt(this.byte()) << BigInt(8 * i)
    return v
  }
  /** 7z NUMBER, per `ReadNumber` in 7zFormat.txt. */
  number(): bigint {
    const first = this.byte()
    let mask = 0x80
    let value = 0n
    for (let i = 0; i < 8; i++) {
      if ((first & mask) === 0) {
        return value + (BigInt(first & (mask - 1)) << BigInt(8 * i))
      }
      value |= BigInt(this.byte()) << BigInt(8 * i)
      mask >>= 1
    }
    return value
  }
  expect(id: number, what: string) {
    const got = this.byte()
    if (got !== id) throw new Error(`expected ${what} (0x${id.toString(16)}) at ${this.offset - 1}, got 0x${got.toString(16)}`)
  }
  get done() {
    return this.offset === this.bytes.length
  }
}

interface ParsedHeader {
  packPos: bigint
  packSize: bigint
  method: number[]
  unpackSize: bigint
  crc: number
  fileName: string
  modified: Date
}

function parseHeader(bytes: Uint8Array): ParsedHeader {
  const r = new Reader(bytes)
  r.expect(0x01, "kHeader")
  r.expect(0x04, "kMainStreamsInfo")
  r.expect(0x06, "kPackInfo")
  const packPos = r.number()
  expect(r.number()).toBe(1n)
  r.expect(0x09, "kSize")
  const packSize = r.number()
  r.expect(0x00, "kEnd")
  r.expect(0x07, "kUnPackInfo")
  r.expect(0x0b, "kFolder")
  expect(r.number()).toBe(1n)
  expect(r.byte()).toBe(0) // not external
  expect(r.number()).toBe(1n) // one coder
  const flags = r.byte()
  // Simple coder (no 0x10), no properties (no 0x20), id size in the low nibble.
  expect(flags & 0xf0).toBe(0)
  const method = Array.from({ length: flags & 0x0f }, () => r.byte())
  r.expect(0x0c, "kCodersUnPackSize")
  const unpackSize = r.number()
  r.expect(0x0a, "kCRC")
  expect(r.byte()).toBe(1) // all defined
  const crc = r.uint32()
  r.expect(0x00, "kEnd")
  r.expect(0x00, "kEnd")
  r.expect(0x05, "kFilesInfo")
  expect(r.number()).toBe(1n)
  r.expect(0x11, "kName")
  const nameSize = Number(r.number())
  const nameStart = r.offset
  expect(r.byte()).toBe(0) // not external
  let fileName = ""
  for (;;) {
    const code = r.byte() | (r.byte() << 8)
    if (code === 0) break
    fileName += String.fromCharCode(code)
  }
  expect(r.offset - nameStart).toBe(nameSize)
  r.expect(0x14, "kMTime")
  expect(r.number()).toBe(10n)
  expect(r.byte()).toBe(1)
  expect(r.byte()).toBe(0)
  const ticks = r.uint64()
  const modified = new Date(Number(ticks / 10000n - 11644473600000n))
  r.expect(0x00, "kEnd")
  r.expect(0x00, "kEnd")
  expect(r.done).toBe(true)
  return { packPos, packSize, method, unpackSize, crc, fileName, modified }
}

/** Reads a whole archive, validating the signature header, and returns its parts. */
function readArchive(archive: Uint8Array) {
  expect(Array.from(archive.subarray(0, 6))).toEqual([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])
  expect(Array.from(archive.subarray(6, 8))).toEqual([0, 4])
  const sig = new Reader(archive.subarray(8, 32))
  const startHeaderCrc = sig.uint32()
  expect(crc32(archive.subarray(12, 32))).toBe(startHeaderCrc)
  const nextHeaderOffset = Number(sig.uint64())
  const nextHeaderSize = Number(sig.uint64())
  const nextHeaderCrc = sig.uint32()
  const headerStart = 32 + nextHeaderOffset
  expect(headerStart + nextHeaderSize).toBe(archive.length)
  const headerBytes = archive.subarray(headerStart, headerStart + nextHeaderSize)
  expect(crc32(headerBytes)).toBe(nextHeaderCrc)
  const header = parseHeader(headerBytes)
  const packed = archive.subarray(32 + Number(header.packPos), 32 + Number(header.packPos) + Number(header.packSize))
  return { header, packed }
}

async function* chunksOf(bytes: Uint8Array, size: number) {
  for (let i = 0; i < bytes.length; i += size) yield bytes.subarray(i, i + size)
}

/** Deflates `input` through `SharedDeflate` into a writer, as the backup job does. */
async function pack(input: Uint8Array, fileName: string, maxBytes?: number, modified?: Date) {
  const shared = new SharedDeflate()
  const writer = new SevenZipWriter(fileName, maxBytes)
  for await (const chunk of shared.deflate(chunksOf(input, 4096))) writer.writePacked(chunk)
  return { writer, sizes: shared.sizes, archive: writer.finish(shared.sizes, modified) }
}

describe("crc32", () => {
  it("matches the standard CRC-32 check value", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926)
  })

  it("gives the same result chunked as in one pass", () => {
    const bytes = new TextEncoder().encode("The quick brown fox jumps over the lazy dog")
    const whole = crc32(bytes)
    expect(whole).toBe(0x414fa339)
    let running = 0
    for (let i = 0; i < bytes.length; i += 5) running = crc32(bytes.subarray(i, i + 5), running)
    expect(running).toBe(whole)
  })
})

describe("SevenZipWriter round trip", () => {
  it("produces an archive whose packed stream inflates back to the input", async () => {
    const sql = Array.from({ length: 2000 }, (_, i) => `INSERT INTO t VALUES (${i}, 'row ${i}');\n`).join("")
    const input = new TextEncoder().encode(sql)
    const modified = new Date("2026-11-24T12:34:56.789Z")
    const { archive, sizes } = await pack(input, "backup-2026-11-24.sql", undefined, modified)

    const { header, packed } = readArchive(archive!)
    expect(header).toEqual({
      packPos: 0n,
      packSize: BigInt(sizes.packedSize),
      method: [0x04, 0x01, 0x08],
      unpackSize: BigInt(input.length),
      crc: crc32(input),
      fileName: "backup-2026-11-24.sql",
      modified,
    })
    expect(sizes.uncompressedSize).toBe(input.length)
    expect(packed.length).toBeLessThan(input.length)
    expect(Buffer.from(inflateRawSync(packed)).equals(Buffer.from(input))).toBe(true)
  })

  it("encodes a non-ASCII file name as UTF-16LE", async () => {
    const { archive } = await pack(new TextEncoder().encode("x"), "dump-é—ü.sql")
    expect(readArchive(archive!).header.fileName).toBe("dump-é—ü.sql")
  })

  it("archives an empty input", async () => {
    const { archive } = await pack(new Uint8Array(0), "empty.sql")
    const { header, packed } = readArchive(archive!)
    expect(header.unpackSize).toBe(0n)
    expect(header.crc).toBe(0)
    expect(inflateRawSync(packed).length).toBe(0)
  })

  it("gives up past maxBytes, ignores further input, and finishes with null", async () => {
    const writer = new SevenZipWriter("big.sql", 2000)
    writer.writePacked(new Uint8Array(500))
    expect(writer.tooLarge).toBe(false)
    writer.writePacked(new Uint8Array(500))
    expect(writer.tooLarge).toBe(true)
    writer.writePacked(new Uint8Array(1))
    expect(writer.finish({ crc: 0, packedSize: 1001, uncompressedSize: 5000 })).toBeNull()
  })

  it("reserves room for the headers when checking maxBytes", () => {
    // 2000 - 32 - 1024 = 944 bytes of packed data is the most that fits.
    const fits = new SevenZipWriter("a", 2000)
    fits.writePacked(new Uint8Array(944))
    expect(fits.tooLarge).toBe(false)
    const over = new SevenZipWriter("a", 2000)
    over.writePacked(new Uint8Array(945))
    expect(over.tooLarge).toBe(true)
  })

  it("lays out several packed chunks contiguously", () => {
    const writer = new SevenZipWriter("parts.bin")
    writer.writePacked(Uint8Array.of(1, 2, 3))
    writer.writePacked(Uint8Array.of(4, 5))
    const archive = writer.finish({ crc: 7, packedSize: 5, uncompressedSize: 9 }, new Date(0))!
    const { header, packed } = readArchive(archive)
    expect(Array.from(packed)).toEqual([1, 2, 3, 4, 5])
    expect(header).toMatchObject({ packSize: 5n, unpackSize: 9n, crc: 7, modified: new Date(0) })
  })
})

describe("buildHeader NUMBER encoding", () => {
  // Each boundary moves the NUMBER to one more byte.
  const sizes = [0, 1, 0x7f, 0x80, 0x3fff, 0x4000, 0x1fffff, 0x200000, 0xfffffff, 0x10000000, 2 ** 32 + 5, 2 ** 40 + 3, Number.MAX_SAFE_INTEGER]

  it.each(sizes)("round-trips a packed and unpacked size of %d", (size) => {
    const header = buildHeader({ fileName: "f", packedSize: size, unpackedSize: size, crc: 0xdeadbeef, modified: new Date(1e12) })
    const parsed = parseHeader(header)
    expect(parsed.packSize).toBe(BigInt(size))
    expect(parsed.unpackSize).toBe(BigInt(size))
    expect(parsed.crc).toBe(0xdeadbeef)
  })

  it("uses one byte below 0x80 and two from 0x80", () => {
    const small = buildHeader({ fileName: "f", packedSize: 0x7f, unpackedSize: 0, crc: 0, modified: new Date(0) })
    const large = buildHeader({ fileName: "f", packedSize: 0x80, unpackedSize: 0, crc: 0, modified: new Date(0) })
    expect(large.length - small.length).toBe(1)
  })
})

describe("buildSignatureHeader", () => {
  it("is 32 bytes pointing at the header with matching CRCs", () => {
    const header = Uint8Array.of(1, 2, 3, 4)
    const sig = buildSignatureHeader(1234, header)
    expect(sig.length).toBe(32)
    const r = new Reader(sig.subarray(8))
    expect(r.uint32()).toBe(crc32(sig.subarray(12)))
    expect(r.uint64()).toBe(1234n)
    expect(r.uint64()).toBe(4n)
    expect(r.uint32()).toBe(crc32(header))
  })
})
