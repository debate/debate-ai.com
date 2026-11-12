/**
 * @fileoverview Pure helpers behind the Patreon `.docx` attachment scraper
 * (`patreon-docx-cli.ts`): reading attachments off a rendered creator feed,
 * naming the saved files, checking a download really is a Word document, and
 * the JSON manifest of what has been saved.
 *
 * Nothing here touches the browser, so it is unit-tested against fixture HTML.
 * {@link extractPatreonAttachments} is the one exception in spirit: the CLI
 * serialises it with `Function#toString` and runs it inside the page, so it
 * must stay self-contained (no imports, no module-level helpers, no globals
 * beyond `URL`).
 *
 * @module patreon/patreon-docx
 */
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import JSZip from "jszip";

/** One `.docx` attachment found on a post card. */
export interface PatreonAttachment {
  /** `<post h>-<media m>` from the attachment URL, else the full URL. */
  id: string;
  /** The filename Patreon displays on the attachment link. */
  filename: string;
  /** Absolute attachment URL (`/file?h=…&m=…`). */
  url: string;
  postTitle: string;
  postUrl: string;
  /** The card's visible date text, e.g. "2 days ago" or "October 16". */
  dateLabel: string | null;
  /** A machine-readable `datetime`, only when the card exposes one. */
  publishedAt: string | null;
}

/** A manifest entry: the attachment plus where and when it was saved. */
export interface SavedPatreonAttachment extends PatreonAttachment {
  localFile: string;
  downloadedAt: string;
}

/** `downloads/manifest.json`, keyed by {@link PatreonAttachment.id}. */
export type PatreonManifest = Record<string, SavedPatreonAttachment>;

/**
 * Collect every `.docx` attachment on the post cards under `root`, in
 * document order.
 *
 * Patreon attachment URLs look like `/file?h=174895903&m=781278513`, so the
 * `.docx` check runs on the link's displayed filename, not its URL.
 *
 * Self-contained on purpose: the CLI runs `(${fn})(document, location.href)`
 * inside the page.
 */
export function extractPatreonAttachments(
  root: ParentNode,
  baseUrl: string,
): PatreonAttachment[] {
  const results: PatreonAttachment[] = [];
  const text = (el: Element | null | undefined): string =>
    (el?.textContent ?? "").replace(/\s+/g, " ").trim();
  const absolute = (href: string | null | undefined): string => {
    if (!href) return "";
    try {
      return new URL(href, baseUrl).href;
    } catch {
      return "";
    }
  };

  for (const card of Array.from(root.querySelectorAll('[data-tag="post-card"]'))) {
    const title = card.querySelector('[data-tag="post-title"] a') ?? card.querySelector('[data-tag="post-title"]');
    const date = card.querySelector('[data-tag="post-published-at"]');
    const time = card.querySelector("time[datetime]");

    const publishedAt = time?.getAttribute("datetime") ?? date?.getAttribute("datetime") ?? null;
    const dateLabel = text(date) || null;
    const postUrl =
      absolute(title?.getAttribute("href")) || (date?.tagName === "A" ? absolute(date.getAttribute("href")) : "");

    for (const link of Array.from(card.querySelectorAll('a[data-tag="post-attachment-link"]'))) {
      const filename = text(link);
      if (!/\.docx$/i.test(filename)) continue;

      const href = absolute(link.getAttribute("href"));
      if (!href) continue;
      const url = new URL(href);
      if (url.protocol !== "https:" && url.protocol !== "http:") continue;

      const postId = url.searchParams.get("h");
      const mediaId = url.searchParams.get("m");

      results.push({
        id: postId && mediaId ? `${postId}-${mediaId}` : url.origin + url.pathname + url.search,
        filename,
        url: url.href,
        postTitle: text(title),
        postUrl,
        dateLabel,
        publishedAt,
      });
    }
  }

  return results;
}

/** Make `value` safe as a filename on Windows, macOS and Linux. */
export function safeFileName(value: string): string {
  return (
    value
      // eslint-disable-next-line no-control-regex
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
      .replace(/[. ]+$/g, "")
      .slice(0, 160) || "attachment.docx"
  );
}

/**
 * The saved name for an attachment: a 16-hex-char hash of its id, then the
 * displayed filename. Stable across runs, and never trusts the id as a path.
 */
export function localFileName(item: Pick<PatreonAttachment, "id" | "filename">): string {
  const key = createHash("sha256").update(item.id).digest("hex").slice(0, 16);
  return `${key}--${safeFileName(item.filename)}`;
}

/**
 * True when `body` is a Word document: a ZIP holding `[Content_Types].xml`
 * and `word/document.xml`. Rejects login pages, error HTML and other ZIPs.
 */
export async function isDocxBuffer(body: Uint8Array): Promise<boolean> {
  try {
    const zip = await JSZip.loadAsync(body);
    return Boolean(zip.file("[Content_Types].xml") && zip.file("word/document.xml"));
  } catch {
    return false;
  }
}

/** Read the manifest, or `{}` when it doesn't exist yet. */
export async function loadManifest(file: string): Promise<PatreonManifest> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as PatreonManifest;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

/** Write the manifest atomically (temp file, then rename). */
export async function saveManifest(file: string, manifest: PatreonManifest): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  await fs.writeFile(temp, JSON.stringify(manifest, null, 2));
  await fs.rename(temp, file);
}

/** Parsed command line and environment. */
export interface PatreonScraperOptions {
  feedUrl: string;
  outDir: string;
  profileDir: string;
  pollMs: number;
  maxScrolls: number;
  login: boolean;
  once: boolean;
}

/** Default feed, overridable with `FEED_URL` or `--feed=`. */
export const DEFAULT_FEED_URL = "https://www.patreon.com/kankeebriefs/posts";

/**
 * Read options from argv (`--login`, `--once`, `--feed=`, `--out=`,
 * `--profile=`) and env (`FEED_URL`, `POLL_MS`, `MAX_SCROLLS`). Throws on
 * invalid numbers.
 */
export function parseScraperOptions(
  argv: readonly string[],
  env: Record<string, string | undefined>,
  cwd: string,
): PatreonScraperOptions {
  const flag = (name: string): string | undefined =>
    argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

  const pollMs = Number(env.POLL_MS ?? 120_000);
  const maxScrolls = Number(env.MAX_SCROLLS ?? 20);
  if (!Number.isFinite(pollMs) || pollMs < 10_000) {
    throw new Error("POLL_MS must be at least 10000.");
  }
  if (!Number.isInteger(maxScrolls) || maxScrolls < 1) {
    throw new Error("MAX_SCROLLS must be a positive integer.");
  }

  return {
    feedUrl: flag("feed") ?? env.FEED_URL ?? DEFAULT_FEED_URL,
    outDir: path.resolve(cwd, flag("out") ?? "patreon-downloads"),
    profileDir: path.resolve(cwd, flag("profile") ?? ".patreon-browser-profile"),
    pollMs,
    maxScrolls,
    login: argv.includes("--login"),
    once: argv.includes("--once"),
  };
}
