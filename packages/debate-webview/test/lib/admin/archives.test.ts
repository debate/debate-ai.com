/**
 * The admin export archive writers — `.zip` (one file or several), `.7z` and
 * the gzip member — checked by reading every archive back: parsing its
 * records, inflating the packed stream with the runtime's own
 * `DecompressionStream` and matching the CRC and sizes it recorded.
 */
import { describe, expect, it } from "vitest"
import { GZIP_HEADER, gzipTrailer, SharedDeflate } from "../../../src/lib/admin/deflate"
import { buildHeader, buildSignatureHeader, crc32, SevenZipWriter } from "../../../src/lib/admin/seven-zip"
import {
  buildCentralDirectory,
  buildDataDescriptor,
  buildEndOfCentralDirectory,
  buildLocalFileHeader,
  zipFilesStream,
  zipSingleFileStream,
} from "../../../src/lib/admin/zip"

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const MODIFIED = new Date(2026, 4, 17, 13, 45, 30)

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
}

async function* iterate(...chunks: string[]): AsyncGenerator<Uint8Array> {
  for (const chunk of chunks) yield encoder.encode(chunk)
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function inflate(bytes: Uint8Array, format: CompressionFormat = "deflate-raw"): Promise<string> {
  const stream = new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream(format))
  return decoder.decode(await readAll(stream))
}

const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

/** Reads a ZIP from its end-of-central-directory record, as an extractor does. */
function readZip(zip: Uint8Array) {
  const v = view(zip)
  const eocd = zip.length - 22
  expect(v.getUint32(eocd, true)).toBe(0x06054b50)
  const count = v.getUint16(eocd + 10, true)
  expect(v.getUint16(eocd + 8, true)).toBe(count)
  const dirSize = v.getUint32(eocd + 12, true)
  let at = v.getUint32(eocd + 16, true)
  expect(at + dirSize).toBe(eocd)
  const entries = []
  for (let i = 0; i < count; i++) {
    expect(v.getUint32(at, true)).toBe(0x02014b50)
    const crc = v.getUint32(at + 16, true)
    const packedSize = v.getUint32(at + 20, true)
    const unpackedSize = v.getUint32(at + 24, true)
    const nameLength = v.getUint16(at + 28, true)
    const offset = v.getUint32(at + 42, true)
    const name = decoder.decode(zip.subarray(at + 46, at + 46 + nameLength))
    at += 46 + nameLength
    // The local header the directory points at, and its data descriptor.
    expect(v.getUint32(offset, true)).toBe(0x04034b50)
    const dataStart = offset + 30 + v.getUint16(offset + 26, true)
    const packed = zip.subarray(dataStart, dataStart + packedSize)
    const descriptor = dataStart + packedSize
    expect(v.getUint32(descriptor, true)).toBe(0x08074b50)
    expect(v.getUint32(descriptor + 4, true)).toBe(crc)
    entries.push({ name, crc, packedSize, unpackedSize, packed })
  }
  return entries
}

describe("zip records", () => {
  it("leaves sizes to the data descriptor and encodes the DOS timestamp", () => {
    const header = buildLocalFileHeader(encoder.encode("a.sql"), MODIFIED)
    const v = view(header)
    expect(v.getUint16(6, true)).toBe(0x0008)
    expect(v.getUint16(8, true)).toBe(8)
    const time = v.getUint16(10, true)
    const date = v.getUint16(12, true)
    expect([time >> 11, (time >> 5) & 0x3f, (time & 0x1f) * 2]).toEqual([13, 45, 30])
    expect([(date >> 9) + 1980, (date >> 5) & 0x0f, date & 0x1f]).toEqual([2026, 5, 17])
  })

  it("writes the descriptor, directory and end records with the given values", () => {
    const d = view(buildDataDescriptor(0xdeadbeef, 10, 20))
    expect([d.getUint32(4, true), d.getUint32(8, true), d.getUint32(12, true)]).toEqual([0xdeadbeef, 10, 20])

    const dir = buildCentralDirectory({ name: encoder.encode("x"), crc: 1, packedSize: 2, unpackedSize: 3, offset: 4, modified: MODIFIED })
    expect(view(dir).getUint32(42, true)).toBe(4)

    const end = view(buildEndOfCentralDirectory(46, 100, 3))
    expect([end.getUint16(8, true), end.getUint16(10, true), end.getUint32(12, true), end.getUint32(16, true)]).toEqual([3, 3, 46, 100])
    expect(view(buildEndOfCentralDirectory(1, 2)).getUint16(10, true)).toBe(1)
  })
})

