// The profile -> generated files mapping behind scripts/configure.mjs, kept
// free of file I/O so it can be unit tested (test/wrapper-config.test.ts):
// configure.mjs reads the profile, calls generateWrapperFiles, and writes what
// comes back. Every function here returns the exact text or object that ends
// up on disk.

/**
 * Checks a profile and fills in its defaults: the sources the window can load
 * from, the default source, the release naming and the window size.
 *
 * `readWorkflow(name)` returns the text of `.github/workflows/<name>`, or
 * `null` when it isn't there (a copy of this package outside the monorepo).
 */
export function resolveProfile(profile, profileName, { readWorkflow = () => null } = {}) {
  for (const required of ["appName", "identifier", "url", "deepLinkScheme", "version"]) {
    if (!profile[required]) {
      throw new Error(`profiles/${profileName}.json is missing required field "${required}"`);
    }
  }

  // The places the window can load the app from, which the user picks between
  // in the wrapper's settings (dist/settings.html, and the tray's "Load From"
  // menu on desktop). A `url` without a scheme is a page bundled in dist/ —
  // the offline build — rather than a site. A profile without `sources` has
  // just the one: its `url`.
  const sources = profile.sources ?? [{ id: "live", label: profile.appName, url: profile.url }];
  const defaultSource = profile.defaultSource ?? sources[0]?.id;
  for (const source of sources) {
    for (const field of ["id", "label", "url"]) {
      if (typeof source[field] !== "string" || !source[field]) {
        throw new Error(`profiles/${profileName}.json: every entry in "sources" needs a "${field}"`);
      }
    }
  }
  if (!sources.some((source) => source.id === defaultSource)) {
    throw new Error(`profiles/${profileName}.json: "defaultSource" "${defaultSource}" is not one of "sources"`);
  }

  // Release naming, read by the native-wrapper-*.yml workflows (with jq) and
  // checked here against the one thing they cannot read from a file: the tag
  // prefix written literally in their `on:` trigger and `if:` condition.
  const release = {
    tagPrefix: "native-wrapper-v",
    name: `${profile.appName} Native`,
    notes: `Desktop + mobile installers for ${profile.appName}.`,
    updateFeedTag: "native-wrapper-updates",
    ...profile.release,
  };
  for (const [workflow, literal] of [
    ["native-wrapper-release.yml", `"${release.tagPrefix}*`],
    ["native-wrapper-updates.yml", `'${release.tagPrefix}'`],
  ]) {
    const text = readWorkflow(workflow);
    if (text != null && !text.includes(literal)) {
      throw new Error(
        `profiles/${profileName}.json: release.tagPrefix "${release.tagPrefix}" does not match ` +
          `.github/workflows/${workflow}; change the tag prefix there too`,
      );
    }
  }

  const win = {
    width: 1280,
    height: 800,
    minWidth: 480,
    minHeight: 480,
    fullscreen: false,
    maximized: false,
    resizable: true,
    ...profile.window,
  };

  return { sources, defaultSource, release, win };
}

