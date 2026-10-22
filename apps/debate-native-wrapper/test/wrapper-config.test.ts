import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import {
  generateWrapperFiles,
  remoteCapability,
  resolveProfile,
  tauriConfig,
} from '../scripts/wrapper-config.mjs';

const root = path.resolve(import.meta.dirname, '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
const profileJson = (name: string) => JSON.parse(read(`profiles/${name}.json`));
const readWorkflow = (name: string) => read(`../../.github/workflows/${name}`);

/** The smallest profile configure.mjs accepts. */
const MINIMAL = {
  appName: 'Mini',
  identifier: 'com.mini.app',
  url: 'https://mini.test',
  deepLinkScheme: 'mini',
  version: '0.0.1',
};

describe('generateWrapperFiles', () => {
  it('reproduces every checked-in file from the debate-ai profile', () => {
    // The same guarantee native-wrapper-ci.yml's "Profile matches checked-in
    // config" job checks, without writing anything.
    const files = generateWrapperFiles(profileJson('debate-ai'), 'debate-ai', { readWorkflow, warn: () => {} });
    expect(Object.keys(files).sort()).toEqual([
      'dist/splash-config.js',
      'src-tauri/Info.plist',
      'src-tauri/capabilities/remote.json',
      'src-tauri/src/generated_scheme.rs',
      'src-tauri/tauri.conf.json',
    ]);
    for (const [file, text] of Object.entries(files)) expect(text, file).toBe(read(file));
  });

  it('configures the example profile without touching the debate-ai identity', () => {
    const files = generateWrapperFiles(profileJson('example'), 'example', { readWorkflow, warn: () => {} });
    const conf = JSON.parse(files['src-tauri/tauri.conf.json']);
    expect(conf.identifier).toBe('com.example.app');
    expect(conf.plugins['deep-link'].desktop.schemes).toEqual(['exampleapp']);
    expect(files['src-tauri/src/generated_scheme.rs']).toContain('pub const APP_URL: &str = "https://example.com";');
    expect(files['dist/splash-config.js']).toContain('window.__WRAPPER_DEFAULT_SOURCE__ = "live";');
  });

  it('fills in defaults for a minimal profile', () => {
    const files = generateWrapperFiles(MINIMAL, 'mini');
    const conf = JSON.parse(files['src-tauri/tauri.conf.json']);
    expect(conf.productName).toBe('Mini');
    expect(conf.app.windows[0]).toMatchObject({ title: 'Mini', width: 1280, height: 800, visible: false });
    expect(conf.bundle).toMatchObject({ publisher: 'Mini', copyright: '', category: 'Productivity' });
    expect(conf.bundle.macOS.minimumSystemVersion).toBe('10.15');
    expect(conf.bundle.android).toBeUndefined();
    expect(conf.bundle.iOS).toBeUndefined();
    expect(conf.plugins.updater).toBeUndefined();
    expect(files['src-tauri/src/generated_scheme.rs']).toContain('("live", "Mini", "https://mini.test")');
    expect(files['src-tauri/Info.plist']).toContain('Mini uses the camera for video in live rounds.');
    expect(JSON.parse(files['src-tauri/capabilities/remote.json']).remote.urls).toEqual(['https://mini.test/*']);
  });

  it('escapes XML in the media usage strings', () => {
    const plist = generateWrapperFiles(
      { ...MINIMAL, mediaUsage: { camera: 'A & B <cam>', microphone: 'mic' } },
      'mini',
    )['src-tauri/Info.plist'];
    expect(plist).toContain('<string>A &amp; B &lt;cam&gt;</string>');
  });

  it('defaults android and iOS versions when those sections are empty', () => {
    const conf = JSON.parse(generateWrapperFiles({ ...MINIMAL, android: {}, ios: {} }, 'mini')['src-tauri/tauri.conf.json']);
    expect(conf.bundle.android).toEqual({ minSdkVersion: 24 });
    expect(conf.bundle.iOS).toEqual({ minimumSystemVersion: '14.0' });
  });
});

describe('resolveProfile', () => {
  it.each(['appName', 'identifier', 'url', 'deepLinkScheme', 'version'])('requires %s', (field) => {
    expect(() => resolveProfile({ ...MINIMAL, [field]: '' }, 'mini')).toThrow(`missing required field "${field}"`);
  });

  it('rejects a source without a label', () => {
    expect(() => resolveProfile({ ...MINIMAL, sources: [{ id: 'a', url: 'https://a.test' }] }, 'mini')).toThrow(
      'every entry in "sources" needs a "label"',
    );
  });

  it('rejects a default source that is not listed', () => {
    const sources = [{ id: 'a', label: 'A', url: 'https://a.test' }];
    expect(() => resolveProfile({ ...MINIMAL, sources, defaultSource: 'b' }, 'mini')).toThrow(
      '"defaultSource" "b" is not one of "sources"',
    );
  });

  it('defaults to the first source', () => {
    const sources = [
      { id: 'a', label: 'A', url: 'https://a.test' },
      { id: 'b', label: 'B', url: 'https://b.test' },
    ];
    expect(resolveProfile({ ...MINIMAL, sources }, 'mini').defaultSource).toBe('a');
  });

  it('rejects a tag prefix the release workflows do not use', () => {
    expect(() => resolveProfile({ ...MINIMAL, release: { tagPrefix: 'other-v' } }, 'mini', { readWorkflow })).toThrow(
      'does not match .github/workflows/native-wrapper-release.yml',
    );
  });

  it('skips the workflow check when the workflows are not there', () => {
    expect(resolveProfile({ ...MINIMAL, release: { tagPrefix: 'other-v' } }, 'mini').release).toMatchObject({
      tagPrefix: 'other-v',
      name: 'Mini Native',
      updateFeedTag: 'native-wrapper-updates',
    });
  });
});

describe('tauriConfig updater', () => {
  const resolved = (profile: Record<string, unknown>) => resolveProfile(profile, 'mini');
  const feed = 'https://github.com/o/r/releases/download/native-wrapper-updates/latest.json';

  it('turns the updater on when the profile has a public key', () => {
    const profile = { ...MINIMAL, updater: { pubkey: 'KEY', endpoints: [feed] } };
    const warn = vi.fn();
    const conf = tauriConfig(profile, 'mini', resolved(profile), warn);
    expect(conf.bundle.createUpdaterArtifacts).toBe(true);
    expect(conf.plugins.updater).toEqual({ pubkey: 'KEY', endpoints: [feed], windows: { installMode: 'passive' } });
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns when no endpoint points at the update feed release', () => {
    const profile = { ...MINIMAL, updater: { pubkey: 'KEY', endpoints: ['https://elsewhere.test/latest.json'] } };
    const warn = vi.fn();
    tauriConfig(profile, 'mini', resolved(profile), warn);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no updater endpoint points at'));
  });

  it('warns and stays off without a public key', () => {
    const profile = { ...MINIMAL, updater: { pubkey: '', endpoints: [feed] } };
    const warn = vi.fn();
    expect(tauriConfig(profile, 'mini', resolved(profile), warn).plugins.updater).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('auto-update is off'));
  });

  it('needs at least one endpoint', () => {
    const profile = { ...MINIMAL, updater: { pubkey: 'KEY', endpoints: [] } };
    expect(() => tauriConfig(profile, 'mini', resolved(profile))).toThrow('needs at least one entry in "endpoints"');
  });

  it('needs https endpoints', () => {
    const profile = { ...MINIMAL, updater: { pubkey: 'KEY', endpoints: ['http://insecure.test/latest.json'] } };
    expect(() => tauriConfig(profile, 'mini', resolved(profile))).toThrow('must be https://');
  });
});

describe('remoteCapability', () => {
  it('scopes IPC to the trusted origins', () => {
    const capability = remoteCapability({ ...MINIMAL, trustedOrigins: ['https://a.test', 'https://*.a.test'] }, 'mini');
    expect(capability.remote.urls).toEqual(['https://a.test/*', 'https://*.a.test/*']);
    expect(capability.windows).toEqual(['main', 'mini-player']);
  });

  it.each(['http://a.test', 'https://a.test/path'])('rejects %s', (origin) => {
    expect(() => remoteCapability({ ...MINIMAL, trustedOrigins: [origin] }, 'mini')).toThrow(
      'must be an https:// origin with no path',
    );
  });
});
