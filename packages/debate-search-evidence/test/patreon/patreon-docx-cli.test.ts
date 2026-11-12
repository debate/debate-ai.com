/**
 * @fileoverview The browser half of `scrape-patreon`, driven with fake
 * Playwright objects: in-page extraction, the download checks, a scan's
 * scrolling and dedupe, and the CLI loop (login, once, polling, Ctrl+C).
 */
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { parseHTML } from "linkedom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PatreonAttachment, PatreonManifest, PatreonScraperOptions } from "../../src/patreon/patreon-docx";

const launched = vi.hoisted(() => ({ context: null as unknown, options: null as unknown }));
vi.mock("playwright", () => ({
  chromium: {
    launchPersistentContext: vi.fn(async (_dir: string, options: unknown) => {
      launched.options = options;
      return launched.context;
    }),
  },
}));
const question = vi.hoisted(() => vi.fn(async () => ""));
vi.mock("node:readline/promises", () => ({
  createInterface: () => ({ question, close: () => {} }),
}));

const { download, readAttachments, runPatreonScraper, scan, timing } = await import(
  "../../src/patreon/patreon-docx-cli"
);

const BASE = "https://www.patreon.com/kankeebriefs/posts";
let DOCX: Uint8Array;

beforeAll(async () => {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", "<x/>");
  zip.file("word/document.xml", "<w/>");
  DOCX = await zip.generateAsync({ type: "uint8array" });
});

const card = (h: number, name = `Brief ${h}.docx`) =>
  `<div data-tag="post-card"><div data-tag="post-title"><a href="/posts/p${h}">Post ${h}</a></div>` +
  `<span data-tag="post-published-at">${h} days ago</span>` +
  `<a data-tag="post-attachment-link" href="/file?h=${h}&amp;m=1">${name}</a></div>`;

/** A page whose feed grows by one batch of cards per scroll. */
function fakePage(batches: string[][]) {
  let shown = 1;
  const page = {
    gotos: [] as string[],
    goto: vi.fn(async (url: string) => {
      page.gotos.push(url);
      shown = 1;
    }),
    locator: () => ({ first: () => ({ waitFor: async () => {} }) }),
    evaluate: vi.fn(async (script: string) => {
      if (script.startsWith("window.scrollBy")) {
        shown = Math.min(shown + 1, batches.length);
        return undefined;
      }
      const { document } = parseHTML(`<html><body>${batches.slice(0, shown).flat().join("")}</body></html>`);
      return new Function("document", "location", `return ${script}`)(document, { href: BASE });
    }),
  };
  return page;
}

type Reply = { status?: number; body?: Uint8Array };

/** A context whose `request.get` answers per attachment `h`. */
function fakeContext(page: unknown, replies: Record<string, Reply> = {}) {
  const context = {
    requested: [] as string[],
    disposed: 0,
    closed: false,
    pages: () => [page],
    newPage: async () => page,
    close: vi.fn(async () => {
      context.closed = true;
    }),
    request: {
      get: vi.fn(async (url: string) => {
        context.requested.push(url);
        const reply = replies[new URL(url).searchParams.get("h") ?? ""] ?? {};
        const status = reply.status ?? 200;
        return {
          ok: () => status >= 200 && status < 300,
          status: () => status,
          body: async () => Buffer.from(reply.body ?? DOCX),
          dispose: async () => {
            context.disposed++;
          },
        };
      }),
    },
  };
  return context;
}

let dir = "";
let options: PatreonScraperOptions;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "patreon-cli-"));
  options = {
    feedUrl: BASE,
    outDir: dir,
    profileDir: path.join(dir, "profile"),
    pollMs: 10_000,
    maxScrolls: 20,
    login: false,
    once: true,
  };
  Object.assign(timing, { betweenDownloadsMs: 0, afterScrollMs: 0, pollStepMs: 1 });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  vi.restoreAllMocks();
  question.mockClear();
  await rm(dir, { recursive: true, force: true });
});

const item = (h: number): PatreonAttachment => ({
  id: `${h}-1`,
  filename: `Brief ${h}.docx`,
  url: `https://www.patreon.com/file?h=${h}&m=1`,
  postTitle: `Post ${h}`,
  postUrl: "",
  dateLabel: null,
  publishedAt: null,
});

describe("readAttachments", () => {
  it("runs the extractor inside the page", async () => {
    const page = fakePage([[card(1), card(2)]]);
    const items = await readAttachments(page as never);
    expect(items.map((i: PatreonAttachment) => i.id)).toEqual(["1-1", "2-1"]);
  });
});

