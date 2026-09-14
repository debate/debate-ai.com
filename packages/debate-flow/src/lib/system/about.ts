/**
 * What the "About system" panel shows, and how it is worked out on each of the
 * two hosts this app runs on.
 *
 * On the desktop wrapper the answer comes from Rust (`system_info`), which can
 * read /etc/os-release, the Windows registry and `sw_vers` — things a webview
 * cannot see. In a browser tab there is no such command, so the same fields
 * are reconstructed from the user agent string, which is vaguer (browsers
 * freeze the Windows and macOS versions they report) but never wrong about the
 * engine. Either way the panel renders one shape, and `formatReport` turns it
 * into the block a bug reporter pastes into an issue.
 *
 * The parsing here is deliberately pure and string-in/string-out so it can be
 * tested against real user agents without a DOM — see
 * `test/about-system.test.ts`.
 */

import { getCurrentVersion, invokeSystemInfo, isDesktop } from "../update/adapter";

import type { SystemInfo } from "./types";

/** Rust's `std::env::consts::OS` names, spelled the way people say them. */
export const OS_LABELS: Record<string, string> = {
    macos: "macOS",
    windows: "Windows",
    linux: "Linux",
    android: "Android",
    ios: "iOS",
    freebsd: "FreeBSD",
    openbsd: "OpenBSD",
    netbsd: "NetBSD",
};

/** Likewise for `std::env::consts::ARCH`, which nobody says out loud. */
export const ARCH_LABELS: Record<string, string> = {
    aarch64: "arm64",
    arm64: "arm64",
    x86_64: "x86-64",
    x86: "x86",
    i686: "x86",
    arm: "arm32",
};

/** The panel's view of the machine, from either host. */
export interface AboutSystem {
    /** Which host produced this: the native shell, or a browser tab. */
    runtime: "desktop" | "web";
    /** Canonical OS id to branch on. */
    os: string;
    /** The OS in prose, as specific as this host can be. */
    osLabel: string;
    /** Display architecture ("arm64", "x86-64"), or null when unknowable. */
    arch: string | null;
    /** Kernel release, desktop only. */
    kernel: string | null;
    /** Linux distro id, desktop only. */
    distro: string | null;
    /** Install format, desktop only. */
    packaging: string | null;
    /** Display server, Linux desktop only. */
    session: string | null;
    /** Desktop environment, Linux desktop only. */
    desktop: string | null;
    /** The native app's version, desktop only. */
    appVersion: string | null;
    /** Rendering engine and its version, from the user agent. */
    engine: string;
    /** The raw user agent, kept verbatim for the copied report. */
    userAgent: string;
}

/** Reads a capture group as a version, ignoring a non-match. */
function match(userAgent: string, pattern: RegExp): string | null {
    return pattern.exec(userAgent)?.[1] ?? null;
}

/**
 * Names the rendering engine behind the current page. This is the one field
 * worth having on both hosts: each platform's webview is a *different* engine
 * (WebView2 on Windows, WKWebView on macOS/iOS, WebKitGTK on Linux), and which
 * one is running explains most rendering bugs that reproduce on one OS only.
 *
 * Order matters. Edge announces itself as Chrome too, so `Edg/` is checked
 * first; and every WebKit-family agent contains "AppleWebKit", so the Chromium
 * and Gecko checks come before it.
 */
export function describeEngine(userAgent: string, os?: string): string {
    const edge = match(userAgent, /Edg(?:e|A|iOS)?\/([\d.]+)/);
    if (edge) {
        const chromium = match(userAgent, /Chrome\/([\d.]+)/);
        // A Tauri window on Windows is WebView2, which is Edge's engine
        // shipped as a control — the same UA, so the OS is what separates
        // "the app's webview" from "the user's Edge tab".
        const name = os === "windows" ? "WebView2" : "Edge";
        return chromium ? `${name} (Chromium ${chromium})` : `${name} ${edge}`;
    }
    const firefox = match(userAgent, /Firefox\/([\d.]+)/);
    if (firefox) return `Gecko (Firefox ${firefox})`;
    const chromium = match(userAgent, /(?:Chrome|Chromium)\/([\d.]+)/);
    if (chromium) return `Blink (Chromium ${chromium})`;
    const webkit = match(userAgent, /AppleWebKit\/([\d.]+)/);
    if (webkit) {
        if (os === "linux") return `WebKitGTK (AppleWebKit ${webkit})`;
        if (os === "macos" || os === "ios") return `WKWebView (AppleWebKit ${webkit})`;
        const safari = match(userAgent, /Version\/([\d.]+)/);
        return safari ? `WebKit (Safari ${safari})` : `WebKit ${webkit}`;
    }
    return "Unknown";
}

/**
 * Best-effort OS from a user agent, for the browser host. Much vaguer than the
 * native path on purpose — not a gap to close: Windows has reported "NT 10.0"
 * since Windows 10 and Safari has reported "10_15_7" since Catalina, both
 * frozen deliberately to stop sites sniffing them. Saying "Windows 10 or 11"
 * is the honest reading of what the browser actually said.
 */
