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

  // The loopback port of the desktop bridge (src-tauri/src/desktop_bridge.rs),
  // which lets the site in an ordinary browser reach the running app. 0 = off.
  const desktopBridgePort = profile.desktopBridgePort ?? 0;
  if (!Number.isInteger(desktopBridgePort) || desktopBridgePort < 0 || desktopBridgePort > 65535 || (desktopBridgePort > 0 && desktopBridgePort < 1024)) {
    throw new Error(`profiles/${profileName}.json: "desktopBridgePort" must be 0 (off) or a port from 1024 to 65535`);
  }

  return { sources, defaultSource, release, win, desktopBridgePort };
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
          // The bundled launch splash (dist/index.html), which
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
        // desktop-updater carries the permissions of desktop-only plugins
        // (updater, process); its `platforms` field keeps it off Android/iOS,
        // where those plugins are not compiled in and the build would fail
        // with "Permission updater:default not found".
        capabilities: ["default", "desktop-updater", "remote"],
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
export function generatedSchemeRust(profile, profileName, { sources, defaultSource, desktopBridgePort = 0 }) {
  return (
    `// Generated by scripts/configure.mjs from profiles/${profileName}.json. Do not edit by hand.\n` +
    `pub const APP_NAME: &str = ${JSON.stringify(profile.appName)};\n` +
    `pub const DEEP_LINK_SCHEME: &str = "${profile.deepLinkScheme}";\n` +
    `pub const APP_URL: &str = "${profile.url}";\n` +
    `/// (id, label, url) for each place the app can load from; see app_source.rs.\n` +
    `pub const SOURCES: &[(&str, &str, &str)] = &[\n` +
    sources.map((s) => `    (${JSON.stringify(s.id)}, ${JSON.stringify(s.label)}, ${JSON.stringify(s.url)}),\n`).join("") +
    `];\n` +
    `pub const DEFAULT_SOURCE: &str = ${JSON.stringify(defaultSource)};\n` +
    `/// Loopback port of the desktop bridge (desktop_bridge.rs); 0 leaves it off.\n` +
    `pub const DESKTOP_BRIDGE_PORT: u16 = ${desktopBridgePort};\n`
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
 * The Flatpak build's settings (docs/FLATPAK.md), or `null` when the profile
 * has no `flatpak` block. The Flatpak is not built by the Tauri bundler: it
 * repackages the Linux `.deb` (binary, desktop file, icons) on top of the
 * GNOME runtime, which already carries WebKitGTK.
 */
export function flatpakSettings(profile, profileName) {
  const flatpak = profile.flatpak;
  if (!flatpak) return null;
  const appId = flatpak.appId ?? profile.identifier;
  // Flatpak ids: reverse DNS, 3+ parts, each a letter/underscore then
  // letters, digits, underscores (dashes only allowed, and discouraged, in
  // the last part).
  const parts = appId.split(".");
  if (parts.length < 3 || !parts.every((part, i) => (i === parts.length - 1 ? /^[A-Za-z_][\w-]*$/ : /^[A-Za-z_]\w*$/).test(part))) {
    throw new Error(`profiles/${profileName}.json: flatpak.appId "${appId}" must be a reverse-DNS id with at least three parts`);
  }
  const productName = profile.productName ?? profile.appName;
  const command = flatpak.command ?? productName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!/^[a-z0-9][a-z0-9-]*$/.test(command)) {
    throw new Error(`profiles/${profileName}.json: flatpak.command "${command}" must be lowercase letters, digits and dashes`);
  }
  if (flatpak.releaseDate != null && !/^\d{4}-\d{2}-\d{2}$/.test(flatpak.releaseDate)) {
    throw new Error(`profiles/${profileName}.json: flatpak.releaseDate must be YYYY-MM-DD`);
  }
  const description = flatpak.description ?? [profile.shortDescription ?? productName];
  return {
    appId,
    command,
    name: productName,
    runtimeVersion: String(flatpak.runtimeVersion ?? "51"),
    summary: flatpak.summary ?? profile.shortDescription ?? productName,
    description: Array.isArray(description) ? description : [description],
    developerId: flatpak.developerId ?? parts.slice(0, 2).join("."),
    developerName: flatpak.developerName ?? profile.copyright ?? productName,
    homepage: flatpak.homepage ?? profile.url,
    urls: flatpak.urls ?? {},
    projectLicense: flatpak.projectLicense ?? "LicenseRef-proprietary",
    categories: flatpak.categories ?? [],
    keywords: flatpak.keywords ?? [],
    screenshots: flatpak.screenshots ?? [],
    releaseDate: flatpak.releaseDate ?? null,
    contentRating: flatpak.contentRating ?? {},
    finishArgs: flatpak.finishArgs ?? [
      "--share=ipc",
      "--socket=wayland",
      "--socket=fallback-x11",
      "--device=dri",
      "--share=network",
    ],
  };
}

/**
 * flatpak/<appId>.yml: the flatpak-builder manifest. Its one module unpacks
 * `app.deb` (copied next to it by scripts/build-flatpak.sh, or swapped for
 * the release URL + sha256 in the Flathub copy) and installs the Tauri
 * binary, any bundled resources, the desktop file and every icon size under
 * the Flatpak id. Only the program in the desktop file's `Exec=` is
 * replaced, so its arguments (`%u` for the deep link) survive.
 */
export function flatpakManifest(profile, profileName, fp) {
  const id = fp.appId;
  return [
    `# Generated by scripts/configure.mjs from profiles/${profileName}.json. Do not edit by hand.`,
    `# Built by scripts/build-flatpak.sh from the Tauri .deb; see docs/FLATPAK.md.`,
    `id: ${id}`,
    ``,
    `runtime: org.gnome.Platform`,
    `runtime-version: '${fp.runtimeVersion}'`,
    `sdk: org.gnome.Sdk`,
    ``,
    `command: ${fp.command}`,
    ``,
    `finish-args:`,
    ...fp.finishArgs.map((arg) => `  - ${arg}`),
    ``,
    `modules:`,
    `  - name: ${fp.command}`,
    `    buildsystem: simple`,
    ``,
    `    sources:`,
    `      - type: file`,
    `        path: app.deb`,
    ``,
    `      - type: file`,
    `        path: ${id}.metainfo.xml`,
    ``,
    `    build-commands:`,
    `      - ar x app.deb`,
    `      - mkdir -p extracted`,
    `      - tar -xf data.tar.* -C extracted`,
    ``,
    `      # The Tauri binary is the only file in usr/bin; install it under a fixed name.`,
    `      - |`,
    `        bin="$(find extracted/usr/bin -maxdepth 1 -type f | head -n 1)"`,
    `        test -n "$bin"`,
    `        install -Dm755 "$bin" /app/bin/${fp.command}`,
    ``,
    `      # Bundled resources (Tauri puts them in usr/lib/<product name>), if any.`,
    `      - |`,
    `        if [ -d extracted/usr/lib ]; then`,
    `          mkdir -p /app/lib`,
    `          cp -a extracted/usr/lib/. /app/lib/`,
    `        fi`,
    ``,
    `      - |`,
    `        desktop="$(find extracted/usr/share/applications -name '*.desktop' | head -n 1)"`,
    `        sed -E \\`,
    `          -e 's/^Exec=("[^"]*"|[^ ]+)/Exec=${fp.command}/' \\`,
    `          -e 's/^Icon=.*/Icon=${id}/' \\`,
    `          "$desktop" > ${id}.desktop`,
    `      - install -Dm644 ${id}.desktop /app/share/applications/${id}.desktop`,
    ``,
    `      # Every plain NxN icon size the .deb ships, renamed to the Flatpak id.`,
    `      - |`,
    `        for icon in extracted/usr/share/icons/hicolor/*/apps/*.png; do`,
    `          size="$(basename "$(dirname "$(dirname "$icon")")")"`,
    `          case "$size" in`,
    `            *[!0-9x]*) continue ;;`,
    `          esac`,
    `          install -Dm644 "$icon" "/app/share/icons/hicolor/$size/apps/${id}.png"`,
    `        done`,
    ``,
    `      - install -Dm644 ${id}.metainfo.xml /app/share/metainfo/${id}.metainfo.xml`,
    ``,
  ].join("\n");
}

/** flatpak/<appId>.metainfo.xml: the AppStream listing Flathub and software centers show. */
export function flatpakMetainfo(profile, profileName, fp) {
  const id = fp.appId;
  const x = xmlEscape;
  const lines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<!-- Generated by scripts/configure.mjs from profiles/${profileName}.json. Do not edit by hand. -->`,
    `<component type="desktop-application">`,
    `  <id>${x(id)}</id>`,
    ``,
    `  <name>${x(fp.name)}</name>`,
    `  <summary>${x(fp.summary)}</summary>`,
    ``,
    `  <metadata_license>CC0-1.0</metadata_license>`,
    `  <project_license>${x(fp.projectLicense)}</project_license>`,
    ``,
    `  <developer id="${x(fp.developerId)}">`,
    `    <name>${x(fp.developerName)}</name>`,
    `  </developer>`,
    ``,
    `  <description>`,
    ...fp.description.map((paragraph) => `    <p>${x(paragraph)}</p>`),
    `  </description>`,
    ``,
    `  <launchable type="desktop-id">${x(id)}.desktop</launchable>`,
    ``,
    `  <url type="homepage">${x(fp.homepage)}</url>`,
    ...Object.entries(fp.urls).map(([type, url]) => `  <url type="${x(type)}">${x(url)}</url>`),
  ];
  if (fp.categories.length) {
    lines.push(``, `  <categories>`, ...fp.categories.map((c) => `    <category>${x(c)}</category>`), `  </categories>`);
  }
  if (fp.keywords.length) {
    lines.push(``, `  <keywords>`, ...fp.keywords.map((k) => `    <keyword>${x(k)}</keyword>`), `  </keywords>`);
  }
  if (fp.screenshots.length) {
    lines.push(``, `  <screenshots>`);
    fp.screenshots.forEach((shot, i) => {
      const { url, caption } = typeof shot === "string" ? { url: shot } : shot;
      lines.push(`    <screenshot${i === 0 ? ` type="default"` : ""}>`);
      if (caption) lines.push(`      <caption>${x(caption)}</caption>`);
      lines.push(`      <image>${x(url)}</image>`, `    </screenshot>`);
    });
    lines.push(`  </screenshots>`);
  }
  if (fp.releaseDate) {
    lines.push(``, `  <releases>`, `    <release version="${x(profile.version)}" date="${fp.releaseDate}"/>`, `  </releases>`);
  }
  const ratings = Object.entries(fp.contentRating);
  lines.push(``);
  if (ratings.length) {
    lines.push(
      `  <content_rating type="oars-1.1">`,
      ...ratings.map(([attr, value]) => `    <content_attribute id="${x(attr)}">${x(value)}</content_attribute>`),
      `  </content_rating>`,
    );
  } else {
    lines.push(`  <content_rating type="oars-1.1"/>`);
  }
  lines.push(`</component>`, ``);
  return lines.join("\n");
}

/**
 * The Snap build's settings (docs/SNAP.md), or `null` when the profile has
 * no `snap` block. Like the Flatpak, the snap repackages the Linux `.deb`;
 * snapcraft's `gnome` extension supplies GTK and WebKitGTK.
 */
export function snapSettings(profile, profileName) {
  const snap = profile.snap;
  if (!snap) return null;
  const productName = profile.productName ?? profile.appName;
  const name = snap.name ?? productName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  // Store rules: lowercase letters, digits and single dashes, 2-40 chars, at least one letter.
  if (!/^(?=.*[a-z])[a-z0-9]+(-[a-z0-9]+)*$/.test(name) || name.length < 2 || name.length > 40) {
    throw new Error(`profiles/${profileName}.json: snap.name "${name}" must be 2-40 lowercase letters, digits and single dashes`);
  }
  const summary = snap.summary ?? profile.flatpak?.summary ?? profile.shortDescription ?? productName;
  if (summary.length > 78) {
    throw new Error(`profiles/${profileName}.json: snap.summary must be at most 78 characters`);
  }
  const description = snap.description ?? profile.flatpak?.description ?? [profile.shortDescription ?? productName];
  return {
    name,
    title: productName,
    summary,
    description: Array.isArray(description) ? description : [description],
    license: snap.license ?? "Proprietary",
    website: snap.website ?? profile.flatpak?.homepage ?? profile.url,
    contact: snap.contact ?? null,
    grade: snap.grade ?? "stable",
    base: snap.base ?? "core24",
    storeChannel: snap.storeChannel ?? "stable",
    stagePackages: snap.stagePackages ?? ["libayatana-appindicator3-1", "libxdo3"],
    plugs: snap.plugs ?? ["network", "network-bind"],
  };
}

/**
 * snapcraft/snapcraft.yaml: unpacks `app.deb` (copied next to it by
 * scripts/build-snap.sh) into the snap, installs the binary under the snap's
 * name, and rewrites the desktop file the way snapd wants it (Exec = the
 * app, Icon = a path inside $SNAP), keeping the Exec arguments (`%u`).
 */
export function snapcraftYaml(profile, profileName, sn) {
  const q = (text) => JSON.stringify(text);
  return [
    `# Generated by scripts/configure.mjs from profiles/${profileName}.json. Do not edit by hand.`,
    `# Built by scripts/build-snap.sh from the Tauri .deb; see docs/SNAP.md.`,
    `name: ${sn.name}`,
    `title: ${q(sn.title)}`,
    `version: ${q(profile.version)}`,
    `summary: ${q(sn.summary)}`,
    `description: |`,
    ...sn.description.flatMap((paragraph, i) => (i ? ["", `  ${paragraph}`] : [`  ${paragraph}`])),
    `license: ${q(sn.license)}`,
    `website: ${q(sn.website)}`,
    ...(sn.contact ? [`contact: ${q(sn.contact)}`] : []),
    `base: ${sn.base}`,
    `grade: ${sn.grade}`,
    `confinement: strict`,
    `platforms:`,
    `  amd64:`,
    ``,
    `parts:`,
    `  ${sn.name}:`,
    `    plugin: nil`,
    `    source: .`,
    `    stage-packages:`,
    ...sn.stagePackages.map((pkg) => `      - ${pkg}`),
    `    override-build: |`,
    `      dpkg-deb -x "$CRAFT_PART_SRC/app.deb" "$CRAFT_PART_INSTALL"`,
    `      cd "$CRAFT_PART_INSTALL"`,
    `      # The Tauri binary is the only file in usr/bin; give it the snap's name.`,
    `      bin="$(find usr/bin -maxdepth 1 -type f | head -n 1)"`,
    `      test -n "$bin"`,
    `      [ "$bin" = usr/bin/${sn.name} ] || mv "$bin" usr/bin/${sn.name}`,
    `      desktop="$(find usr/share/applications -name '*.desktop' | head -n 1)"`,
    `      icon="$(ls usr/share/icons/hicolor/128x128/apps/*.png | head -n 1)"`,
    `      sed -E \\`,
    `        -e 's/^Exec=("[^"]*"|[^ ]+)/Exec=${sn.name}/' \\`,
    `        -e "s|^Icon=.*|Icon=\\\${SNAP}/$icon|" \\`,
    `        "$desktop" > /tmp/${sn.name}.desktop`,
    `      rm -f usr/share/applications/*.desktop`,
    `      mv /tmp/${sn.name}.desktop usr/share/applications/${sn.name}.desktop`,
    ``,
    `apps:`,
    `  ${sn.name}:`,
    `    command: usr/bin/${sn.name}`,
    `    desktop: usr/share/applications/${sn.name}.desktop`,
    `    extensions: [gnome]`,
    `    plugs:`,
    ...sn.plugs.map((plug) => `      - ${plug}`),
    ``,
  ].join("\n");
}