describe("download", () => {
  it("saves a real DOCX, records it, and sends the feed as Referer", async () => {
    const context = fakeContext(null);
    const manifest: PatreonManifest = {};
    expect(await download(context as never, item(1), manifest, options)).toBe("saved");
    expect(context.request.get).toHaveBeenCalledWith(item(1).url, expect.objectContaining({ headers: { Referer: BASE } }));
    expect(manifest["1-1"].localFile).toMatch(/--Brief 1\.docx$/);
    expect(await readdir(dir)).toEqual(expect.arrayContaining([manifest["1-1"].localFile, "manifest.json"]));
    expect(context.disposed).toBe(1);
  });

  it("skips what the manifest already has on disk, but refetches a deleted file", async () => {
    const context = fakeContext(null);
    const manifest: PatreonManifest = {};
    await download(context as never, item(1), manifest, options);
    expect(await download(context as never, item(1), manifest, options)).toBe("skipped");
    expect(context.requested).toHaveLength(1);

    await rm(path.join(dir, manifest["1-1"].localFile));
    expect(await download(context as never, item(1), manifest, options)).toBe("saved");
    expect(context.requested).toHaveLength(2);
  });

  it("rejects HTTP errors and non-DOCX bodies without recording them", async () => {
    const context = fakeContext(null, {
      "1": { status: 403 },
      "2": { body: new TextEncoder().encode("<html>Log in</html>") },
    });
    const manifest: PatreonManifest = {};
    await expect(download(context as never, item(1), manifest, options)).rejects.toThrow("HTTP 403");
    await expect(download(context as never, item(2), manifest, options)).rejects.toThrow(/not a DOCX/);
    expect(manifest).toEqual({});
    expect(context.disposed).toBe(2);
  });
});

describe("scan", () => {
  it("scrolls the feed, downloads each attachment once in order, and keeps going past failures", async () => {
    const page = fakePage([[card(1), card(2)], [card(2), card(3)], [card(4, "Notes.pdf")]]);
    const context = fakeContext(page, { "2": { status: 500 } });
    const manifest: PatreonManifest = {};

    await scan(page as never, context as never, manifest, options, () => false);

    expect(context.requested.map((url) => new URL(url).searchParams.get("h"))).toEqual(["1", "2", "3"]);
    expect(Object.keys(manifest)).toEqual(["1-1", "3-1"]);
    expect(console.error).toHaveBeenCalledWith("Failed: Brief 2.docx:", "HTTP 500");
  });

  it("stops after MAX_SCROLLS", async () => {
    const page = fakePage([[card(1)], [card(2)], [card(3)]]);
    const context = fakeContext(page);
    await scan(page as never, context as never, {}, { ...options, maxScrolls: 2 }, () => false);
    expect(context.requested).toHaveLength(2);
  });

  it("stops at once when asked to", async () => {
    const page = fakePage([[card(1), card(2)]]);
    const context = fakeContext(page);
    await scan(page as never, context as never, {}, options, () => true);
    expect(context.requested).toHaveLength(0);
  });
});

describe("runPatreonScraper", () => {
  const args = () => [`--out=${dir}`, `--profile=${path.join(dir, "profile")}`];

  it("--once: scans headless with CHROME_PATH, then closes the browser", async () => {
    const page = fakePage([[card(1)]]);
    const context = fakeContext(page);
    launched.context = context;

    await runPatreonScraper([...args(), "--once"], { CHROME_PATH: "/usr/bin/chrome" }, dir);

    expect(launched.options).toEqual({ headless: true, executablePath: "/usr/bin/chrome" });
    expect(context.requested).toHaveLength(1);
    expect(context.closed).toBe(true);
    expect(question).not.toHaveBeenCalled();
  });

  it("--login: opens a headed browser and waits for Enter before scanning", async () => {
    const page = fakePage([[card(1)]]);
    launched.context = fakeContext(page);

    await runPatreonScraper([...args(), "--login", "--once"], {}, dir);

    expect(launched.options).toEqual({ headless: false, executablePath: undefined });
    expect(question).toHaveBeenCalledOnce();
    expect(page.gotos).toEqual([BASE, BASE]);
  });

  it("resumes from an existing manifest and waits for the next poll until SIGINT", async () => {
    const page = fakePage([[card(1), card(2)]]);
    const context = fakeContext(page);
    launched.context = context;

    // A first run left Brief 1 on disk.
    await download(context as never, item(1), {}, options).then(async () => {
      const [file] = (await readdir(dir)).filter((name) => name.endsWith(".docx"));
      expect(file).toBeTruthy();
    });
    context.requested.length = 0;

    let scans = 0;
    page.goto.mockImplementation(async (url: string) => {
      page.gotos.push(url);
      // Ctrl+C while waiting for the next poll.
      if (++scans === 1) setTimeout(() => process.emit("SIGINT"), 50);
    });

    await runPatreonScraper(args(), { POLL_MS: "10000" }, dir);

    expect(scans).toBe(1);
    expect(context.requested.map((url) => new URL(url).searchParams.get("h"))).toEqual(["2"]);
    expect(console.log).toHaveBeenCalledWith("Next scan in 10s");
    expect(context.closed).toBe(true);
  });

  it("reports a failed scan and still closes the browser", async () => {
    const page = fakePage([[card(1)]]);
    page.goto.mockRejectedValue(new Error("net::ERR_INTERNET_DISCONNECTED"));
    const context = fakeContext(page);
    launched.context = context;

    await runPatreonScraper([...args(), "--once"], {}, dir);

    expect(console.error).toHaveBeenCalledWith("Scan failed:", expect.any(Error));
    expect(context.closed).toBe(true);
  });

  it("throws on a corrupt manifest instead of starting over", async () => {
    await writeFile(path.join(dir, "manifest.json"), "{not json");
    launched.context = fakeContext(fakePage([[]]));
    await expect(runPatreonScraper([...args(), "--once"], {}, dir)).rejects.toThrow(SyntaxError);
  });
});