describe("zipSingleFileStream", () => {
  it("packs one file that inflates back to its input with a matching CRC", async () => {
    const text = "INSERT INTO t VALUES (1);\n".repeat(200)
    const zip = await readAll(zipSingleFileStream("dump.sql", streamOf(text.slice(0, 1000), text.slice(1000)), MODIFIED))
    const [entry, ...rest] = readZip(zip)
    expect(rest).toEqual([])
    expect(entry.name).toBe("dump.sql")
    expect(entry.unpackedSize).toBe(text.length)
    expect(entry.crc).toBe(crc32(encoder.encode(text)))
    expect(await inflate(entry.packed)).toBe(text)
    expect(entry.packedSize).toBeLessThan(text.length)
  })

  it("packs an empty file", async () => {
    const [entry] = readZip(await readAll(zipSingleFileStream("empty.txt", streamOf())))
    expect([entry.unpackedSize, entry.crc]).toEqual([0, 0])
    expect(await inflate(entry.packed)).toBe("")
  })

  it("errors the archive when the source fails, and can be cancelled", async () => {
    const failing = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error("source broke"))
      },
    })
    await expect(readAll(zipSingleFileStream("bad.sql", failing))).rejects.toThrow("source broke")

    const reader = zipSingleFileStream("c.sql", streamOf("abc")).getReader()
    await reader.read()
    await expect(reader.cancel()).resolves.toBeUndefined()
  })
})

describe("zipFilesStream", () => {
  it("writes each file in turn, opening a source only when its turn comes", async () => {
    const opened: string[] = []
    const files = { "users.csv": "id,name\n1,Ada\n", "cards.csv": "id\n" + "card\n".repeat(500), "empty.csv": "" }
    const zip = await readAll(
      zipFilesStream(
        Object.entries(files).map(([name, text]) => ({
          name,
          open: () => {
            opened.push(name)
            return streamOf(text)
          },
        })),
        MODIFIED,
      ),
    )
    expect(opened).toEqual(Object.keys(files))
    const entries = readZip(zip)
    expect(entries.map((e) => e.name)).toEqual(Object.keys(files))
    for (const entry of entries) {
      const text = files[entry.name as keyof typeof files]
      expect(await inflate(entry.packed)).toBe(text)
      expect(entry.crc).toBe(crc32(encoder.encode(text)))
      expect(entry.unpackedSize).toBe(text.length)
    }
  })

  it("is a valid empty archive with no files", async () => {
    expect(readZip(await readAll(zipFilesStream([])))).toEqual([])
  })

  it("errors when a file's source fails", async () => {
    const stream = zipFilesStream([
      { name: "ok.csv", open: () => streamOf("fine") },
      {
        name: "bad.csv",
        open: () =>
          new ReadableStream({
            pull(controller) {
              controller.error(new Error("query failed"))
            },
          }),
      },
    ])
    await expect(readAll(stream)).rejects.toThrow("query failed")
  })

  it("stops reading when cancelled", async () => {
    const reader = zipFilesStream([{ name: "a.csv", open: () => streamOf("a") }]).getReader()
    await reader.read()
    await expect(reader.cancel()).resolves.toBeUndefined()
  })
})

