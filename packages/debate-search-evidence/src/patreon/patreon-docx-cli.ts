/**
 * @fileoverview Download every `.docx` attachment from a Patreon creator feed
 * you are subscribed to, then keep polling for new ones.
 *
 * Run from the repo root:
 *
 * ```bash
 * # First run: opens a visible browser so you can sign in to Patreon.
 * bun run --cwd packages/debate-search-evidence scrape-patreon -- --login --once
 *
 * # Then: headless, rescans the feed every 2 minutes (Ctrl+C to stop).
 * bun run --cwd packages/debate-search-evidence scrape-patreon
 *
 * # One scan and exit, a different creator, a deeper backfill:
 * MAX_SCROLLS=100 bun run --cwd packages/debate-search-evidence scrape-patreon -- \
 *   --once --feed=https://www.patreon.com/<creator>/posts
 * ```
 *
 * | Option                 | Default                                      |
 * |------------------------|----------------------------------------------|
 * | `--login`              | headed browser + wait for Enter before scan  |
 * | `--once`               | one scan, then exit                          |
 * | `--feed=` / `FEED_URL` | `https://www.patreon.com/kankeebriefs/posts` |
 * | `--out=`               | `patreon-downloads/`                         |
 * | `--profile=`           | `.patreon-browser-profile/` (keep private)   |
 * | `POLL_MS`              | `120000` (min 10000)                         |
 * | `MAX_SCROLLS`          | `20` scrolls per scan                        |
 * | `CHROME_PATH`          | Playwright's Chromium; set to use your Chrome |
 *
 * Paths are relative to the package folder. Files land as
 * `<hash>--<displayed name>.docx` with `manifest.json` beside them (post
 * title, post URL, date label, `datetime` when the card has one). Only
 * attachments your signed-in session can open are downloaded; a response that
 * isn't a real Word document (login page, error HTML) is skipped and retried
 * next scan.
 *
 * Needs Playwright's Chromium (`bunx playwright install chromium` once), or
 * `CHROME_PATH` pointing at an installed Chrome.
 *
 * @module patreon/patreon-docx-cli
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import type { BrowserContext, Page } from "playwright";
import {
  extractPatreonAttachments,
  isDocxBuffer,
  loadManifest,
  localFileName,
  parseScraperOptions,
  saveManifest,
  type PatreonAttachment,
  type PatreonManifest,
  type PatreonScraperOptions,
} from "./patreon-docx";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

/** Run {@link extractPatreonAttachments} inside the page. */
async function readAttachments(page: Page): Promise<PatreonAttachment[]> {
  return page.evaluate(`(${extractPatreonAttachments.toString()})(document, location.href)`);
}

/** Download one attachment unless the manifest already has it on disk. */
async function download(
  context: BrowserContext,
  item: PatreonAttachment,
  manifest: PatreonManifest,
  options: PatreonScraperOptions,
): Promise<"saved" | "skipped"> {
  const manifestFile = path.join(options.outDir, "manifest.json");
  const previous = manifest[item.id];
  if (previous && (await exists(path.join(options.outDir, previous.localFile)))) return "skipped";

  const localFile = localFileName(item);
  const destination = path.join(options.outDir, localFile);
  console.log(`Downloading: ${item.filename} | ${item.dateLabel ?? "date unavailable"}`);

  // The persistent context's cookie store carries the Patreon session.
  const response = await context.request.get(item.url, {
    headers: { Referer: item.postUrl || options.feedUrl },
    timeout: 60_000,
  });
  try {
    if (!response.ok()) throw new Error(`HTTP ${response.status()}`);
    const body = await response.body();
    if (!(await isDocxBuffer(body))) throw new Error("Response is not a DOCX document.");

    const temp = `${destination}.part`;
    await fs.writeFile(temp, body);
    await fs.rename(temp, destination);

    manifest[item.id] = { ...item, localFile, downloadedAt: new Date().toISOString() };
    await saveManifest(manifestFile, manifest);
    return "saved";
  } finally {
    await response.dispose();
  }
}

/** One pass over the feed: scroll, collect, download in encounter order. */
async function scan(
  page: Page,
  context: BrowserContext,
  manifest: PatreonManifest,
  options: PatreonScraperOptions,
  isStopping: () => boolean,
): Promise<void> {
  await page.goto(options.feedUrl, { waitUntil: "domcontentloaded" });
  await page.locator('[data-tag="post-card"]').first().waitFor({ timeout: 60_000 });

  const encountered = new Set<string>();
  let idleRounds = 0;
  let saved = 0;

  for (let scroll = 0; scroll < options.maxScrolls && !isStopping(); scroll++) {
    let newItems = 0;
    for (const item of await readAttachments(page)) {
      if (isStopping()) break;
      if (encountered.has(item.id)) continue;
      encountered.add(item.id);
      newItems++;
      try {
        if ((await download(context, item, manifest, options)) === "saved") {
          saved++;
          await sleep(750);
        }
      } catch (error) {
        // Not added to the manifest, so the next scan retries it.
        console.error(`Failed: ${item.filename}:`, error instanceof Error ? error.message : error);
      }
    }

    idleRounds = newItems === 0 ? idleRounds + 1 : 0;
    if (idleRounds >= 4) break;

    await page.evaluate("window.scrollBy(0, Math.max(window.innerHeight * 0.8, 600))");
    await sleep(2_000);
  }

  console.log(`Scan done: ${encountered.size} .docx attachments seen, ${saved} new.`);
}

async function main(): Promise<void> {
  const options = parseScraperOptions(process.argv.slice(2), process.env, process.cwd());
  await fs.mkdir(options.outDir, { recursive: true });
  const manifest = await loadManifest(path.join(options.outDir, "manifest.json"));

  const { chromium } = await import("playwright");
  const context = await chromium.launchPersistentContext(options.profileDir, {
    headless: !options.login,
    // Optional: reuse an installed Chrome/Chromium instead of Playwright's download.
    executablePath: process.env.CHROME_PATH || undefined,
  });
  const page = context.pages()[0] ?? (await context.newPage());

  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  try {
    if (options.login) {
      await page.goto(options.feedUrl, { waitUntil: "domcontentloaded" });
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      try {
        await rl.question("Log in in the browser, open the creator feed, then press Enter here. ");
      } finally {
        rl.close();
      }
    }

    while (!stopping) {
      try {
        await scan(page, context, manifest, options, () => stopping);
      } catch (error) {
        console.error("Scan failed:", error);
      }
      if (options.once || stopping) break;

      console.log(`Next scan in ${options.pollMs / 1000}s`);
      // Short waits so Ctrl+C stops promptly between scans.
      for (let elapsed = 0; elapsed < options.pollMs && !stopping; elapsed += 500) {
        await sleep(Math.min(500, options.pollMs - elapsed));
      }
    }
  } finally {
    await context.close();
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
