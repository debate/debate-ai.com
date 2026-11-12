/**
 * @fileoverview The pure half of `scrape-patreon`: reading `.docx`
 * attachments off a Patreon feed, naming saved files, rejecting non-Word
 * downloads, the manifest round trip and option parsing.
 */
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { parseHTML } from "linkedom";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_FEED_URL,
  extractPatreonAttachments,
  isDocxBuffer,
  loadManifest,
  localFileName,
  parseScraperOptions,
  safeFileName,
  saveManifest,
} from "../../src/patreon/patreon-docx";

const FEED = `<!doctype html><html><body>
  <div data-tag="post-card">
    <div data-tag="post-title"><a href="/posts/sept-oct-brief-12345">  Sept/Oct Brief  </a></div>
    <a data-tag="post-published-at" href="/posts/sept-oct-brief-12345">2 days ago</a>
    <time datetime="2026-11-10T14:00:00.000Z"></time>
    <a data-tag="post-attachment-link" href="/file?h=174895903&amp;m=781278513">Sept-Oct Aff.docx</a>
    <a data-tag="post-attachment-link" href="/file?h=174895903&amp;m=781278514">Neg Blocks.DOCX</a>
    <a data-tag="post-attachment-link" href="/file?h=174895903&amp;m=781278515">Summary.pdf</a>
  </div>
  <div data-tag="post-card">
    <div data-tag="post-title"><a href="https://www.patreon.com/posts/old-99">Old post</a></div>
    <span data-tag="post-published-at">October 16</span>
    <a data-tag="post-attachment-link" href="/file/raw-download?x=1">Old.docx</a>
    <a data-tag="post-attachment-link" href="javascript:alert(1)">Evil.docx</a>
  </div>
  <a data-tag="post-attachment-link" href="/file?h=1&amp;m=2">Outside a card.docx</a>
</body></html>`;

const BASE = "https://www.patreon.com/kankeebriefs/posts";

async function zip(files: Record<string, string>): Promise<Uint8Array> {
  const archive = new JSZip();
  for (const [name, body] of Object.entries(files)) archive.file(name, body);
  return archive.generateAsync({ type: "uint8array" });
}

describe("extractPatreonAttachments", () => {
  const { document } = parseHTML(FEED);
  const items = extractPatreonAttachments(document, BASE);

  it("keeps only .docx links on post cards, in feed order", () => {
    expect(items.map((item) => item.filename)).toEqual(["Sept-Oct Aff.docx", "Neg Blocks.DOCX", "Old.docx"]);
  });

  it("pairs each attachment with its own post's title, URL and date", () => {
    expect(items[0]).toEqual({
      id: "174895903-781278513",
      filename: "Sept-Oct Aff.docx",
      url: "https://www.patreon.com/file?h=174895903&m=781278513",
      postTitle: "Sept/Oct Brief",
      postUrl: "https://www.patreon.com/posts/sept-oct-brief-12345",
      dateLabel: "2 days ago",
      publishedAt: "2026-11-10T14:00:00.000Z",
    });
    expect(items[2]).toMatchObject({
      postTitle: "Old post",
      postUrl: "https://www.patreon.com/posts/old-99",
      dateLabel: "October 16",
      publishedAt: null,
    });
  });

  it("falls back to the full URL as the id when h/m are missing", () => {
    expect(items[2].id).toBe("https://www.patreon.com/file/raw-download?x=1");
  });

  it("survives a Function#toString round trip, as the CLI runs it in the page", () => {
    const rebuilt = new Function(`return (${extractPatreonAttachments.toString()})`)() as typeof extractPatreonAttachments;
    expect(rebuilt(document, BASE)).toEqual(items);
  });
});

describe("file naming", () => {
  it("strips characters no filesystem accepts and trailing dots", () => {
    expect(safeFileName('a<b>:"c/d\\e|f?g*.docx')).toBe("a_b___c_d_e_f_g_.docx");
    expect(safeFileName("name. . ")).toBe("name");
    expect(safeFileName("")).toBe("attachment.docx");
  });

  it("prefixes a stable hash of the id", () => {
    const name = localFileName({ id: "174895903-781278513", filename: "Aff.docx" });
    expect(name).toMatch(/^[0-9a-f]{16}--Aff\.docx$/);
    expect(localFileName({ id: "174895903-781278513", filename: "Aff.docx" })).toBe(name);
    expect(localFileName({ id: "other", filename: "Aff.docx" })).not.toBe(name);
  });
});

describe("isDocxBuffer", () => {
  it("accepts a Word package", async () => {
    expect(await isDocxBuffer(await zip({ "[Content_Types].xml": "<x/>", "word/document.xml": "<w/>" }))).toBe(true);
  });

  it("rejects other ZIPs and login HTML", async () => {
    expect(await isDocxBuffer(await zip({ "[Content_Types].xml": "<x/>", "xl/workbook.xml": "<w/>" }))).toBe(false);
    expect(await isDocxBuffer(new TextEncoder().encode("<html>Log in</html>"))).toBe(false);
  });
});

describe("manifest", () => {
  let dir = "";
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it("is empty before the first save and round-trips after", async () => {
    dir = await mkdtemp(path.join(tmpdir(), "patreon-"));
    const file = path.join(dir, "nested", "manifest.json");
    expect(await loadManifest(file)).toEqual({});

    const entry = {
      id: "1-2",
      filename: "A.docx",
      url: "https://www.patreon.com/file?h=1&m=2",
      postTitle: "P",
      postUrl: "",
      dateLabel: null,
      publishedAt: null,
      localFile: "abc--A.docx",
      downloadedAt: "2026-11-12T00:00:00.000Z",
    };
    await saveManifest(file, { "1-2": entry });
    expect(await loadManifest(file)).toEqual({ "1-2": entry });
    expect(JSON.parse(await readFile(file, "utf8"))["1-2"].localFile).toBe("abc--A.docx");
  });
});

describe("parseScraperOptions", () => {
  it("uses defaults relative to cwd", () => {
    expect(parseScraperOptions([], {}, "/work")).toEqual({
      feedUrl: DEFAULT_FEED_URL,
      outDir: "/work/patreon-downloads",
      profileDir: "/work/.patreon-browser-profile",
      pollMs: 120_000,
      maxScrolls: 20,
      login: false,
      once: false,
    });
  });

  it("reads flags and env, flags winning over FEED_URL", () => {
    const options = parseScraperOptions(
      ["--login", "--once", "--feed=https://www.patreon.com/x/posts", "--out=/tmp/out"],
      { FEED_URL: "https://ignored", POLL_MS: "300000", MAX_SCROLLS: "100" },
      "/work",
    );
    expect(options).toMatchObject({
      feedUrl: "https://www.patreon.com/x/posts",
      outDir: "/tmp/out",
      pollMs: 300_000,
      maxScrolls: 100,
      login: true,
      once: true,
    });
  });

  it("rejects a too-short poll or bad scroll count", () => {
    expect(() => parseScraperOptions([], { POLL_MS: "500" }, "/w")).toThrow(/POLL_MS/);
    expect(() => parseScraperOptions([], { MAX_SCROLLS: "0" }, "/w")).toThrow(/MAX_SCROLLS/);
    expect(() => parseScraperOptions([], { MAX_SCROLLS: "2.5" }, "/w")).toThrow(/MAX_SCROLLS/);
  });
});
