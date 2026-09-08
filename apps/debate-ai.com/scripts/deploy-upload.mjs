#!/usr/bin/env node
/**
 * Retrying wrapper around `wrangler versions upload`.
 *
 * Cloudflare's asset-upload endpoint intermittently answers with a 5xx from its
 * own edge (`upstream connect error ... reset reason: connection termination`),
 * which fails the whole Workers Builds run even though nothing is wrong with the
 * build. Those responses are safe to retry: `versions upload` publishes a new
 * immutable version instead of mutating live traffic, so a repeated attempt
 * either uploads the same assets again or no-ops on the ones already stored.
 *
 * Everything else — bad config, a missing binding, an auth failure — fails on
 * the first attempt so a real error is not hidden behind minutes of backoff.
 *
 * Usage: node scripts/deploy-upload.mjs [extra wrangler args...]
 *   DEPLOY_UPLOAD_ATTEMPTS  total attempts, default 4
 */
import { spawn } from "node:child_process";

const MAX_ATTEMPTS = Math.max(1, Number(process.env.DEPLOY_UPLOAD_ATTEMPTS) || 4);
const BACKOFF_MS = [5000, 15000, 45000];

/** Cloudflare-side hiccups, not problems with this repo's config or bundle. */
const TRANSIENT_PATTERNS = [
  /received a malformed response from the api/i,
  /upstream connect error/i,
  /connection termination/i,
  /\b5\d\d\s+(service unavailable|bad gateway|gateway timeout|internal server error)/i,
  /->\s*5\d\d\s/,
  /\b429\b|too many requests|rate limit/i,
  /\b(ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|EPIPE|socket hang up)\b/i,
  /fetch failed/i,
];

const isTransient = (output) => TRANSIENT_PATTERNS.some((re) => re.test(output));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs wrangler, streaming its output through to the build log while also
 * buffering it so the failure reason can be classified.
 */
function runWrangler(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["wrangler", "versions", "upload", ...args], {
      stdio: ["inherit", "pipe", "pipe"],
      env: process.env,
    });

    let output = "";
    const tee = (stream, sink) => {
      stream.setEncoding("utf8");
      stream.on("data", (chunk) => {
        output += chunk;
        sink.write(chunk);
      });
    };
    tee(child.stdout, process.stdout);
    tee(child.stderr, process.stderr);

    child.on("error", reject);
    child.on("close", (code, signal) => {
      resolve({ code: signal ? 1 : (code ?? 1), output });
    });
  });
}

const extraArgs = process.argv.slice(2);

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  const { code, output } = await runWrangler(extraArgs);

  if (code === 0) {
    if (attempt > 1) console.log(`\nversions upload succeeded on attempt ${attempt}.`);
    process.exit(0);
  }

  if (!isTransient(output)) {
    console.error(`\nversions upload failed with a non-transient error — not retrying.`);
    process.exit(code);
  }

  if (attempt === MAX_ATTEMPTS) {
    console.error(`\nversions upload still failing after ${MAX_ATTEMPTS} attempts (Cloudflare API unavailable).`);
    process.exit(code);
  }

  const waitMs = BACKOFF_MS[attempt - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
  console.error(
    `\nCloudflare API returned a transient error (attempt ${attempt}/${MAX_ATTEMPTS}). ` +
      `Retrying in ${waitMs / 1000}s…\n`,
  );
  await sleep(waitMs);
}
