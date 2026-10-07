#!/usr/bin/env node
// Regenerates src-tauri/tauri.conf.json (and the Rust-side deep-link scheme it
// implies) from a JSON profile in profiles/. This is what makes the package
// generic: swap the profile, re-run this script, and the wrapper points at a
// different site with a different identity. Everything downstream (icons, CI,
// the OAuth handoff) reads the values this script writes, not the profile
// file directly, so there is exactly one place that understands the
// profile -> tauri.conf.json mapping.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const profileName = process.argv.includes("--profile")
  ? process.argv[process.argv.indexOf("--profile") + 1]
  : (process.env.WRAPPER_PROFILE ?? "debate-ai");

const profilePath = path.join(rootDir, "profiles", `${profileName}.json`);
const profile = JSON.parse(readFileSync(profilePath, "utf8"));

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

const win = {
  width: 1280,
  height: 800,
  minWidth: 480,
  minHeight: 480,
  fullscreen: false,
  resizable: true,
  ...profile.window,
};

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
        center: true,
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

const outPath = path.join(rootDir, "src-tauri", "tauri.conf.json");
writeFileSync(outPath, `${JSON.stringify(tauriConf, null, 2)}\n`, "utf8");

// The custom URL scheme also needs to be registered on the Rust side for
// platforms where tauri.conf.json's plugins.deep-link block isn't enough on
// its own (Android intent-filters / iOS URL types are generated from it by
// `tauri android init` / `tauri ios init`, but the desktop single-instance
// argv parser in src-tauri/src/lib.rs matches on scheme too) — write it to a
// small generated Rust const so the two never drift apart.
const schemeConstPath = path.join(rootDir, "src-tauri", "src", "generated_scheme.rs");
writeFileSync(
  schemeConstPath,
  `// Generated by scripts/configure.mjs from profiles/${profileName}.json. Do not edit by hand.\n` +
    `pub const DEEP_LINK_SCHEME: &str = "${profile.deepLinkScheme}";\n` +
    `pub const APP_URL: &str = "${profile.url}";\n` +
    `/// (id, label, url) for each place the app can load from; see app_source.rs.\n` +
    `pub const SOURCES: &[(&str, &str, &str)] = &[\n` +
    sources.map((s) => `    (${JSON.stringify(s.id)}, ${JSON.stringify(s.label)}, ${JSON.stringify(s.url)}),\n`).join("") +
    `];\n` +
    `pub const DEFAULT_SOURCE: &str = ${JSON.stringify(defaultSource)};\n`,
  "utf8",
);

// macOS: WKWebView leaves `navigator.mediaDevices` undefined, and the OS
// refuses the camera outright, unless the app's Info.plist says why it wants
// the camera and microphone. Tauri merges src-tauri/Info.plist into the
// bundle (and into `tauri dev` builds).
const xmlEscape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const media = {
  camera: profile.mediaUsage?.camera ?? `${profile.appName} uses the camera for video in live rounds.`,
  microphone:
    profile.mediaUsage?.microphone ?? `${profile.appName} uses the microphone for live rounds and speech recording.`,
};
const infoPlistPath = path.join(rootDir, "src-tauri", "Info.plist");
writeFileSync(
  infoPlistPath,
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n` +
    `<!-- Generated by scripts/configure.mjs from profiles/${profileName}.json. Do not edit by hand. -->\n` +
    `<plist version="1.0">\n<dict>\n` +
    `  <key>NSCameraUsageDescription</key>\n  <string>${xmlEscape(media.camera)}</string>\n` +
    `  <key>NSMicrophoneUsageDescription</key>\n  <string>${xmlEscape(media.microphone)}</string>\n` +
    `</dict>\n</plist>\n`,
  "utf8",
);

// The launch splash in dist/index.html hands off to the chosen source once
// its video ends, and dist/settings.html lists the sources; both read them
// from this generated script (outside the app, where there is no Rust side to
// ask, it is all they have).
const splashConfigPath = path.join(rootDir, "dist", "splash-config.js");
writeFileSync(
  splashConfigPath,
  `// Generated by scripts/configure.mjs from profiles/${profileName}.json. Do not edit by hand.\n` +
    `window.__WRAPPER_APP_URL__ = ${JSON.stringify(profile.url)};\n` +
    `window.__WRAPPER_SOURCES__ = ${JSON.stringify(sources)};\n` +
    `window.__WRAPPER_DEFAULT_SOURCE__ = ${JSON.stringify(defaultSource)};\n`,
  "utf8",
);

console.log(`[native-wrapper] configured for profile "${profileName}" (${profile.appName}, ${profile.url})`);
console.log(`  wrote ${path.relative(rootDir, outPath)}`);
console.log(`  wrote ${path.relative(rootDir, schemeConstPath)}`);
console.log(`  wrote ${path.relative(rootDir, splashConfigPath)}`);
console.log(`  wrote ${path.relative(rootDir, infoPlistPath)}`);
console.log(`  run "npm run icons" if ${profileName}'s iconSource changed`);
