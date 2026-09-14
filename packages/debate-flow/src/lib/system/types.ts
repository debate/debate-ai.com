/**
 * The wire shape of the native wrapper's `system_info` command — the
 * TypeScript mirror of `SystemInfo` in
 * `apps/debate-native-wrapper/src-tauri/src/system_info.rs`. Change one and
 * the other has to follow.
 *
 * Every field is best-effort: the Rust side never fails the call, it returns
 * blanks for what the platform won't say, so treat empty strings and nulls as
 * "not knowable here" rather than as an error.
 */
export interface SystemInfo {
    /** Rust's `std::env::consts::OS`: "linux" | "windows" | "macos" | "android" | "ios" | a BSD. */
    os: string;
    /** Prose, as specific as the platform allows: "Ubuntu 24.04.1 LTS", "Windows 11 Pro 24H2 (build 26100.2314)". */
    osName: string;
    /** The version alone, when one can be isolated. */
    osVersion: string;
    /** Rust's `std::env::consts::ARCH`: "x86_64", "aarch64", ... */
    arch: string;
    /** Rust's `std::env::consts::FAMILY`: "unix" | "windows". */
    family: string;
    /** Kernel release: "6.8.0-45-generic", "24.1.0", "10.0.26100.2314". */
    kernel: string;
    /** Linux only: os-release `ID` ("ubuntu", "fedora", "arch"). */
    distroId: string | null;
    /** Linux only: os-release `ID_LIKE`, the distro's declared ancestry. */
    distroLike: string[];
    /** How this copy was installed — "deb", "rpm", "appimage", "flatpak", ... See the Rust doc comment for the full list and why it's a guess. */
    packaging: string;
    /** Linux only: "wayland" | "x11" | "unknown". */
    session: string | null;
    /** Linux only: `XDG_CURRENT_DESKTOP`. */
    desktop: string | null;
    /** The wrapper's own version, from tauri.conf.json. */
    appVersion: string;
}
