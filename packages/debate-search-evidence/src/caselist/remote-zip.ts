/**
 * @fileoverview Reads a ZIP straight off a server with HTTP Range requests,
 * one entry at a time, without downloading the whole archive.
 *
 * openCaselist's season dumps are too big to hold in a browser tab: on
 * 2026-10-07 `hspf26-all-*.zip` was 1.87 GB and `hspolicy26-all-*.zip`
 * 760 MB. `fetch(url).arrayBuffer()` on files that size either dies with an
 * allocation error or stalls with no progress, and JSZip then needs a second
 * copy on top. The bucket serves `Accept-Ranges: bytes` with CORS open to
 * our origin, so this module reads only what it needs:
 *
 * 1. `HEAD` for the size (`Content-Length` is CORS-safelisted).
 * 2. The last 64 KiB, to find the end-of-central-directory record (and the
 *    ZIP64 one, for archives past 4 GB or 65,535 entries).
 * 3. The central directory, which lists every entry and where it starts.
 * 4. The entries themselves, a few megabytes per request, decompressed with
 *    the platform's `DecompressionStream("deflate-raw")`.
 *
 * Only `bytes=start-end` ranges are sent: that is the form CORS treats as a
 * simple header, so no preflight is needed (the bucket's preflight does not
 * list `Range` in its allowed headers).
 *
 * @module caselist/remote-zip
 */

/** One file listed in a remote archive's central directory. */
export interface RemoteZipEntry {
  /** Path inside the archive, slash-separated. */
  name: string;
  /** Whether the entry is a folder. */
  dir: boolean;
  /** 0 = stored, 8 = deflate. Anything else is unsupported. */
  method: number;
  /** General-purpose flags; bit 0 means encrypted. */
  flags: number;
  compressedSize: number;
  uncompressedSize: number;
  /** Byte offset of the entry's local file header. */
  offset: number;
}

/** An opened remote archive. */
export interface RemoteZip {
  url: string;
  /** Total archive size in bytes. */
  size: number;
  /** Every entry in central-directory order. */
  entries: RemoteZipEntry[];
  /** Where the central directory starts; also where the last entry ends. */
  centralDirectoryOffset: number;
}

/** Options shared by {@link openRemoteZip} and {@link readRemoteZipEntries}. */
export interface RemoteZipOptions {
  /** Defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

/** A read failure for one entry, reported instead of thrown. */
export class RemoteZipEntryError extends Error {
  constructor(
    message: string,
    readonly code: "encrypted" | "unsupported-compression" | "corrupt",
  ) {
    super(message);
    this.name = "RemoteZipEntryError";
  }
}

const EOCD_SIGNATURE = 0x06054b50;
const ZIP64_LOCATOR_SIGNATURE = 0x07064b50;
const ZIP64_EOCD_SIGNATURE = 0x06064b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
/** 22-byte EOCD plus the longest possible comment. */
const TAIL_BYTES = 22 + 0xffff;
/** How many bytes of neighbouring entries one request may cover. */
const DEFAULT_CHUNK_BYTES = 8 * 1024 * 1024;

/**
 * Fetches one byte range and insists the server honoured it.
 *
 * A server that ignores `Range` answers 200 with the whole file; reading that
 * body would be exactly the download this module exists to avoid, so the
 * body is cancelled and the call fails.
 */
async function fetchRange(
  url: string,
  start: number,
  end: number,
  options: RemoteZipOptions,
): Promise<Uint8Array> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(url, {
    headers: { Range: `bytes=${start}-${end}` },
    signal: options.signal,
  });
  if (response.status !== 206) {
    await response.body?.cancel().catch(() => {});
    throw new Error(
      response.ok
        ? `${url} ignored the byte-range request (HTTP ${response.status}), so it cannot be read in pieces.`
        : `Reading bytes ${start}-${end} of ${url} failed: HTTP ${response.status} ${response.statusText}`.trim(),
    );
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength !== end - start + 1) {
    throw new Error(
      `Reading bytes ${start}-${end} of ${url} returned ${bytes.byteLength} bytes instead of ${end - start + 1}.`,
    );
  }
  return bytes;
}

/** Reads a little-endian 64-bit size; archives here stay far below 2^53. */
function readUint64(view: DataView, offset: number): number {
  return view.getUint32(offset, true) + view.getUint32(offset + 4, true) * 2 ** 32;
}

/** Decodes an entry name: UTF-8 when flagged or valid, else Latin-1. */
function decodeName(bytes: Uint8Array, utf8Flag: boolean): string {
  try {
    return new TextDecoder("utf-8", { fatal: !utf8Flag }).decode(bytes);
  } catch {
    return new TextDecoder("latin1").decode(bytes);
  }
}

