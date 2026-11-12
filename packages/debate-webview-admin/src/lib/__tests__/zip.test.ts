import { describe, expect, it } from "vitest"
import { buildDataDescriptor, buildEndOfCentralDirectory, buildLocalFileHeader, buildCentralDirectory } from "../src/lib/zip"

describe("zip builders", () => {
  describe("buildLocalFileHeader", () => {
    it("produces a valid local file header with the right signature", () => {
      const name = new TextEncoder().encode("test.txt")
      const header = buildLocalFileHeader(name, new Date("2024-01-01T00:00:00Z"))
      const view = new DataView(header.buffer, header.byteOffset, header.byteLength)
      expect(view.getUint32(0, true)).toBe(0x04034b50) // LOCAL_FILE_HEADER
      expect(view.getUint16(4, true)).toBe(20) // VERSION_NEEDED
      expect(view.getUint16(6, true)).toBe(0x0008) // FLAG_DATA_DESCRIPTOR
      expect(view.getUint16(8, true)).toBe(8) // METHOD_DEFLATE
      // Sizes should be zero (deferred to descriptor)
      expect(view.getUint32(18, true)).toBe(0) // crc
      expect(view.getUint32(22, true)).toBe(0) // compressed size
      expect(view.getUint32(26, true)).toBe(0) // uncompressed size
      expect(view.getUint16(30, true)).toBe(name.length)
      expect(view.getUint16(32, true)).toBe(0) // extra field length
      // Name follows at offset 30
      expect(new TextDecoder().decode(header.slice(30, 30 + name.length))).toBe("test.txt")
    })

    it("handles empty names", () => {
      const header = buildLocalFileHeader(new Uint8Array([]), new Date())
      const view = new DataView(header.buffer, header.byteOffset, header.byteLength)
      expect(view.getUint16(30, true)).toBe(0)
      expect(header.length).toBe(30)
    })
  })

  describe("buildDataDescriptor", () => {
    it("writes the descriptor signature and sizes", () => {
      const descriptor = buildDataDescriptor(0xdeadbeef, 100, 200)
      const view = new DataView(descriptor.buffer, descriptor.byteOffset, descriptor.byteLength)
      expect(view.getUint32(0, true)).toBe(0x08074b50) // DATA_DESCRIPTOR
      expect(view.getUint32(4, true)).toBe(0xdeadbeef >>> 0)
      expect(view.getUint32(8, true)).toBe(100)
      expect(view.getUint32(12, true)).toBe(200)
      expect(descriptor.length).toBe(16)
    })
  })

  describe("buildCentralDirectory", () => {
    it("writes the central directory record", () => {
      const name = new TextEncoder().encode("test.txt")
      const directory = buildCentralDirectory({
        name,
        crc: 0xdeadbeef,
        packedSize: 100,
        unpackedSize: 200,
        offset: 0,
        modified: new Date("2024-01-01T00:00:00Z"),
      })
      const view = new DataView(directory.buffer, directory.byteOffset, directory.byteLength)
      expect(view.getUint32(0, true)).toBe(0x02014b50) // CENTRAL_FILE_HEADER
      expect(view.getUint16(4, true)).toBe(0x031e) // VERSION_MADE_BY
      expect(view.getUint16(6, true)).toBe(20) // VERSION_NEEDED
      expect(view.getUint16(8, true)).toBe(0x0008) // FLAG
      expect(view.getUint16(10, true)).toBe(8) // METHOD
      expect(view.getUint32(16, true)).toBe(0xdeadbeef >>> 0) // crc
      expect(view.getUint32(20, true)).toBe(100) // packed size
      expect(view.getUint32(24, true)).toBe(200) // unpacked size
      expect(view.getUint16(28, true)).toBe(name.length)
      expect(view.getUint32(42, true)).toBe(0o100644 << 16) // EXTERNAL_ATTRIBUTES
      expect(view.getUint32(46, true)).toBe(0) // offset
      expect(new TextDecoder().decode(directory.slice(46, 46 + name.length))).toBe("test.txt")
    })
  })

  describe("buildEndOfCentralDirectory", () => {
    it("writes the end of central directory record", () => {
      const eocd = buildEndOfCentralDirectory(100, 200)
      const view = new DataView(eocd.buffer, eocd.byteOffset, eocd.byteLength)
      expect(view.getUint32(0, true)).toBe(0x06054b50) // END_OF_CENTRAL_DIRECTORY
      expect(view.getUint16(4, true)).toBe(0) // this disk
      expect(view.getUint16(6, true)).toBe(0) // disk with CD
      expect(view.getUint16(8, true)).toBe(1) // entries on this disk
      expect(view.getUint16(10, true)).toBe(1) // entries total
      expect(view.getUint32(12, true)).toBe(100) // CD size
      expect(view.getUint32(16, true)).toBe(200) // CD offset
      expect(view.getUint16(20, true)).toBe(0) // comment length
      expect(eocd.length).toBe(22)
    })
  })
})