export function osFromUserAgent(userAgent: string): { os: string; label: string } {
    const android = match(userAgent, /Android ([\d.]+)/);
    if (android) return { os: "android", label: `Android ${android}` };
    if (/CrOS/.test(userAgent)) return { os: "linux", label: "ChromeOS" };
    if (/iPhone|iPad|iPod/.test(userAgent)) {
        const version = match(userAgent, /OS ([\d_]+)/)?.replace(/_/g, ".");
        return { os: "ios", label: version ? `iOS ${version}` : "iOS" };
    }
    const windows = match(userAgent, /Windows NT ([\d.]+)/);
    if (windows) {
        // Every Windows since 10 reports NT 10.0 and stops there, so this is
        // as far as a browser can be pinned down.
        const named: Record<string, string> = {
            "10.0": "Windows 10 or 11",
            "6.3": "Windows 8.1",
            "6.2": "Windows 8",
            "6.1": "Windows 7",
        };
        return { os: "windows", label: named[windows] ?? `Windows NT ${windows}` };
    }
    if (/Mac OS X/.test(userAgent)) {
        const version = match(userAgent, /Mac OS X ([\d_.]+)/)?.replace(/_/g, ".");
        // Safari pins this at 10.15.7 on every newer macOS; reporting that
        // number as fact would be a lie, so it is shown only as a floor.
        const frozen = version === "10.15.7" || version === "10.15";
        return { os: "macos", label: frozen ? "macOS 10.15 or newer" : `macOS ${version ?? ""}`.trim() };
    }
    if (/Linux|X11/.test(userAgent)) return { os: "linux", label: "Linux" };
    return { os: "unknown", label: "Unknown" };
}

/**
 * Architecture from a user agent. Browsers say much less here than Rust does —
 * a 64-bit ARM Windows browser often still claims x64 for compatibility — so
 * this is only ever used on the web host, where nothing better exists.
 */
export function archFromUserAgent(userAgent: string): string | null {
    if (/aarch64|arm64/i.test(userAgent)) return "arm64";
    if (/x86_64|Win64|WOW64|x64/i.test(userAgent)) return "x86-64";
    if (/armv7|armv8|\barm\b/i.test(userAgent)) return "arm32";
    if (/i[36]86/.test(userAgent)) return "x86";
    return null;
}

/** Drops blanks, so the panel never renders a row with nothing in it. */
function clean(value: string | null | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}

/** The native host's answer, from `system_info` plus the webview's own UA. */
export function fromSystemInfo(info: SystemInfo, userAgent: string): AboutSystem {
    return {
        runtime: "desktop",
        os: info.os,
        osLabel: clean(info.osName) ?? OS_LABELS[info.os] ?? info.os,
        arch: ARCH_LABELS[info.arch] ?? clean(info.arch),
        kernel: clean(info.kernel),
        distro: clean(info.distroId),
        packaging: clean(info.packaging) === "unknown" ? null : clean(info.packaging),
        // "unknown" is what the Rust side says when no display server named
        // itself; there is nothing for the panel to show in that case.
        session: clean(info.session) === "unknown" ? null : clean(info.session),
        desktop: clean(info.desktop),
        appVersion: clean(info.appVersion),
        engine: describeEngine(userAgent, info.os),
        userAgent,
    };
}

/** The browser host's answer, reconstructed entirely from the user agent. */
export function fromUserAgent(userAgent: string): AboutSystem {
    const { os, label } = osFromUserAgent(userAgent);
    return {
        runtime: "web",
        os,
        osLabel: label,
        arch: archFromUserAgent(userAgent),
        kernel: null,
        distro: null,
        packaging: null,
        session: null,
        desktop: null,
        appVersion: null,
        engine: describeEngine(userAgent, os),
        userAgent,
    };
}

/** The rows the panel renders, in order, skipping what this host can't know. */
export function aboutRows(about: AboutSystem): { label: string; value: string }[] {
    const rows: [string, string | null][] = [
        ["Operating system", about.osLabel],
        ["Architecture", about.arch],
        ["Kernel", about.kernel],
        ["Distribution", about.distro],
        ["Desktop", about.desktop],
        ["Display server", about.session],
        ["Install format", about.packaging],
        ["Web engine", about.engine],
        ["App version", about.appVersion],
        ["Runtime", about.runtime === "desktop" ? "Desktop app" : "Browser"],
    ];
    return rows
        .filter((row): row is [string, string] => Boolean(row[1]))
        .map(([label, value]) => ({ label, value }));
}

/**
 * The plaintext block the Copy button puts on the clipboard. The user agent
 * goes last and in full: it is the longest line and the one a maintainer reads
 * only when the summarized rows above it don't explain the bug.
 */
export function formatReport(about: AboutSystem): string {
    const rows = aboutRows(about);
    const width = Math.max(...rows.map((row) => row.label.length));
    const lines = rows.map((row) => `${row.label.padEnd(width)}  ${row.value}`);
    return [...lines, `${"User agent".padEnd(width)}  ${about.userAgent}`].join("\n");
}

/**
 * Reads the host description. Falls back to the user-agent reconstruction
 * whenever the native command isn't there to answer — on the web, and also on
 * a desktop build older than the one that added `system_info`, which is why
 * the fallback isn't gated on `isDesktop()` alone.
 */
export async function getAboutSystem(): Promise<AboutSystem> {
    const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent;
    const info = await invokeSystemInfo();
    if (info) return fromSystemInfo(info, userAgent);

    const about = fromUserAgent(userAgent);
    if (!isDesktop()) return about;
    // An older shell still knows its own version even without `system_info`.
    return { ...about, runtime: "desktop", appVersion: clean(await getCurrentVersion()) };
}