/**
 * Parses a central directory into entries.
 *
 * @param bytes - The central directory's bytes.
 * @returns The entries it lists.
 */
export function parseCentralDirectory(bytes: Uint8Array): RemoteZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries: RemoteZipEntry[] = [];
  let cursor = 0;
  while (cursor + 46 <= bytes.byteLength) {
    if (view.getUint32(cursor, true) !== CENTRAL_SIGNATURE) {
      throw new Error(`The archive's central directory is corrupt at byte ${cursor}.`);
    }
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    let compressedSize = view.getUint32(cursor + 20, true);
    let uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    let offset = view.getUint32(cursor + 42, true);
    const name = decodeName(
      bytes.subarray(cursor + 46, cursor + 46 + nameLength),
      (flags & 0x800) !== 0,
    );

    // ZIP64: any field saturated at 0xffffffff is carried in extra field 1,
    // in this fixed order, holding only the saturated ones.
    let extra = cursor + 46 + nameLength;
    const extraEnd = extra + extraLength;
    while (extra + 4 <= extraEnd) {
      const id = view.getUint16(extra, true);
      const size = view.getUint16(extra + 2, true);
      if (id === 0x0001) {
        let field = extra + 4;
        if (uncompressedSize === 0xffffffff) {
          uncompressedSize = readUint64(view, field);
          field += 8;
        }
        if (compressedSize === 0xffffffff) {
          compressedSize = readUint64(view, field);
          field += 8;
        }
        if (offset === 0xffffffff) offset = readUint64(view, field);
      }
      extra += 4 + size;
    }

    entries.push({
      name,
      dir: name.endsWith("/"),
      method,
      flags,
      compressedSize,
      uncompressedSize,
      offset,
    });
    cursor = extraEnd + commentLength;
  }
  return entries;
}

/**
 * Opens a remote archive: reads its size and central directory, nothing else.
 *
 * @param url - Archive URL. The server must honour `Range`.
 * @param options - `fetchImpl` and `signal`.
 * @returns The archive's size and entries.
 * @throws When the size is unknown, ranges are ignored, or the archive's
 *   trailer is not a ZIP's.
 */
export async function openRemoteZip(
  url: string,
  options: RemoteZipOptions = {},
): Promise<RemoteZip> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const head = await fetchImpl(url, { method: "HEAD", signal: options.signal });
  if (!head.ok) {
    throw new Error(`Checking ${url} failed: HTTP ${head.status} ${head.statusText}`.trim());
  }
  const size = Number(head.headers.get("content-length") ?? Number.NaN);
  if (!Number.isFinite(size) || size < 22) {
    throw new Error(`${url} did not report its size, so it cannot be read in pieces.`);
  }

  const tailStart = Math.max(0, size - TAIL_BYTES);
  const tail = await fetchRange(url, tailStart, size - 1, options);
  const tailView = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  let eocd = -1;
  for (let index = tail.byteLength - 22; index >= 0; index -= 1) {
    if (tailView.getUint32(index, true) === EOCD_SIGNATURE) {
      eocd = index;
      break;
    }
  }
  if (eocd < 0) {
    throw new Error(`${url} is not a ZIP archive (no end-of-central-directory record).`);
  }

  let entryCount = tailView.getUint16(eocd + 10, true);
  let centralSize = tailView.getUint32(eocd + 12, true);
  let centralOffset = tailView.getUint32(eocd + 16, true);

  const locator = eocd - 20;
  if (locator >= 0 && tailView.getUint32(locator, true) === ZIP64_LOCATOR_SIGNATURE) {
    const zip64Offset = readUint64(tailView, locator + 8);
    const record = await fetchRange(url, zip64Offset, zip64Offset + 55, options);
    const recordView = new DataView(record.buffer, record.byteOffset, record.byteLength);
    if (recordView.getUint32(0, true) !== ZIP64_EOCD_SIGNATURE) {
      throw new Error(`${url} has a corrupt ZIP64 end-of-central-directory record.`);
    }
    entryCount = readUint64(recordView, 32);
    centralSize = readUint64(recordView, 40);
    centralOffset = readUint64(recordView, 48);
  }

  const central =
    centralSize === 0
      ? new Uint8Array(0)
      : centralOffset >= tailStart && centralOffset + centralSize <= size
        ? tail.subarray(centralOffset - tailStart, centralOffset - tailStart + centralSize)
        : await fetchRange(url, centralOffset, centralOffset + centralSize - 1, options);
  const entries = parseCentralDirectory(central);
  if (entries.length !== entryCount) {
    throw new Error(
      `${url} lists ${entryCount} entries but its central directory holds ${entries.length}.`,
    );
  }
  return { url, size, entries, centralDirectoryOffset: centralOffset };
}