describe("SharedDeflate and the gzip member", () => {
  it("tallies the CRC and sizes while producing a stream gzip can read", async () => {
    const parts = ["hello ", "world ".repeat(100)]
    const deflate = new SharedDeflate()
    const packed: Uint8Array[] = []
    for await (const chunk of deflate.deflate(iterate(...parts))) packed.push(chunk)
    const { crc, packedSize, uncompressedSize } = deflate.sizes
    const text = parts.join("")
    expect(uncompressedSize).toBe(text.length)
    expect(crc).toBe(crc32(encoder.encode(text)))
    expect(packedSize).toBe(packed.reduce((n, c) => n + c.byteLength, 0))

    const member = new Uint8Array(await new Blob([GZIP_HEADER, ...packed, gzipTrailer(crc, uncompressedSize)] as BlobPart[]).arrayBuffer())
    expect(await inflate(member, "gzip")).toBe(text)
  })

  it("passes a failing source's error on", async () => {
    async function* broken(): AsyncGenerator<Uint8Array> {
      yield encoder.encode("start")
      throw new Error("dump failed")
    }
    const deflate = new SharedDeflate()
    await expect(
      (async () => {
        for await (const _ of deflate.deflate(broken())) void _
      })(),
    ).rejects.toThrow("dump failed")
  })
})

describe("crc32", () => {
  it("matches the IEEE check value and chains across chunks", () => {
    expect(crc32(encoder.encode("123456789"))).toBe(0xcbf43926)
    expect(crc32(encoder.encode("6789"), crc32(encoder.encode("12345")))).toBe(0xcbf43926)
    expect(crc32(new Uint8Array())).toBe(0)
  })
})

describe("SevenZipWriter", () => {
  async function packed(text: string) {
    const deflate = new SharedDeflate()
    const chunks: Uint8Array[] = []
    for await (const chunk of deflate.deflate(iterate(text))) chunks.push(chunk)
    return { chunks, sizes: deflate.sizes }
  }

  it("lays out signature header, packed stream and archive header", async () => {
    const text = "SELECT 1;\n".repeat(300)
    const { chunks, sizes } = await packed(text)
    const writer = new SevenZipWriter("dump.sql")
    for (const chunk of chunks) writer.writePacked(chunk)
    expect(writer.tooLarge).toBe(false)
    const archive = writer.finish(sizes, MODIFIED)!

    expect(Array.from(archive.subarray(0, 6))).toEqual([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])
    const v = view(archive)
    const startHeader = archive.subarray(12, 32)
    expect(v.getUint32(8, true)).toBe(crc32(startHeader))
    const nextOffset = Number(v.getBigUint64(12, true))
    const nextLength = Number(v.getBigUint64(20, true))
    expect(nextOffset).toBe(sizes.packedSize)
    const header = archive.subarray(32 + nextOffset, 32 + nextOffset + nextLength)
    expect(32 + nextOffset + nextLength).toBe(archive.length)
    expect(v.getUint32(28, true)).toBe(crc32(header))
    expect(header).toEqual(
      buildHeader({ fileName: "dump.sql", packedSize: sizes.packedSize, unpackedSize: text.length, crc: sizes.crc, modified: MODIFIED }),
    )
    expect(await inflate(archive.subarray(32, 32 + nextOffset))).toBe(text)
  })

  it("encodes large sizes as multi-byte numbers and the name as UTF-16", () => {
    const small = buildHeader({ fileName: "a", packedSize: 1, unpackedSize: 1, crc: 0, modified: MODIFIED })
    const large = buildHeader({ fileName: "a", packedSize: 70_000, unpackedSize: 2 ** 40, crc: 0, modified: MODIFIED })
    expect(large.length).toBeGreaterThan(small.length)
    const name = buildHeader({ fileName: "é", packedSize: 1, unpackedSize: 1, crc: 0, modified: MODIFIED })
    expect(Array.from(name)).toEqual(expect.arrayContaining([0xe9, 0x00]))
    expect(buildSignatureHeader(0, new Uint8Array())).toHaveLength(32)
  })

  it("gives up once the packed stream outgrows maxBytes", () => {
    const writer = new SevenZipWriter("big.sql", 2000)
    writer.writePacked(new Uint8Array(500))
    expect(writer.tooLarge).toBe(false)
    writer.writePacked(new Uint8Array(1000))
    expect(writer.tooLarge).toBe(true)
    writer.writePacked(new Uint8Array(10))
    expect(writer.finish({ crc: 0, packedSize: 1510, uncompressedSize: 5000 })).toBeNull()
  })
})
