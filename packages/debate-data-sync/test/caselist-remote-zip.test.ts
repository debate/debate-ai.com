/**
 * @fileoverview Covers reading a caselist archive over HTTP Range requests:
 * the central-directory read, the batched entry reads, and the walk built on
 * them. The "server" is a fake `fetch` over an in-memory ZIP that honours
 * `Range` the way openCaselist's bucket does, and counts what it served so
 * the tests can prove the archive was never downloaded whole.
 */
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { loadRemoteCaselistArchive } from "../src/caselist/caselist-archive";
import { openRemoteZip, readRemoteZipEntries } from "../src/caselist/remote-zip";

const URL_ = "https://bucket.example/weekly/hspolicy26/hspolicy26-all-2026-10-06.zip";

/** Builds a minimal but real `.docx`. */
async function docx(tag: string): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:pPr><w:pStyle w:val="Heading4"/></w:pPr><w:r><w:t>${tag}</w:t></w:r></w:p>
<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Smith 26</w:t></w:r><w:r><w:t> (Jane Smith, Brookings, 2026)</w:t></w:r></w:p>
<w:p><w:r><w:t>Body.</w:t></w:r></w:p>
</w:body></w:document>`,
  );
  return zip.generateAsync({ type: "arraybuffer" });
}

async function archive(
  files: Record<string, ArrayBuffer | string>,
  compression: "DEFLATE" | "STORE" = "DEFLATE",
): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) zip.file(path, content);
  return zip.generateAsync({ type: "uint8array", compression });
}

/** A fake server: honours `bytes=a-b`, or ignores ranges when told to. */
function server(bytes: Uint8Array, { ignoreRange = false } = {}) {
  const served = { requests: 0, bytes: 0 };
  const fetchImpl = (async (_url: string, init: RequestInit = {}) => {
    served.requests += 1;
    if (init.method === "HEAD") {
      return new Response(null, { status: 200, headers: { "content-length": String(bytes.length) } });
    }
    const range = new Headers(init.headers).get("range");
    const match = range && !ignoreRange ? /^bytes=(\d+)-(\d+)$/.exec(range) : null;
    if (!match) {
      served.bytes += bytes.length;
      return new Response(bytes.slice(), { status: 200 });
    }
    const body = bytes.slice(Number(match[1]), Number(match[2]) + 1);
    served.bytes += body.length;
    return new Response(body, { status: 206 });
  }) as typeof fetch;
  return { fetchImpl, served };
}

describe("openRemoteZip", () => {
  it("lists entries from the central directory", async () => {
    const bytes = await archive({ "School/Team/A.docx": "a", "School/Team/B.docx": "bb" });
    const { fetchImpl } = server(bytes);

    const zip = await openRemoteZip(URL_, { fetchImpl });

    expect(zip.size).toBe(bytes.length);
    expect(zip.entries.filter((entry) => !entry.dir).map((entry) => entry.name)).toEqual([
      "School/Team/A.docx",
      "School/Team/B.docx",
    ]);
  });

  it("refuses a server that ignores Range instead of downloading the whole file", async () => {
    const bytes = await archive({ "A.docx": "a" });
    const { fetchImpl } = server(bytes, { ignoreRange: true });

    await expect(openRemoteZip(URL_, { fetchImpl })).rejects.toThrow(/ignored the byte-range/);
  });

  it("says when the file is not a ZIP", async () => {
    const { fetchImpl } = server(new TextEncoder().encode("<html>not found</html>".repeat(4)));

    await expect(openRemoteZip(URL_, { fetchImpl })).rejects.toThrow(/not a ZIP/);
  });
});

describe("readRemoteZipEntries", () => {
  it.each(["DEFLATE", "STORE"] as const)("returns each entry's bytes (%s)", async (compression) => {
    const bytes = await archive({ "one.txt": "first file", "two.txt": "second".repeat(500) }, compression);
    const { fetchImpl } = server(bytes);
    const zip = await openRemoteZip(URL_, { fetchImpl });

    const read: Record<string, string> = {};
    await readRemoteZipEntries(
      zip,
      zip.entries,
      (entry, result) => {
        if ("bytes" in result) read[entry.name] = new TextDecoder().decode(result.bytes);
      },
      { fetchImpl },
    );

    expect(read).toEqual({ "one.txt": "first file", "two.txt": "second".repeat(500) });
  });

  it("batches neighbouring entries into one request until the chunk fills", async () => {
    const files: Record<string, string> = {};
    for (let index = 0; index < 20; index += 1) files[`f${index}.txt`] = `file ${index}`;
    const bytes = await archive(files);
    const batched = server(bytes);
    const zip = await openRemoteZip(URL_, { fetchImpl: batched.fetchImpl });
    const afterOpen = batched.served.requests;

    await readRemoteZipEntries(zip, zip.entries, () => {}, { fetchImpl: batched.fetchImpl });
    expect(batched.served.requests - afterOpen).toBe(1);

    const tiny = server(bytes);
    const tinyZip = await openRemoteZip(URL_, { fetchImpl: tiny.fetchImpl });
    const tinyOpen = tiny.served.requests;
    await readRemoteZipEntries(tinyZip, tinyZip.entries, () => {}, {
      fetchImpl: tiny.fetchImpl,
      chunkBytes: 1,
    });
    expect(tiny.served.requests - tinyOpen).toBe(20);
  });
});

describe("loadRemoteCaselistArchive", () => {
  it("converts documents without fetching the parts of the archive it skips", async () => {
    const filler = "x".repeat(200_000);
    const bytes = await archive(
      {
        "hspolicy26/Glenbrook North/Chen-Patel/Heg Aff.docx": await docx("Heg solves war"),
        "hspolicy26/Glenbrook North/Chen-Patel/cites.pdf": filler,
        "hspolicy26/Westminster/Ito-Park/Cap K Neg.docx": await docx("Cap causes extinction"),
      },
      "STORE",
    );
    const { fetchImpl, served } = server(bytes);

    const load = await loadRemoteCaselistArchive(URL_, { slug: "hspolicy26", fetchImpl, chunkBytes: 1 });

    expect(load.entryCount).toBe(2);
    expect(load.importedCount).toBe(2);
    expect(load.failures).toEqual([]);
    expect(load.documents.map((document) => document.school).sort()).toEqual([
      "Glenbrook North",
      "Westminster",
    ]);
    expect(load.documents.map((document) => document.html).join()).toContain("Heg solves war");
    // The PDF sits between the two documents; with a 1-byte chunk it is never read.
    expect(served.bytes).toBeLessThan(bytes.length);
  });

  it("records an unreadable document and keeps going", async () => {
    const bytes = await archive({
      "Bellarmine/Kim-Lee/Good.docx": await docx("Readable"),
      "Bellarmine/Kim-Lee/Broken.docx": "not a zip at all",
    });
    const { fetchImpl } = server(bytes);

    const load = await loadRemoteCaselistArchive(URL_, { fetchImpl });

    expect(load.importedCount).toBe(1);
    expect(load.failures).toHaveLength(1);
    expect(load.failures[0]).toMatchObject({ path: "Bellarmine/Kim-Lee/Broken.docx" });
  });

  it("stops at the limit", async () => {
    const bytes = await archive({
      "A/1.docx": await docx("One"),
      "A/2.docx": await docx("Two"),
      "A/3.docx": await docx("Three"),
    });
    const { fetchImpl } = server(bytes);

    const load = await loadRemoteCaselistArchive(URL_, { fetchImpl, limit: 1, chunkBytes: 1 });

    expect(load.importedCount).toBe(1);
  });
});
