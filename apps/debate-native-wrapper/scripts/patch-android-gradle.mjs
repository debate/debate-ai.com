#!/usr/bin/env node
// Patches the generated src-tauri/gen/android project so its buildSrc can
// resolve Gradle's Kotlin DSL plugin. Run it after every `tauri android init`
// (the `android:init` script, the release workflow and the Android Dockerfile
// all do), because gen/ is git-ignored and regenerated from scratch each time.
//
// Why: buildSrc is a separate Gradle build. With no settings file of its own,
// its plugin dependencies (kotlin-stdlib, kotlin-gradle-plugins-bom,
// kotlin-gradle-plugin-api) resolve from plugins.gradle.org only, and the AAB
// build fails whenever the Plugin Portal can't serve them. Giving buildSrc a
// pluginManagement block with Maven Central and Google fixes that. It also
// unpins an explicit `org.gradle.kotlin.kotlin-dsl` version, so Gradle uses
// the Kotlin DSL plugin version that matches its own release.
//
// Idempotent: running it twice changes nothing the second time.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORIES = ["mavenCentral()", "google()", "gradlePluginPortal()"];

export const BUILDSRC_SETTINGS = `// Added by scripts/patch-android-gradle.mjs: buildSrc is its own Gradle build
// and otherwise resolves plugin dependencies from plugins.gradle.org only.
pluginManagement {
    repositories {
        mavenCentral()
        google()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositories {
        mavenCentral()
        google()
        gradlePluginPortal()
    }
}
`;

/** Index of the `}` closing the block whose `{` is at `open`, or -1. */
function closingBrace(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return i;
  }
  return -1;
}

/**
 * Returns buildSrc/settings.gradle.kts contents with Maven Central, Google and
 * the Plugin Portal in `pluginManagement.repositories`, keeping anything the
 * existing file already declares.
 */
export function patchBuildSrcSettings(existing) {
  if (existing == null || existing.trim() === "") return BUILDSRC_SETTINGS;

  const pm = /pluginManagement\s*\{/.exec(existing);
  if (!pm) {
    const block = BUILDSRC_SETTINGS.split("\n\ndependencyResolutionManagement")[0];
    return `${block}\n\n${existing}`;
  }

  const pmOpen = pm.index + pm[0].length - 1;
  const pmClose = closingBrace(existing, pmOpen);
  if (pmClose === -1) return existing;
  const body = existing.slice(pmOpen + 1, pmClose);

  const repos = /repositories\s*\{/.exec(body);
  if (!repos) {
    const inserted = `\n    repositories {\n${REPOSITORIES.map((r) => `        ${r}`).join("\n")}\n    }`;
    return existing.slice(0, pmOpen + 1) + inserted + existing.slice(pmOpen + 1);
  }

  const reposOpen = pmOpen + 1 + repos.index + repos[0].length - 1;
  const reposClose = closingBrace(existing, reposOpen);
  if (reposClose === -1) return existing;
  const reposBody = existing.slice(reposOpen + 1, reposClose);
  const missing = REPOSITORIES.filter((r) => !reposBody.includes(r));
  if (missing.length === 0) return existing;
  const inserted = missing.map((r) => `\n        ${r}`).join("");
  return existing.slice(0, reposOpen + 1) + inserted + existing.slice(reposOpen + 1);
}

/**
 * Replaces an explicitly pinned `id("org.gradle.kotlin.kotlin-dsl") version "…"`
 * in buildSrc/build.gradle.kts with the version Gradle bundles (`kotlin-dsl`).
 */
export function unpinKotlinDsl(buildGradle) {
  return buildGradle.replace(
    /id\(\s*"org\.gradle\.kotlin\.kotlin-dsl"\s*\)\s*version\s*"[^"]*"/g,
    "`kotlin-dsl`",
  );
}

/** Patches gen/android under `androidDir`; returns the files it changed. */
export function patchAndroidProject(androidDir) {
  const buildSrc = path.join(androidDir, "buildSrc");
  if (!existsSync(buildSrc)) {
    throw new Error(`${buildSrc} not found — run \`tauri android init\` first`);
  }
  const changed = [];

  const settingsPath = path.join(buildSrc, "settings.gradle.kts");
  const settings = existsSync(settingsPath) ? readFileSync(settingsPath, "utf8") : null;
  const nextSettings = patchBuildSrcSettings(settings);
  if (nextSettings !== settings) {
    writeFileSync(settingsPath, nextSettings);
    changed.push(settingsPath);
  }

  const buildPath = path.join(buildSrc, "build.gradle.kts");
  if (existsSync(buildPath)) {
    const build = readFileSync(buildPath, "utf8");
    const nextBuild = unpinKotlinDsl(build);
    if (nextBuild !== build) {
      writeFileSync(buildPath, nextBuild);
      changed.push(buildPath);
    }
  }

  return changed;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const androidDir = path.join(rootDir, "src-tauri", "gen", "android");
  const changed = patchAndroidProject(androidDir);
  console.log(
    changed.length
      ? `patch-android-gradle: updated ${changed.map((f) => path.relative(rootDir, f)).join(", ")}`
      : "patch-android-gradle: gen/android already patched",
  );
}
