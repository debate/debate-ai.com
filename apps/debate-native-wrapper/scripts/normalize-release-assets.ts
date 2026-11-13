#!/usr/bin/env bun
/**
 * normalize-release-assets.ts
 *
 * Standardizes release artifact filenames to the debate-ai convention:
 *
 *   debate-ai-{version}-{platform}-{architecture}[-{variant}].{extension}
 *
 * Runs in the `publish-release` job of
 * `.github/workflows/native-wrapper-release.yml`, after every build job has
 * attached its artifacts to the draft release. It renames each asset via the
 * GitHub Releases API (PATCH /releases/assets/{id}), so binary contents — and
 * therefore SHA-256 — are never touched.
 *
 * Environment variables (all required):
 *   GITHUB_TOKEN       repo-scoped token for the GitHub API
 *   RELEASE_ID         numeric id of the release whose assets to normalize
 *   TAG                release tag, e.g. native-wrapper-v1.0.0
 *   APP_VERSION        version from src-tauri/tauri.conf.json (no leading v)
 *   EXTENSION_VERSION  version from apps/debate-browser-ext/.output/chrome-mv3/manifest.json
 */

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const API = "https://api.github.com";
const OWNER = "debate";
const REPO = "debate-ai.com";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

const TOKEN = env("GITHUB_TOKEN");
const RELEASE_ID = env("RELEASE_ID");
const APP_VERSION = env("APP_VERSION");
const EXTENSION_VERSION = env("EXTENSION_VERSION");

