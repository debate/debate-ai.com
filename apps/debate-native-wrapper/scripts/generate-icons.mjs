#!/usr/bin/env node
// Generates the full platform icon set (Windows .ico, macOS .icns, Linux/
// Android/iOS PNGs at every required size) from the active profile's single
// `iconSource` PNG, using the Tauri CLI's own icon generator so the output
// always matches what the installed @tauri-apps/cli version expects.
//
// The generated files are NOT committed: they are derived from one source PNG
// and written by this script only when needed (missing or older than the
// source). `npm run icons` regenerates them on demand; `npm run configure`
// regenerates them when they are stale, so a normal build never needs a
// separate icon step.

import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

export function profilePathFor(rootDir, profileName) {
  return path.join(rootDir, "profiles", `${profileName}.json`);
}

export function loadProfile(rootDir, profileName) {
  const profilePath = profilePathFor(rootDir, profileName);
  const profile = JSON.parse(readFileSync(profilePath, "utf8"));
  return { profile, profilePath };
}

export function iconSourcePath(profile, profilePath) {
  if (!profile.iconSource) {
    throw new Error(`profiles/${path.relative(path.resolve(profilePath, ".."), profilePath)} has no "iconSource"`);
  }
  return path.resolve(path.dirname(profilePath), profile.iconSource);
}

export function iconsOutDir(rootDir) {
  return path.join(rootDir, "src-tauri", "icons");
}

// True when the generated set is good enough to skip regeneration: the source
// PNG exists, the output dir has its marker file, and the marker is at least as
// new as the source. A missing or older marker means "regenerate".
export function iconsUpToDate(rootDir, profile, profilePath) {
  let iconSource;
  try {
    iconSource = iconSourcePath(profile, profilePath);
  } catch {
    return false;
  }
  if (!existsSync(iconSource)) return false;
  const marker = path.join(iconsOutDir(rootDir), "icon.icns");
  if (!existsSync(marker)) return false;
  return statSync(marker).mtimeMs >= statSync(iconSource).mtimeMs;
}

export function generateIcons(rootDir, profile, profilePath, { spawn = spawnSync } = {}) {
  const iconSource = iconSourcePath(profile, profilePath);
  const outDir = iconsOutDir(rootDir);

  console.log(`[native-wrapper] generating icons from ${path.relative(rootDir, iconSource)} -> src-tauri/icons/`);

  const result = spawn("npx", ["--yes", "@tauri-apps/cli@2", "icon", iconSource, "-o", outDir], {
    cwd: rootDir,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    console.error(
      "[native-wrapper] icon generation failed. Make sure iconSource points at a square PNG " +
        "(1024x1024 recommended) and that the Rust toolchain is installed (the Tauri CLI's icon " +
        "command shells out to it).",
    );
    process.exit(result.status ?? 1);
  }

  console.log("[native-wrapper] icons written. Android/iOS project icons are re-derived from these " +
    "the next time `npm run android:init` / `npm run ios:init` regenerates gen/android or gen/apple.");
}

function main() {
  const profileName = process.argv.includes("--profile")
    ? process.argv[process.argv.indexOf("--profile") + 1]
    : (process.env.WRAPPER_PROFILE ?? "debate-ai");

  const { profile, profilePath } = loadProfile(rootDir, profileName);

  if (iconsUpToDate(rootDir, profile, profilePath)) {
    console.log("[native-wrapper] icons are up to date; nothing to do.");
    return;
  }

  generateIcons(rootDir, profile, profilePath);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}