/** src-tauri/tauri.conf.json, as an object. `warn` receives non-fatal notes. */
export function tauriConfig(profile, profileName, { release, win }, warn = () => {}) {
  const tauriConf = {
    $schema: "https://schema.tauri.app/config/2",
    productName: profile.productName ?? profile.appName,
    version: profile.version,
    identifier: profile.identifier,
    build: {
      frontendDist: "../dist",
    },
    app: {
      withGlobalTauri: true,
      windows: [
        {
          label: "main",
          title: win.title ?? profile.appName,
          // The bundled launch splash (dist/index.html + splash.mp4), which
          // navigates to profile.url once the video finishes.
          url: "index.html",
          width: win.width,
          height: win.height,
          minWidth: win.minWidth,
          minHeight: win.minHeight,
          resizable: win.resizable,
          fullscreen: win.fullscreen,
          maximized: win.maximized,
          center: true,
          // Created hidden so a launch at login stays in the tray without
          // flashing on screen; src-tauri/src/background.rs shows it on any
          // other launch (and on mobile, which has no tray, it is shown at once).
          visible: false,
        },
      ],
      security: {
        capabilities: ["default", "remote"],
      },
    },
    bundle: {
      active: true,
      targets: "all",
      publisher: profile.copyright ?? profile.appName,
      copyright: profile.copyright ?? "",
      category: profile.category ?? "Productivity",
      shortDescription: profile.shortDescription ?? "",
      longDescription: profile.shortDescription ?? "",
      icon: [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/128x128@2x.png",
        "icons/icon.icns",
        "icons/icon.ico",
      ],
      windows: {
        nsis: {
          installMode: "currentUser",
        },
      },
      macOS: {
        minimumSystemVersion: profile.macos?.minimumSystemVersion ?? "10.15",
        // Camera + microphone for a hardened-runtime (signed) build; see
        // src-tauri/Entitlements.plist and src/media.rs.
        entitlements: "./Entitlements.plist",
      },
      linux: {
        deb: { depends: [] },
      },
    },
    plugins: {
      "deep-link": {
        desktop: {
          schemes: [profile.deepLinkScheme],
        },
        // Plain custom-scheme deep link (`<scheme>://...`), not a verified
        // Android App Link / iOS Universal Link — the latter needs the site to
        // host .well-known/assetlinks.json + apple-app-site-association, which
        // is unnecessary complexity for a login handoff scheme that's never
        // shown to the user as a clickable web link.
        mobile: [
          {
            scheme: [profile.deepLinkScheme],
            appLink: false,
          },
        ],
      },
    },
  };

  // Desktop auto-update (src-tauri/src/updater.rs). Only a profile with an
  // updater public key gets it: `createUpdaterArtifacts` makes every bundle
  // build demand TAURI_SIGNING_PRIVATE_KEY, and without the key there is
  // nothing an installed app could verify an update against. An empty
  // `pubkey` therefore means "no updater yet", not a misconfiguration.
  const updater = profile.updater;
  if (updater?.pubkey) {
    if (!Array.isArray(updater.endpoints) || updater.endpoints.length === 0) {
      throw new Error(`profiles/${profileName}.json: "updater" needs at least one entry in "endpoints"`);
    }
    for (const endpoint of updater.endpoints) {
      if (!endpoint.startsWith("https://")) {
        throw new Error(`profiles/${profileName}.json: updater endpoint "${endpoint}" must be https://`);
      }
    }
    if (!updater.endpoints.some((endpoint) => endpoint.includes(`/releases/download/${release.updateFeedTag}/`))) {
      warn(
        `[native-wrapper] profiles/${profileName}.json: no updater endpoint points at the ` +
          `"${release.updateFeedTag}" release that native-wrapper-updates.yml publishes`,
      );
    }
    tauriConf.bundle.createUpdaterArtifacts = true;
    tauriConf.plugins.updater = {
      pubkey: updater.pubkey,
      endpoints: updater.endpoints,
      // NSIS (the currentUser installer above) runs passively: a progress bar,
      // no questions, then the app starts again.
      windows: { installMode: "passive" },
    };
  } else if (updater) {
    warn(`[native-wrapper] profiles/${profileName}.json has no updater "pubkey" yet; auto-update is off`);
  }

  if (profile.android) {
    tauriConf.bundle.android = {
      minSdkVersion: profile.android.minSdkVersion ?? 24,
    };
  }

  if (profile.ios) {
    tauriConf.bundle.iOS = {
      minimumSystemVersion: profile.ios.minimumSystemVersion ?? "14.0",
    };
  }

  return tauriConf;
}

/**
 * src-tauri/src/generated_scheme.rs. The custom URL scheme also needs to be
 * registered on the Rust side for platforms where tauri.conf.json's
 * plugins.deep-link block isn't enough on its own (Android intent-filters /
 * iOS URL types are generated from it by `tauri android init` / `tauri ios
 * init`, but the desktop single-instance argv parser in src-tauri/src/lib.rs
 * matches on scheme too) — written to a small generated Rust const so the two
 * never drift apart.
 */
export function generatedSchemeRust(profile, profileName, { sources, defaultSource }) {
  return (
    `// Generated by scripts/configure.mjs from profiles/${profileName}.json. Do not edit by hand.\n` +
    `pub const APP_NAME: &str = ${JSON.stringify(profile.appName)};\n` +
    `pub const DEEP_LINK_SCHEME: &str = "${profile.deepLinkScheme}";\n` +
    `pub const APP_URL: &str = "${profile.url}";\n` +
    `/// (id, label, url) for each place the app can load from; see app_source.rs.\n` +
    `pub const SOURCES: &[(&str, &str, &str)] = &[\n` +
    sources.map((s) => `    (${JSON.stringify(s.id)}, ${JSON.stringify(s.label)}, ${JSON.stringify(s.url)}),\n`).join("") +
    `];\n` +
    `pub const DEFAULT_SOURCE: &str = ${JSON.stringify(defaultSource)};\n`
  );
}

