#!/usr/bin/env node
/**
 * Copies this build's hashed files into the BUILD_ARCHIVE R2 bucket, so they
 * can still be served after later deploys replace them.
 *
 * A Worker version's static-assets layer only holds its own build. As soon as
 * a new version goes live (a deploy, or a rollback in the dashboard), every
 * `/_next/static/` chunk of the build before it 404s, and a tab still running
 * that build crashes on its next lazy import with "Failed to fetch dynamically
 * imported module". The Worker answers asset misses from this bucket
 * (apps/debate-web/lib/redirects/missing-build-file.ts), so an old tab keeps
 * loading the chunks it was built with.
 *
 * Runs from apps/debate-web after `bun run build` and before
 * `wrangler deploy`:
 *
 *   1. creates the bucket if it does not exist yet (the deploy's R2 binding
 *      needs it);
 *   2. reads `_archive/keys.txt`, the list of keys already archived;
 *   3. uploads only the files that are not in it (`wrangler r2 bulk put`);
 *   4. writes the updated list back.
 *
 * Names are content-hashed, so a key never needs re-uploading; a typical
 * deploy adds a dozen or so files. The first run uploads the whole build.
 *
 * Usage: node ../../.github/scripts/archive-build-assets.mjs
 *   BUILD_ARCHIVE_BUCKET  bucket name, default debate-ai-build-archive
 *   BUILD_ARCHIVE_DIR     build output dir, default dist/client
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";

const BUCKET = process.env.BUILD_ARCHIVE_BUCKET || "debate-ai-build-archive";
const DIR = process.env.BUILD_ARCHIVE_DIR || "dist/client";
/** Build-output folders, matching BUILD_OUTPUT_PREFIXES in missing-build-file.ts. */
const PREFIXES = ["_next/static", "assets"];
const MANIFEST_KEY = "_archive/keys.txt";

function wrangler(args, { quiet = false } = {}) {
  const result = spawnSync("npx", ["wrangler", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (!quiet) process.stdout.write(output);
  return { ok: result.status === 0, output };
}

/** Every file under `root`, as paths relative to DIR with `/` separators. */
function listFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else out.push(relative(DIR, full).split(sep).join("/"));
    }
  };
  if (existsSync(root)) walk(root);
  return out;
}

if (!existsSync(DIR)) {
  console.error(`${DIR} does not exist — run the build first.`);
  process.exit(1);
}

// 1. The bucket.
if (!wrangler(["r2", "bucket", "info", BUCKET], { quiet: true }).ok) {
  console.log(`Creating R2 bucket ${BUCKET}…`);
  const created = wrangler(["r2", "bucket", "create", BUCKET]);
  if (!created.ok && !/already exists/i.test(created.output)) {
    console.error(`Could not create ${BUCKET}.`);
    process.exit(1);
  }
}

// 2. What is already archived.
const work = mkdtempSync(join(tmpdir(), "build-archive-"));
const manifestPath = join(work, "keys.txt");
const archived = new Set();
if (wrangler(["r2", "object", "get", `${BUCKET}/${MANIFEST_KEY}`, "--remote", "--file", manifestPath], { quiet: true }).ok) {
  for (const line of readFileSync(manifestPath, "utf8").split("\n")) if (line) archived.add(line);
}

// 3. Upload what is new.
const files = PREFIXES.flatMap((prefix) => listFiles(join(DIR, prefix)));
const fresh = files.filter((key) => !archived.has(key));
console.log(`${files.length} build files, ${archived.size} already archived, ${fresh.length} to upload.`);

if (fresh.length > 0) {
  const listPath = join(work, "bulk.json");
  writeFileSync(listPath, JSON.stringify(fresh.map((key) => ({ key, file: join(DIR, key) }))));
  const put = wrangler([
    "r2", "bulk", "put", BUCKET,
    "--remote",
    "--filename", listPath,
    "--concurrency", "20",
    "--cache-control", "public, max-age=31536000, immutable",
    "--force",
  ], { quiet: true });
  if (!put.ok) {
    console.error(put.output.slice(-4000));
    console.error("Upload failed; the manifest is left as it was so the next run retries.");
    process.exit(1);
  }
  for (const key of fresh) archived.add(key);

  // 4. The updated list.
  writeFileSync(manifestPath, [...archived].sort().join("\n") + "\n");
  const saved = wrangler([
    "r2", "object", "put", `${BUCKET}/${MANIFEST_KEY}`,
    "--remote",
    "--file", manifestPath,
    "--content-type", "text/plain; charset=utf-8",
  ], { quiet: true });
  if (!saved.ok) {
    console.error(saved.output.slice(-2000));
    process.exit(1);
  }
}

console.log(`Archived. ${archived.size} files in ${BUCKET}.`);