async function ghApi(path: string, opts?: { method?: string; body?: unknown }): Promise<unknown> {
  const res = await fetch(`${API}${path}`, {
    method: opts?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(opts?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${opts?.method ?? "GET"} ${path}: HTTP ${res.status} ${body}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

interface ReleaseAsset {
  id: number;
  name: string;
  browser_download_url: string;
  url: string;
}

type Platform = "windows" | "macos" | "linux" | "ios" | "browser";
type Arch = "x64" | "arm64" | "universal";

interface ParsedArtifact {
  version: string;
  platform: Platform;
  architecture?: Arch; // undefined for browser (omitted per convention)
  variant?: string; // "setup" | "unsigned-sideload" | undefined
  extension: string;
}

const archMap: Record<string, Arch> = {
  x86_64: "x64",
  amd64: "x64",
  arm64: "arm64",
  aarch64: "arm64",
  universal: "universal",
};

function platformFromExt(ext: string): Platform | null {
  const lower = ext.toLowerCase();
  if (lower === "dmg" || lower === "app.tar.gz") return "macos";
  if (lower === "exe" || lower === "msi") return "windows";
  if (lower === "deb" || lower === "rpm" || lower === "appimage") return "linux";
  if (lower === "ipa") return "ios";
  return null;
}

function normalizeExt(ext: string): string {
  return ext.toLowerCase();
}

function parseArtifact(
  name: string,
  appVersion: string,
  extVersion: string,
): ParsedArtifact | null {
  // --- Browser extension: debate-browser-extension-6.4.0.zip ---
  {
    const m = name.match(/^debate-browser-extension-(\d+\.\d+\.\d+)\.zip$/);
    if (m) {
      return { version: m[1], platform: "browser", extension: "zip" };
    }
  }

  // --- macOS app.tar.gz without version: Debate.AI_universal.app.tar.gz ---
  {
    const m = name.match(
      /^Debate\.AI_(x86_64|amd64|arm64|aarch64|universal)\.app\.tar\.gz$/,
    );
    if (m) {
      return {
        version: appVersion,
        platform: "macos",
        architecture: archMap[m[1]],
        extension: "app.tar.gz",
      };
    }
  }

  // --- RPM with package release: Debate.AI-1.0.0-1.x86_64.rpm ---
  {
    const m = name.match(
      /^Debate\.AI-(\d+\.\d+\.\d+)-(\d+)\.(x86_64|amd64|arm64|aarch64|universal)\.rpm$/,
    );
    if (m) {
      // Package release (group 2) is preserved internally, omitted from filename.
      return {
        version: m[1],
        platform: "linux",
        architecture: archMap[m[3]],
        extension: "rpm",
      };
    }
  }

  // --- Standard Tauri: Debate.AI_1.0.0_<arch>[-<variant>][_<locale>].<ext> ---
  // Also matches iOS unsigned: Debate.AI_1.0.0_unsigned-sideload.ipa (no arch)
  {
    const m = name.match(
      /^Debate\.AI_(\d+\.\d+\.\d+)_(?:(x86_64|amd64|arm64|aarch64|universal))?(?:-setup|-unsigned-sideload)?(?:_[a-z]{2}-[A-Z]{2})?\.(.+)$/,
    );
    if (m) {
      const [, version, archRaw, extRaw] = m;
      const ext = normalizeExt(extRaw);
      const platform = platformFromExt(ext);
      if (!platform) return null;

      let architecture: Arch | undefined;
      if (archRaw) architecture = archMap[archRaw];
      else if (platform === "ios") architecture = "arm64"; // provisional iOS arch

      let variant: string | undefined;
      if (/-setup\./.test(name)) variant = "setup";
      else if (/-unsigned-sideload\./.test(name)) variant = "unsigned-sideload";

      return { version, platform, architecture, variant, extension: ext };
    }
  }

  return null;
}

function newName(parsed: ParsedArtifact): string {
  const parts = ["debate-ai", parsed.version, parsed.platform];
  if (parsed.architecture) parts.push(parsed.architecture);
  if (parsed.variant) parts.push(parsed.variant);
  return `${parts.join("-")}.${parsed.extension}`;
}

async function sha256Of(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/octet-stream" },
  });
  if (!res.ok) {
    throw new Error(`Cannot download ${url}: HTTP ${res.status}`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  return createHash("sha256").update(bytes).digest("hex");
}

async function main(): Promise<void> {
  const release: { assets: ReleaseAsset[] } = await ghApi(
    `/repos/${OWNER}/${REPO}/releases/${RELEASE_ID}`,
  );
  const assets: ReleaseAsset[] = release.assets ?? [];

  if (assets.length === 0) {
    console.log("No release assets to normalize.");
    const outDir = process.env.RUNNER_TEMP ?? "/tmp";
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "normalize-mapping.json"), "{}");
    writeFileSync(join(outDir, "normalize-hashes.json"), "{}");
    return;
  }

  // 1. Parse every asset and compute its target name.
  const planned: { asset: ReleaseAsset; parsed: ParsedArtifact; new: string }[] = [];
  const unparsed: string[] = [];

  for (const asset of assets) {
    const parsed = parseArtifact(asset.name, APP_VERSION, EXTENSION_VERSION);
    if (!parsed) {
      unparsed.push(asset.name);
      continue;
    }
    planned.push({ asset, parsed, new: newName(parsed) });
  }

  if (unparsed.length > 0) {
    console.warn(
      `Could not parse ${unparsed.length} asset(s), leaving unchanged: ${unparsed.join(", ")}`,
    );
  }

  // 2. Collision detection.
  const byNew = new Map<string, ReleaseAsset[]>();
  for (const p of planned) {
    const list = byNew.get(p.new) ?? [];
    list.push(p.asset);
    byNew.set(p.new, list);
  }
  const collisions: string[] = [];
  for (const [n, list] of byNew) {
    if (list.length > 1) {
      collisions.push(`${n} (from ${list.map((a) => a.name).join(", ")})`);
    }
  }
  if (collisions.length > 0) {
    throw new Error(
      `Filename collision detected — refusing to rename: ${collisions.join("; ")}`,
    );
  }

  // 3. Idempotency: assets already named per convention need no change.
  const toRename = planned.filter((p) => p.asset.name !== p.new);
  const already = planned.filter((p) => p.asset.name === p.new);
  if (already.length > 0) {
    console.log(
      `Already normalized (skipping): ${already.map((p) => p.asset.name).join(", ")}`,
    );
  }
  if (toRename.length === 0 && unparsed.length === 0) {
    console.log("All assets already use the convention names.");
    const outDir = process.env.RUNNER_TEMP ?? "/tmp";
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "normalize-mapping.json"), "{}");
    writeFileSync(join(outDir, "normalize-hashes.json"), "{}");
    return;
  }

  // 4. Verify SHA-256 of every asset before renaming (content never changes;
  //    recording hashes lets downstream steps confirm integrity).
  const hashes: Record<string, string> = {};
  for (const p of planned) {
    const hash = await sha256Of(p.asset.browser_download_url);
    hashes[p.asset.name] = hash;
    hashes[p.new] = hash;
  }

  // 5. Rename via the GitHub Releases API.
  const mapping: Record<string, string> = {};
  for (const p of toRename) {
    await ghApi(`/repos/${OWNER}/${REPO}/releases/assets/${p.asset.id}`, {
      method: "PATCH",
      body: { name: p.new },
    });
    mapping[p.asset.name] = p.new;
    console.log(`Renamed ${p.asset.name} → ${p.new}`);
  }

  // 6. Write mapping + hashes for downstream steps (latest.json, checksums).
  const outDir = process.env.RUNNER_TEMP ?? "/tmp";
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "normalize-mapping.json"), JSON.stringify(mapping, null, 2));
  writeFileSync(join(outDir, "normalize-hashes.json"), JSON.stringify(hashes, null, 2));

  console.log(
    `Normalized ${toRename.length} asset(s); ${already.length} already conformed; ${unparsed.length} unparsed (unchanged).`,
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