/** Inflates raw-deflate bytes with the platform's `DecompressionStream`. */
async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Pulls one entry's data out of a span of bytes that starts at its local
 * header, and decompresses it.
 */
async function extractEntry(entry: RemoteZipEntry, span: Uint8Array): Promise<Uint8Array> {
  if (entry.flags & 0x1) {
    throw new RemoteZipEntryError(`${entry.name} is encrypted.`, "encrypted");
  }
  if (entry.method !== 0 && entry.method !== 8) {
    throw new RemoteZipEntryError(
      `${entry.name} uses unsupported compression method ${entry.method}.`,
      "unsupported-compression",
    );
  }
  const view = new DataView(span.buffer, span.byteOffset, span.byteLength);
  if (span.byteLength < 30 || view.getUint32(0, true) !== LOCAL_SIGNATURE) {
    throw new RemoteZipEntryError(`${entry.name} has a corrupt local header.`, "corrupt");
  }
  const dataStart = 30 + view.getUint16(26, true) + view.getUint16(28, true);
  const data = span.subarray(dataStart, dataStart + entry.compressedSize);
  if (data.byteLength !== entry.compressedSize) {
    throw new RemoteZipEntryError(`${entry.name} is truncated.`, "corrupt");
  }
  if (entry.method === 0) return data.slice();
  try {
    return await inflateRaw(data);
  } catch (error) {
    throw new RemoteZipEntryError(
      `${entry.name} could not be decompressed (${(error as Error).message}).`,
      "corrupt",
    );
  }
}

/** Options for {@link readRemoteZipEntries}. */
export interface ReadEntriesOptions extends RemoteZipOptions {
  /** Most bytes one request may cover when batching neighbours. */
  chunkBytes?: number;
  /** Called after every request with bytes read so far and the total to read. */
  onProgress?: (progress: { bytesRead: number; bytesTotal: number }) => void;
}

/**
 * Reads the chosen entries, a few neighbours per request, in archive order.
 *
 * Each entry's span runs from its local header to the next entry's header
 * (or the central directory), which is exact without knowing the local extra
 * field's length in advance. A broken entry is handed to `onEntry` as an
 * error instead of ending the walk; a failed request does end it.
 *
 * @param zip - An archive from {@link openRemoteZip}.
 * @param wanted - The entries to read.
 * @param onEntry - Receives each entry with its bytes or its error. Returning
 *   a promise backpressures the walk.
 * @param options - Chunk size, progress, `fetchImpl` and `signal`.
 */
export async function readRemoteZipEntries(
  zip: RemoteZip,
  wanted: readonly RemoteZipEntry[],
  onEntry: (
    entry: RemoteZipEntry,
    result: { bytes: Uint8Array } | { error: Error },
  ) => void | Promise<void>,
  options: ReadEntriesOptions = {},
): Promise<void> {
  const byOffset = [...zip.entries].sort((a, b) => a.offset - b.offset);
  const spanEnd = new Map<RemoteZipEntry, number>();
  byOffset.forEach((entry, index) => {
    spanEnd.set(entry, byOffset[index + 1]?.offset ?? zip.centralDirectoryOffset);
  });

  const targets = [...wanted].sort((a, b) => a.offset - b.offset);
  const chunkBytes = options.chunkBytes ?? DEFAULT_CHUNK_BYTES;
  const bytesTotal = targets.reduce(
    (sum, entry) => sum + ((spanEnd.get(entry) ?? entry.offset) - entry.offset),
    0,
  );
  let bytesRead = 0;

  let index = 0;
  while (index < targets.length) {
    if (options.signal?.aborted) return;
    const first = targets[index];
    const start = first.offset;
    let end = spanEnd.get(first) ?? start;
    let last = index;
    // Batch following entries while the whole request still fits the chunk;
    // anything skipped between them (folders, PDFs) is read and ignored.
    while (
      last + 1 < targets.length &&
      (spanEnd.get(targets[last + 1]) ?? end) - start <= chunkBytes
    ) {
      last += 1;
      end = spanEnd.get(targets[last]) ?? end;
    }

    const chunk = end > start ? await fetchRange(zip.url, start, end - 1, options) : new Uint8Array(0);

    for (let position = index; position <= last; position += 1) {
      const entry = targets[position];
      const span = chunk.subarray(entry.offset - start, (spanEnd.get(entry) ?? entry.offset) - start);
      bytesRead += span.byteLength;
      let result: { bytes: Uint8Array } | { error: Error };
      try {
        result = { bytes: await extractEntry(entry, span) };
      } catch (error) {
        result = { error: error as Error };
      }
      await onEntry(entry, result);
    }
    options.onProgress?.({ bytesRead, bytesTotal });
    index = last + 1;
  }
}
