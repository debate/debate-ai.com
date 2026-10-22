#!/usr/bin/env node
// Regenerates every app-specific file from a JSON profile in profiles/:
// src-tauri/tauri.conf.json, the Rust constants in generated_scheme.rs, the
// remote IPC scope in capabilities/remote.json, Info.plist, and the bundled
// pages' dist/splash-config.js. This is what makes the package
// generic: swap the profile, re-run this script, and the wrapper points at a
// different site with a different identity. Everything downstream (icons, CI,
// the OAuth handoff) reads the values this script writes, not the profile
// file directly, so there is exactly one place that understands the
// profile -> tauri.conf.json mapping: scripts/wrapper-config.mjs, which this
// script only feeds and writes out.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { generateWrapperFiles } from "./wrapper-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const profileName = process.argv.includes("--profile")
  ? process.argv[process.argv.indexOf("--profile") + 1]
  : (process.env.WRAPPER_PROFILE ?? "debate-ai");

const profilePath = path.join(rootDir, "profiles", `${profileName}.json`);
const profile = JSON.parse(readFileSync(profilePath, "utf8"));

const files = generateWrapperFiles(profile, profileName, {
  readWorkflow: (workflow) => {
    const workflowPath = path.resolve(rootDir, "../../.github/workflows", workflow);
    return existsSync(workflowPath) ? readFileSync(workflowPath, "utf8") : null;
  },
  warn: (message) => console.warn(message),
});

console.log(`[native-wrapper] configured for profile "${profileName}" (${profile.appName}, ${profile.url})`);
for (const [file, text] of Object.entries(files)) {
  writeFileSync(path.join(rootDir, file), text, "utf8");
  console.log(`  wrote ${file}`);
}
console.log(`  run "npm run icons" if ${profileName}'s iconSource changed`);
