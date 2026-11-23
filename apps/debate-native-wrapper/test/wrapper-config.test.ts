import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import {
  flatpakSettings,
  generateWrapperFiles,
  remoteCapability,
  snapSettings,
  resolveProfile,
  tauriConfig,
} from '../scripts/wrapper-config.mjs';
import {
  iconSourcePath,
  iconsOutDir,
  iconsUpToDate,
  loadProfile,
  profilePathFor,
} from '../scripts/generate-icons.mjs';

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
      'flatpak/com.debate.ai.metainfo.xml',
      'flatpak/com.debate.ai.yml',
      'snapcraft/snapcraft.yaml',
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

  it('leaves the desktop bridge off unless the profile sets a port', () => {
    expect(generateWrapperFiles(MINIMAL, 'mini')['src-tauri/src/generated_scheme.rs']).toContain(
      'pub const DESKTOP_BRIDGE_PORT: u16 = 0;',
    );
    expect(
      generateWrapperFiles({ ...MINIMAL, desktopBridgePort: 47615 }, 'mini')['src-tauri/src/generated_scheme.rs'],
    ).toContain('pub const DESKTOP_BRIDGE_PORT: u16 = 47615;');
  });

  it('rejects a desktop bridge port outside 1024-65535', () => {
    for (const desktopBridgePort of [80, 70000, 1.5, '47615']) {
      expect(() => resolveProfile({ ...MINIMAL, desktopBridgePort }, 'mini')).toThrow('"desktopBridgePort" must be');
    }
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

describe('flatpak', () => {
  it('generates nothing without a flatpak block', () => {
    expect(flatpakSettings(MINIMAL, 'mini')).toBeNull();
    expect(Object.keys(generateWrapperFiles(MINIMAL, 'mini')).some((file) => file.startsWith('flatpak/'))).toBe(false);
  });

  it('names the manifest, command, desktop file and icon after the profile', () => {
    const files = generateWrapperFiles({ ...MINIMAL, productName: 'Mini App', flatpak: {} }, 'mini');
    const manifest = files['flatpak/com.mini.app.yml'];
    expect(manifest).toContain('id: com.mini.app\n');
    expect(manifest).toContain('command: mini-app\n');
    expect(manifest).toContain("runtime-version: '51'");
    expect(manifest).toContain('install -Dm755 "$bin" /app/bin/mini-app');
    expect(manifest).toContain("-e 's/^Exec=(\"[^\"]*\"|[^ ]+)/Exec=mini-app/'");
    expect(manifest).toContain('/app/share/applications/com.mini.app.desktop');
    expect(manifest).toContain('"/app/share/icons/hicolor/$size/apps/com.mini.app.png"');
    const metainfo = files['flatpak/com.mini.app.metainfo.xml'];
    expect(metainfo).toContain('<launchable type="desktop-id">com.mini.app.desktop</launchable>');
    expect(metainfo).toContain('<url type="homepage">https://mini.test</url>');
    expect(metainfo).toContain('<content_rating type="oars-1.1"/>');
    expect(metainfo).not.toContain('<releases>');
  });

  it('uses flatpak.appId over the identifier and writes releases, screenshots and ratings', () => {
    const files = generateWrapperFiles(
      {
        ...MINIMAL,
        flatpak: {
          appId: 'io.github.mini.Mini',
          releaseDate: '2026-01-02',
          screenshots: [{ url: 'https://mini.test/a.png', caption: 'A & B' }],
          contentRating: { 'social-chat': 'mild' },
        },
      },
      'mini',
    );
    const metainfo = files['flatpak/io.github.mini.Mini.metainfo.xml'];
    expect(files['flatpak/io.github.mini.Mini.yml']).toContain('id: io.github.mini.Mini');
    expect(metainfo).toContain('<release version="0.0.1" date="2026-01-02"/>');
    expect(metainfo).toContain('<caption>A &amp; B</caption>');
    expect(metainfo).toContain('<developer id="io.github">');
    expect(metainfo).toContain('<content_attribute id="social-chat">mild</content_attribute>');
  });

  it('rejects bad ids and dates', () => {
    expect(() => flatpakSettings({ ...MINIMAL, flatpak: { appId: 'mini.app' } }, 'mini')).toThrow('at least three parts');
    expect(() => flatpakSettings({ ...MINIMAL, flatpak: { appId: 'com.1mini.app' } }, 'mini')).toThrow('reverse-DNS');
    expect(() => flatpakSettings({ ...MINIMAL, flatpak: { releaseDate: 'soon' } }, 'mini')).toThrow('YYYY-MM-DD');
  });
});

describe('snap', () => {
  it('generates nothing without a snap block', () => {
    expect(snapSettings(MINIMAL, 'mini')).toBeNull();
    expect(generateWrapperFiles(MINIMAL, 'mini')['snapcraft/snapcraft.yaml']).toBeUndefined();
  });

  it('names the snap, its app and desktop file after the profile', () => {
    const yaml = generateWrapperFiles({ ...MINIMAL, productName: 'Mini App', snap: {} }, 'mini')['snapcraft/snapcraft.yaml'];
    expect(yaml).toContain('name: mini-app\n');
    expect(yaml).toContain('version: "0.0.1"');
    expect(yaml).toContain('confinement: strict');
    expect(yaml).toContain('    command: usr/bin/mini-app');
    expect(yaml).toContain('    desktop: usr/share/applications/mini-app.desktop');
    expect(yaml).toContain('    extensions: [gnome]');
    expect(yaml).toContain('-e "s|^Icon=.*|Icon=\\${SNAP}/$icon|"');
  });

  it('rejects names and summaries the store refuses', () => {
    expect(() => snapSettings({ ...MINIMAL, snap: { name: 'Mini_App' } }, 'mini')).toThrow('snap.name');
    expect(() => snapSettings({ ...MINIMAL, snap: { summary: 'x'.repeat(79) } }, 'mini')).toThrow('78 characters');
  });

  it('matches the debate-ai profile', () => {
    expect(snapSettings(profileJson('debate-ai'), 'debate-ai')).toMatchObject({ name: 'debate-ai', storeChannel: 'stable' });
    expect(flatpakSettings(profileJson('debate-ai'), 'debate-ai')).toMatchObject({ appId: 'com.debate.ai', command: 'debate-ai' });
  });
});
