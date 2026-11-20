import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  BUILDSRC_SETTINGS,
  patchAndroidProject,
  patchBuildSrcSettings,
  unpinKotlinDsl,
} from '../scripts/patch-android-gradle.mjs';

describe('patchBuildSrcSettings', () => {
  it('writes the full settings file when buildSrc has none', () => {
    expect(patchBuildSrcSettings(null)).toBe(BUILDSRC_SETTINGS);
  });

  it('is idempotent', () => {
    expect(patchBuildSrcSettings(BUILDSRC_SETTINGS)).toBe(BUILDSRC_SETTINGS);
  });

  it('prepends pluginManagement and keeps existing settings', () => {
    const out = patchBuildSrcSettings('rootProject.name = "buildSrc"\n');
    expect(out).toMatch(/^\/\/ Added by[\s\S]*pluginManagement \{[\s\S]*mavenCentral\(\)/);
    expect(out).toContain('rootProject.name = "buildSrc"');
  });

  it('adds only the missing repositories to an existing block', () => {
    const existing = 'pluginManagement {\n    repositories {\n        gradlePluginPortal()\n    }\n}\n';
    const out = patchBuildSrcSettings(existing);
    expect(out).toContain('mavenCentral()');
    expect(out).toContain('google()');
    expect(out.match(/gradlePluginPortal\(\)/g)).toHaveLength(1);
    expect(patchBuildSrcSettings(out)).toBe(out);
  });

  it('adds a repositories block to a pluginManagement without one', () => {
    const out = patchBuildSrcSettings('pluginManagement {\n    includeBuild("x")\n}\n');
    expect(out).toMatch(/pluginManagement \{\n {4}repositories \{\n {8}mavenCentral\(\)/);
    expect(out).toContain('includeBuild("x")');
  });
});

describe('unpinKotlinDsl', () => {
  it('replaces a pinned kotlin-dsl plugin with the Gradle-bundled one', () => {
    const src = 'plugins {\n    id("org.gradle.kotlin.kotlin-dsl") version "6.6.4"\n}\n';
    expect(unpinKotlinDsl(src)).toBe('plugins {\n    `kotlin-dsl`\n}\n');
  });

  it('leaves the default Tauri template alone', () => {
    const src = 'plugins {\n    `kotlin-dsl`\n}\n';
    expect(unpinKotlinDsl(src)).toBe(src);
  });
});

describe('patchAndroidProject', () => {
  it('patches a generated project and is a no-op the second time', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'gen-android-'));
    mkdirSync(path.join(dir, 'buildSrc'));
    writeFileSync(
      path.join(dir, 'buildSrc', 'build.gradle.kts'),
      'plugins {\n    id("org.gradle.kotlin.kotlin-dsl") version "6.6.4"\n}\n',
    );

    expect(patchAndroidProject(dir)).toHaveLength(2);
    expect(readFileSync(path.join(dir, 'buildSrc', 'settings.gradle.kts'), 'utf8')).toBe(BUILDSRC_SETTINGS);
    expect(readFileSync(path.join(dir, 'buildSrc', 'build.gradle.kts'), 'utf8')).toContain('`kotlin-dsl`');
    expect(patchAndroidProject(dir)).toEqual([]);
  });

  it('throws when the project has not been generated', () => {
    expect(() => patchAndroidProject(path.join(tmpdir(), 'missing-gen-android'))).toThrow(/android init/);
  });
});