const xmlEscape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * src-tauri/Info.plist. macOS: WKWebView leaves `navigator.mediaDevices`
 * undefined, and the OS refuses the camera outright, unless the app's
 * Info.plist says why it wants the camera and microphone. Tauri merges this
 * file into the bundle (and into `tauri dev` builds).
 */
export function infoPlist(profile, profileName) {
  const media = {
    camera: profile.mediaUsage?.camera ?? `${profile.appName} uses the camera for video in live rounds.`,
    microphone:
      profile.mediaUsage?.microphone ?? `${profile.appName} uses the microphone for live rounds and speech recording.`,
  };
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n` +
    `<!-- Generated by scripts/configure.mjs from profiles/${profileName}.json. Do not edit by hand. -->\n` +
    `<plist version="1.0">\n<dict>\n` +
    `  <key>NSCameraUsageDescription</key>\n  <string>${xmlEscape(media.camera)}</string>\n` +
    `  <key>NSMicrophoneUsageDescription</key>\n  <string>${xmlEscape(media.microphone)}</string>\n` +
    `</dict>\n</plist>\n`
  );
}

/**
 * dist/splash-config.js. The launch splash in dist/index.html hands off to the
 * chosen source once its video ends, and dist/settings.html lists the
 * sources; both read them from this generated script (outside the app, where
 * there is no Rust side to ask, it is all they have).
 */
export function splashConfig(profile, profileName, { sources, defaultSource }) {
  return (
    `// Generated by scripts/configure.mjs from profiles/${profileName}.json. Do not edit by hand.\n` +
    `window.__WRAPPER_APP_NAME__ = ${JSON.stringify(profile.appName)};\n` +
    `window.__WRAPPER_APP_URL__ = ${JSON.stringify(profile.url)};\n` +
    `window.__WRAPPER_SOURCES__ = ${JSON.stringify(sources)};\n` +
    `window.__WRAPPER_DEFAULT_SOURCE__ = ${JSON.stringify(defaultSource)};\n`
  );
}

/**
 * src-tauri/capabilities/remote.json: the origins the wrapped site may call
 * the scoped Tauri IPC bridge from. Tauri reads capabilities from static
 * files, so this one is generated too.
 */
export function remoteCapability(profile, profileName) {
  const trustedOrigins = profile.trustedOrigins ?? [new URL(profile.url).origin];
  for (const origin of trustedOrigins) {
    if (!/^https:\/\/[^/]+$/.test(origin)) {
      throw new Error(`profiles/${profileName}.json: trustedOrigins entry "${origin}" must be an https:// origin with no path`);
    }
  }
  return {
    $schema: "../gen/schemas/remote-schema.json",
    identifier: "remote",
    description:
      `Generated by scripts/configure.mjs from profiles/${profileName}.json's trustedOrigins; do not edit by hand. ` +
      "Scoped IPC access for the wrapped site itself: opening the system browser for the Google OAuth handoff, " +
      "reading the host description its About system panel renders, and popping a page out into the always-on-top " +
      "mini player window (which gets the same scope). Nothing else is exposed to remote content.",
    windows: ["main", "mini-player"],
    remote: { urls: trustedOrigins.map((origin) => `${origin}/*`) },
    permissions: [
      "opener:allow-open-url",
      "allow-system-info",
      "allow-quick-launch",
      "allow-app-source",
      "allow-mini-player",
    ],
  };
}

/**
 * Every file configure.mjs writes, keyed by its path relative to the package
 * root, as the exact text to write. Throws on an invalid profile before
 * producing anything, so a bad profile never leaves half the files updated.
 */
export function generateWrapperFiles(profile, profileName, { readWorkflow, warn } = {}) {
  const resolved = resolveProfile(profile, profileName, { readWorkflow });
  const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
  return {
    "src-tauri/tauri.conf.json": json(tauriConfig(profile, profileName, resolved, warn)),
    "src-tauri/src/generated_scheme.rs": generatedSchemeRust(profile, profileName, resolved),
    "src-tauri/Info.plist": infoPlist(profile, profileName),
    "dist/splash-config.js": splashConfig(profile, profileName, resolved),
    "src-tauri/capabilities/remote.json": json(remoteCapability(profile, profileName)),
  };
}