/**
 * Every file configure.mjs writes, keyed by its path relative to the package
 * root, as the exact text to write. Throws on an invalid profile before
 * producing anything, so a bad profile never leaves half the files updated.
 */
export function generateWrapperFiles(profile, profileName, { readWorkflow, warn } = {}) {
  const resolved = resolveProfile(profile, profileName, { readWorkflow });
  const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
  const files = {
    "src-tauri/tauri.conf.json": json(tauriConfig(profile, profileName, resolved, warn)),
    "src-tauri/src/generated_scheme.rs": generatedSchemeRust(profile, profileName, resolved),
    "src-tauri/Info.plist": infoPlist(profile, profileName),
    "dist/splash-config.js": splashConfig(profile, profileName, resolved),
    "src-tauri/capabilities/remote.json": json(remoteCapability(profile, profileName)),
  };
  const fp = flatpakSettings(profile, profileName);
  if (fp) {
    files[`flatpak/${fp.appId}.yml`] = flatpakManifest(profile, profileName, fp);
    files[`flatpak/${fp.appId}.metainfo.xml`] = flatpakMetainfo(profile, profileName, fp);
  }
  const sn = snapSettings(profile, profileName);
  if (sn) files["snapcraft/snapcraft.yaml"] = snapcraftYaml(profile, profileName, sn);
  return files;
}
