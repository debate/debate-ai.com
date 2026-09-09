/**
 * The parsing behind the About system panel. Everything here is a pure
 * function of a user agent string or a `system_info` payload, so the cases are
 * real agents copied from the platforms they came from — the point of the
 * exercise is that the *frozen* versions browsers report (Windows NT 10.0,
 * macOS 10.15.7) are read as the floors they are, not as facts.
 */

import { describe, expect, it } from "vitest";

import {
    aboutRows,
    archFromUserAgent,
    describeEngine,
    formatReport,
    fromSystemInfo,
    fromUserAgent,
    osFromUserAgent,
} from "../src/lib/system/about";
import type { SystemInfo } from "../src/lib/system/types";

const AGENTS = {
    webkitGtk:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    webView2:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
    wkWebView:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15",
    chrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    firefox: "Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0",
    android:
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
    iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1",
};

const UBUNTU: SystemInfo = {
    os: "linux",
    osName: "Ubuntu 24.04.1 LTS",
    osVersion: "24.04",
    arch: "x86_64",
    family: "unix",
    kernel: "6.8.0-45-generic",
    distroId: "ubuntu",
    distroLike: ["debian"],
    packaging: "deb",
    session: "wayland",
    desktop: "GNOME",
    appVersion: "1.0.0",
};

describe("describeEngine", () => {
    it("names each platform's webview rather than the browser it resembles", () => {
        expect(describeEngine(AGENTS.webView2, "windows")).toBe("WebView2 (Chromium 130.0.0.0)");
        expect(describeEngine(AGENTS.wkWebView, "macos")).toBe("WKWebView (AppleWebKit 605.1.15)");
        expect(describeEngine(AGENTS.webkitGtk, "linux")).toBe("WebKitGTK (AppleWebKit 605.1.15)");
    });

    it("checks Edge before Chrome, which its agent also claims to be", () => {
        expect(describeEngine(AGENTS.webView2)).toBe("Edge (Chromium 130.0.0.0)");
    });

    it("reads plain browsers too, for the web host", () => {
        expect(describeEngine(AGENTS.chrome)).toBe("Blink (Chromium 131.0.0.0)");
        expect(describeEngine(AGENTS.firefox)).toBe("Gecko (Firefox 132.0)");
        expect(describeEngine(AGENTS.wkWebView)).toBe("WebKit (Safari 17.6)");
    });

    it("says so rather than guessing when nothing matches", () => {
        expect(describeEngine("curl/8.7.1")).toBe("Unknown");
        expect(describeEngine("")).toBe("Unknown");
    });
});

describe("osFromUserAgent", () => {
    it("reports the frozen Windows and macOS versions as floors, not facts", () => {
        expect(osFromUserAgent(AGENTS.chrome)).toEqual({
            os: "windows",
            label: "Windows 10 or 11",
        });
        expect(osFromUserAgent(AGENTS.wkWebView)).toEqual({
            os: "macos",
            label: "macOS 10.15 or newer",
        });
    });

    it("still pins the versions mobile agents do report", () => {
        expect(osFromUserAgent(AGENTS.android)).toEqual({ os: "android", label: "Android 14" });
        expect(osFromUserAgent(AGENTS.iphone)).toEqual({ os: "ios", label: "iOS 17.6.1" });
    });

    it("checks Android before Linux, which its agent also says", () => {
        expect(osFromUserAgent(AGENTS.android).os).toBe("android");
        expect(osFromUserAgent(AGENTS.firefox).os).toBe("linux");
    });

    it("falls back to unknown rather than a wrong guess", () => {
        expect(osFromUserAgent("curl/8.7.1")).toEqual({ os: "unknown", label: "Unknown" });
    });
});

describe("archFromUserAgent", () => {
    it("reads the arch when the agent carries one", () => {
        expect(archFromUserAgent(AGENTS.chrome)).toBe("x86-64");
        expect(archFromUserAgent("Mozilla/5.0 (X11; Linux aarch64)")).toBe("arm64");
    });

    it("returns null rather than inventing one", () => {
        expect(archFromUserAgent(AGENTS.iphone)).toBeNull();
    });
});

describe("fromSystemInfo", () => {
    it("keeps the native OS name, which is more specific than any agent", () => {
        const about = fromSystemInfo(UBUNTU, AGENTS.webkitGtk);
        expect(about.runtime).toBe("desktop");
        expect(about.osLabel).toBe("Ubuntu 24.04.1 LTS");
        expect(about.arch).toBe("x86-64");
        expect(about.distro).toBe("ubuntu");
        expect(about.packaging).toBe("deb");
        expect(about.engine).toBe("WebKitGTK (AppleWebKit 605.1.15)");
    });

    it("drops the Rust side's 'unknown' placeholders instead of showing them", () => {
        const about = fromSystemInfo(
            { ...UBUNTU, packaging: "unknown", session: "unknown", desktop: null },
            AGENTS.webkitGtk,
        );
        expect(about.packaging).toBeNull();
        expect(about.session).toBeNull();
        expect(aboutRows(about).map((row) => row.label)).not.toContain("Display server");
    });

    it("falls back to the OS id when the platform named nothing", () => {
        const about = fromSystemInfo({ ...UBUNTU, os: "freebsd", osName: "  " }, AGENTS.webkitGtk);
        expect(about.osLabel).toBe("FreeBSD");
    });
});

describe("fromUserAgent", () => {
    it("leaves the fields only the native side can know as null", () => {
        const about = fromUserAgent(AGENTS.chrome);
        expect(about.runtime).toBe("web");
        expect(about.kernel).toBeNull();
        expect(about.distro).toBeNull();
        expect(about.appVersion).toBeNull();
        expect(aboutRows(about).map((row) => row.label)).toEqual([
            "Operating system",
            "Architecture",
            "Web engine",
            "Runtime",
        ]);
    });
});

describe("formatReport", () => {
    it("aligns every row and ends with the full user agent", () => {
        const about = fromSystemInfo(UBUNTU, AGENTS.webkitGtk);
        const lines = formatReport(about).split("\n");
        expect(lines[0]).toBe("Operating system  Ubuntu 24.04.1 LTS");
        expect(lines.at(-1)).toBe(`User agent        ${AGENTS.webkitGtk}`);
        expect(lines).toHaveLength(aboutRows(about).length + 1);
        // One column: every value starts at the same offset, set by the
        // longest label ("Operating system") plus a two-space gutter.
        const width = "Operating system".length;
        for (const line of lines) {
            expect(line.slice(width, width + 2)).toBe("  ");
            expect(line.slice(width + 2)).toMatch(/^\S/);
        }
    });
});
