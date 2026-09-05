#!/usr/bin/env node
// Generates the full platform icon set (Windows .ico, macOS .icns, Linux/
// Android/iOS PNGs at every required size) from the active profile's single
// `iconSource` PNG, using the Tauri CLI's own icon generator so the output
// always matches what the installed @tauri-apps/cli version expects.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const profileName = process.argv.includes("--profile")
  ? process.argv[process.argv.indexOf("--profile") + 1]
  : (process.env.WRAPPER_PROFILE ?? "debate-ai");

const profilePath = path.join(rootDir, "profiles", `${profileName}.json`);
const profile = JSON.parse(readFileSync(profilePath, "utf8"));

if (!profile.iconSource) {
  throw new Error(`profiles/${profileName}.json has no "iconSource"`);
}

const iconSource = path.resolve(path.dirname(profilePath), profile.iconSource);
const outDir = path.join(rootDir, "src-tauri", "icons");

console.log(`[native-wrapper] generating icons from ${path.relative(rootDir, iconSource)} -> src-tauri/icons/`);

const result = spawnSync(
  "npx",
  ["--yes", "@tauri-apps/cli@2", "icon", iconSource, "-o", outDir],
  { cwd: rootDir, stdio: "inherit" },
);

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
