// The one Rust-side command this wrapper exposes to the site it loads: a
// description of the machine the app is running on. The site renders it as its
// "About system" panel, and a bug reporter pastes it into an issue — so the
// bar is "specific enough to reproduce on", not "complete".
//
// Everything here comes out of files and environment variables the OS
// maintains anyway. `std::env::consts` gives os/arch/family for free at
// compile time; the rest is per-platform and deliberately dependency-free
// except for the Windows registry reader:
//
//   Linux    /etc/os-release (systemd's cross-distro standard), with a chain
//            of pre-os-release fallbacks so old and minimal distros still name
//            themselves, plus how this build was packaged (deb/rpm/AppImage/
//            Flatpak/Snap/...) and which display server it landed on.
//   macOS    `sw_vers`, falling back to SystemVersion.plist because a
//            sandboxed (Mac App Store) build may not spawn processes.
//   Windows  the CurrentVersion registry key, including the Windows 10-vs-11
//            correction Microsoft never made to `ProductName`.
//   BSD etc. `uname`.
//   Android  os/arch/kernel only — reading the Android release needs JNI, and
//   / iOS    a guess would be worse than an honest "unknown".
//
// Nothing here can fail into an error: a field we cannot read is empty or
// null, never a rejected promise, because a half-known machine description is
// still worth showing.

use serde::Serialize;

/// What the site's "About system" panel renders. Field names are camelCase on
/// the wire; see `packages/debate-flow/src/lib/system/types.ts` for the
/// TypeScript mirror of this struct.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    /// `std::env::consts::OS`: "linux", "windows", "macos", "android", "ios",
    /// "freebsd", ... The stable id to branch on; `os_name` is the prose.
    pub os: String,
    /// Human-readable OS, as specific as the platform will say: "Ubuntu 24.04.1
    /// LTS", "Windows 11 Pro 24H2 (build 26100.2314)", "macOS 15.1 Sequoia
    /// (24B83)". Never empty — falls back to `os`.
    pub os_name: String,
    /// Just the version, when one can be isolated from `os_name`.
    pub os_version: String,
    /// `std::env::consts::ARCH`: "x86_64", "aarch64", ...
    pub arch: String,
    /// `std::env::consts::FAMILY`: "unix" or "windows".
    pub family: String,
    /// Kernel release: "6.8.0-45-generic", "24.1.0", "10.0.26100.2314".
    pub kernel: String,
    /// Linux only: os-release `ID` ("ubuntu", "fedora", "arch"). Null elsewhere.
    pub distro_id: Option<String>,
    /// Linux only: os-release `ID_LIKE`, the distro's declared ancestry. This
    /// is what lets one arm of `packaging` cover a derivative nobody has heard
    /// of — Pop!_OS says `ID_LIKE=ubuntu debian`, so it gets "deb" for free.
    pub distro_like: Vec<String>,
    /// Best guess at how this copy was installed: "deb", "rpm", "pacman",
    /// "apk", "portage", "xbps", "nix", "eopkg", "appimage", "flatpak",
    /// "snap", "app-bundle", "windows-installer", or "unknown". A guess, not a
    /// receipt: outside the relocatable formats (which announce themselves) it
    /// is inferred from the distro, so a hand-extracted tarball on Fedora
    /// still reports "rpm".
    pub packaging: String,
    /// Linux only: "wayland", "x11", or "unknown" — the first thing to ask
    /// about a rendering or input bug on Linux.
    pub session: Option<String>,
    /// Linux only: `XDG_CURRENT_DESKTOP` ("GNOME", "KDE", "sway", ...).
    pub desktop: Option<String>,
    /// The wrapper's own version, from tauri.conf.json.
    pub app_version: String,
}

/// Reads the host description. Infallible by construction — see the module
/// comment on why this returns a partly-empty struct rather than an error.
#[tauri::command]
pub fn system_info(app: tauri::AppHandle) -> SystemInfo {
    let mut info = SystemInfo {
        os: std::env::consts::OS.to_string(),
        os_name: String::new(),
        os_version: String::new(),
        arch: std::env::consts::ARCH.to_string(),
        family: std::env::consts::FAMILY.to_string(),
        kernel: kernel_release(),
        distro_id: None,
        distro_like: Vec::new(),
        packaging: "unknown".to_string(),
        session: None,
        desktop: None,
        app_version: app.package_info().version.to_string(),
    };
    fill_os(&mut info);
    if info.os_name.trim().is_empty() {
        info.os_name = info.os.clone();
    }
    info
}

/// Runs a system tool and returns its trimmed stdout, or None if it is
/// missing, fails, or is blocked (App Sandbox forbids spawning entirely).
#[cfg(unix)]
fn run(bin: &str, args: &[&str]) -> Option<String> {
    let out = std::process::Command::new(bin).args(args).output().ok()?;
    if !out.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if text.is_empty() { None } else { Some(text) }
}

/// Kernel release. `/proc` is the cheap path where it exists (Linux and
/// Android); `uname -r` covers the rest of unix. Windows fills this from the
/// registry in `fill_os` instead, since it has no kernel release separate from
/// the OS build number.
#[cfg(unix)]
fn kernel_release() -> String {
    if let Ok(text) = std::fs::read_to_string("/proc/sys/kernel/osrelease") {
        let trimmed = text.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }
    run("uname", &["-r"]).unwrap_or_default()
}

#[cfg(windows)]
fn kernel_release() -> String {
    String::new()
}

// ---------------------------------------------------------------- Linux ----

#[cfg(target_os = "linux")]
fn fill_os(info: &mut SystemInfo) {
    // /etc is the local override, /usr/lib the vendor default — the order
    // os-release(5) specifies, and the reason an image-based distro that ships
    // no /etc copy still identifies itself.
    let release = ["/etc/os-release", "/usr/lib/os-release"]
        .iter()
        .find_map(|path| std::fs::read_to_string(path).ok())
        .map(|raw| parse_os_release(&raw))
        .unwrap_or_default();

    info.distro_id = release.id.clone();
    info.distro_like = release.id_like.clone();
    info.os_version = release.version_id.clone().unwrap_or_default();
    info.os_name = release
        .pretty_name
        .clone()
        .or_else(|| match (&release.name, &release.version) {
            (Some(name), Some(version)) => Some(format!("{name} {version}")),
            (Some(name), None) => Some(name.clone()),
            _ => None,
        })
        .or_else(legacy_release_name)
        .unwrap_or_else(|| "Linux".to_string());

    info.packaging = linux_packaging(info.distro_id.as_deref(), &info.distro_like);
    info.session = Some(linux_session());
    info.desktop = std::env::var("XDG_CURRENT_DESKTOP")
        .ok()
        .filter(|value| !value.is_empty());
}

/// The subset of os-release(5) worth reading here.
#[cfg(target_os = "linux")]
#[derive(Debug, Default, Clone)]
struct OsRelease {
    pretty_name: Option<String>,
    name: Option<String>,
    version: Option<String>,
    version_id: Option<String>,
    id: Option<String>,
    id_like: Vec<String>,
}

/// Parses os-release's `KEY=value` lines. The file is defined as a subset of
/// shell, so values may be single- or double-quoted and may contain backslash
/// escapes; anything unparseable is skipped rather than poisoning the result.
#[cfg(target_os = "linux")]
fn parse_os_release(raw: &str) -> OsRelease {
    let mut out = OsRelease::default();
    for line in raw.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        let value = unquote(value.trim());
        if value.is_empty() {
            continue;
        }
        match key.trim() {
            "PRETTY_NAME" => out.pretty_name = Some(value),
            "NAME" => out.name = Some(value),
            "VERSION" => out.version = Some(value),
            "VERSION_ID" => out.version_id = Some(value),
            "ID" => out.id = Some(value),
            "ID_LIKE" => out.id_like = value.split_whitespace().map(str::to_string).collect(),
            _ => {}
        }
    }
    out
}

/// Strips one layer of matching quotes and the backslash escapes os-release
/// allows inside them.
#[cfg(target_os = "linux")]
fn unquote(value: &str) -> String {
    let bytes = value.as_bytes();
    let quoted = bytes.len() >= 2
        && (bytes[0] == b'"' || bytes[0] == b'\'')
        && bytes[bytes.len() - 1] == bytes[0];
    let inner = if quoted {
        &value[1..value.len() - 1]
    } else {
        value
    };
    inner
        .replace("\\\"", "\"")
        .replace("\\'", "'")
        .replace("\\$", "$")
        .replace("\\`", "`")
        .replace("\\\\", "\\")
}

/// Names the distro on systems that predate os-release or ship without it.
/// Ordered most-specific first: `/etc/system-release` is a symlink to the
/// vendor file on the RHEL family, so the vendor files are tried before it,
/// and `/etc/debian_version` is last because Ubuntu and every other derivative
/// also carry it.
#[cfg(target_os = "linux")]
fn legacy_release_name() -> Option<String> {
    let first_line = |path: &str| -> Option<String> {
        let raw = std::fs::read_to_string(path).ok()?;
        let line = raw.lines().next()?.trim().to_string();
        if line.is_empty() { None } else { Some(line) }
    };

    for path in [
        "/etc/fedora-release",
        "/etc/centos-release",
        "/etc/redhat-release",
        "/etc/system-release",
        "/etc/SuSE-release",
        "/etc/gentoo-release",
        "/etc/slackware-version",
        "/etc/void-release",
    ] {
        if let Some(line) = first_line(path) {
            return Some(line);
        }
    }
    // These two hold a bare version number rather than a description.
    if let Some(version) = first_line("/etc/alpine-release") {
        return Some(format!("Alpine Linux {version}"));
    }
    // Arch is rolling and its marker file is empty, so its mere existence is
    // the whole signal.
    if std::path::Path::new("/etc/arch-release").exists() {
        return Some("Arch Linux".to_string());
    }
    if let Ok(raw) = std::fs::read_to_string("/etc/lsb-release") {
        for line in raw.lines() {
            if let Some(value) = line.trim().strip_prefix("DISTRIB_DESCRIPTION=") {
                let value = unquote(value.trim());
                if !value.is_empty() {
                    return Some(value);
                }
            }
        }
    }
    if let Some(version) = first_line("/etc/debian_version") {
        return Some(format!("Debian GNU/Linux {version}"));
    }
    None
}

/// Infers the package format this copy came from. The relocatable bundles win
/// over the host distro on purpose: an AppImage running on Fedora is still an
/// AppImage, and answering "rpm" would send a bug reporter to an uninstall
/// command that finds nothing. Only when no bundle announces itself does the
/// distro get to answer.
#[cfg(target_os = "linux")]
fn linux_packaging(id: Option<&str>, id_like: &[String]) -> String {
    if std::env::var_os("APPIMAGE").is_some() {
        return "appimage".to_string();
    }
    if std::env::var_os("FLATPAK_ID").is_some() || std::path::Path::new("/.flatpak-info").exists()
    {
        return "flatpak".to_string();
    }
    if std::env::var_os("SNAP").is_some() {
        return "snap".to_string();
    }
    distro_packaging(id, id_like)
}

/// The distro half of the guess, kept separate from the environment sniffing
/// above so it is a pure function of os-release. `ID` is checked before
/// `ID_LIKE`, so a derivative this list has never heard of still resolves
/// through the family it declares.
#[cfg(target_os = "linux")]
fn distro_packaging(id: Option<&str>, id_like: &[String]) -> String {
    let mut candidates: Vec<&str> = Vec::with_capacity(1 + id_like.len());
    candidates.extend(id);
    candidates.extend(id_like.iter().map(String::as_str));

    for name in candidates {
        let format = match name {
            "debian" | "ubuntu" | "linuxmint" | "pop" | "raspbian" | "elementary" | "zorin"
            | "kali" | "devuan" | "mx" | "neon" => "deb",
            "fedora" | "rhel" | "centos" | "rocky" | "almalinux" | "ol" | "amzn" | "mageia"
            | "opensuse" | "opensuse-leap" | "opensuse-tumbleweed" | "sles" | "suse" => "rpm",
            "arch" | "archarm" | "manjaro" | "endeavouros" | "garuda" | "cachyos" | "artix" => {
                "pacman"
            }
            "alpine" | "postmarketos" => "apk",
            "gentoo" => "portage",
            "void" => "xbps",
            "nixos" => "nix",
            "solus" => "eopkg",
            "slackware" => "slackpkg",
            _ => continue,
        };
        return format.to_string();
    }
    "unknown".to_string()
}

/// Which display server the app ended up talking to. `XDG_SESSION_TYPE` is the
/// answer when the session manager set it; the two display variables are the
/// fallback for bare startx and minimal compositors that never do. Note this
/// is the *session*, not the toolkit: WebKitGTK may still be on XWayland
/// inside a Wayland session.
#[cfg(target_os = "linux")]
fn linux_session() -> String {
    if let Ok(kind) = std::env::var("XDG_SESSION_TYPE") {
        if !kind.is_empty() {
            return kind;
        }
    }
    if std::env::var_os("WAYLAND_DISPLAY").is_some() {
        return "wayland".to_string();
    }
    if std::env::var_os("DISPLAY").is_some() {
        return "x11".to_string();
    }
    "unknown".to_string()
}

// ---------------------------------------------------------------- macOS ----

#[cfg(target_os = "macos")]
fn fill_os(info: &mut SystemInfo) {
    let version = run("sw_vers", &["-productVersion"])
        .or_else(|| system_version_plist("ProductVersion"))
        .unwrap_or_default();
    let build = run("sw_vers", &["-buildVersion"])
        .or_else(|| system_version_plist("ProductBuildVersion"));

    info.os_version = version.clone();
    info.packaging = "app-bundle".to_string();
    info.os_name = match (version.is_empty(), macos_marketing_name(&version), build) {
        (true, _, _) => "macOS".to_string(),
        (false, Some(name), Some(build)) => format!("macOS {version} {name} ({build})"),
        (false, Some(name), None) => format!("macOS {version} {name}"),
        (false, None, Some(build)) => format!("macOS {version} ({build})"),
        (false, None, None) => format!("macOS {version}"),
    };
}

/// Reads one string value out of SystemVersion.plist. The fallback that makes
/// this work under App Sandbox, where `sw_vers` cannot be spawned but the
/// plist is still readable. Deliberately a scan rather than a plist parser —
/// two fixed keys are not worth a dependency, and the file is a flat
/// `<key>k</key><string>v</string>` table.
#[cfg(target_os = "macos")]
fn system_version_plist(key: &str) -> Option<String> {
    let raw =
        std::fs::read_to_string("/System/Library/CoreServices/SystemVersion.plist").ok()?;
    let after_key = raw.split_once(&format!("<key>{key}</key>"))?.1;
    let after_open = after_key.split_once("<string>")?.1;
    let value = after_open.split_once("</string>")?.0.trim();
    if value.is_empty() {
        None
    } else {
        Some(value.to_string())
    }
}

/// The name people actually use for a macOS release. Only versions this app
/// can run on are listed (`minimumSystemVersion` is 10.15); anything newer
/// than the table returns None and the panel shows the bare version, which is
/// the right failure — a wrong codename is worse than no codename.
#[cfg(target_os = "macos")]
fn macos_marketing_name(version: &str) -> Option<&'static str> {
    let mut parts = version.split('.');
    let major: u32 = parts.next()?.parse().ok()?;
    match major {
        26 => Some("Tahoe"),
        15 => Some("Sequoia"),
        14 => Some("Sonoma"),
        13 => Some("Ventura"),
        12 => Some("Monterey"),
        11 => Some("Big Sur"),
        // 10.x named the *minor*: 10.15 is Catalina, the oldest supported.
        10 => match parts.next()?.parse::<u32>().ok()? {
            15 => Some("Catalina"),
            _ => None,
        },
        _ => None,
    }
}

// -------------------------------------------------------------- Windows ----

#[cfg(target_os = "windows")]
fn fill_os(info: &mut SystemInfo) {
    use winreg::RegKey;
    use winreg::enums::HKEY_LOCAL_MACHINE;

    let mut product = String::new();
    let mut display_version = String::new();
    let mut build: u32 = 0;
    let mut revision: u32 = 0;
    let mut major: u32 = 0;
    let mut minor: u32 = 0;

    // The registry rather than GetVersionEx: the Win32 call lies about the
    // version unless the caller ships a compatibility manifest naming every
    // Windows it has been tested on, and this key never has.
    if let Ok(key) = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey(r"SOFTWARE\Microsoft\Windows NT\CurrentVersion")
    {
        product = key.get_value::<String, _>("ProductName").unwrap_or_default();
        display_version = key
            .get_value::<String, _>("DisplayVersion")
            .or_else(|_| key.get_value::<String, _>("ReleaseId"))
            .unwrap_or_default();
        build = key
            .get_value::<String, _>("CurrentBuildNumber")
            .ok()
            .and_then(|value| value.parse().ok())
            .unwrap_or(0);
        revision = key.get_value::<u32, _>("UBR").unwrap_or(0);
        major = key.get_value::<u32, _>("CurrentMajorVersionNumber").unwrap_or(10);
        minor = key.get_value::<u32, _>("CurrentMinorVersionNumber").unwrap_or(0);
    }

    // `ProductName` still reads "Windows 10 ..." on Windows 11 — Microsoft
    // left the value alone so old installers keep matching on it, which makes
    // the build number the only reliable discriminator (11 starts at 22000).
    if build >= 22000 && product.contains("Windows 10") {
        product = product.replacen("Windows 10", "Windows 11", 1);
    }
    if product.trim().is_empty() {
        product = "Windows".to_string();
    }

    let full_build = if revision > 0 {
        format!("{build}.{revision}")
    } else {
        build.to_string()
    };
    info.os_version = full_build.clone();
    info.kernel = format!("{major}.{minor}.{full_build}");
    info.packaging = "windows-installer".to_string();
    info.os_name = if display_version.is_empty() {
        format!("{product} (build {full_build})")
    } else {
        format!("{product} {display_version} (build {full_build})")
    };
}

// ------------------------------------------- Android, iOS, BSD, anything ----

#[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
fn fill_os(info: &mut SystemInfo) {
    // The BSDs answer `uname` and have no os-release; Android and iOS need
    // JNI / UIDevice to name their release, which is more machinery than an
    // about panel justifies. Both cases land here with os/arch/kernel filled
    // and the rest honestly blank.
    let name = run("uname", &["-s"]).unwrap_or_else(|| info.os.clone());
    info.os_name = if info.kernel.is_empty() {
        name
    } else {
        format!("{name} {}", info.kernel)
    };
    info.os_version = info.kernel.clone();
}

#[cfg(all(test, target_os = "linux"))]
mod tests {
    use super::*;

    #[test]
    fn parses_a_quoted_os_release() {
        let parsed = parse_os_release(
            "NAME=\"Ubuntu\"\nVERSION=\"24.04.1 LTS (Noble Numbat)\"\nID=ubuntu\n\
             ID_LIKE=debian\nPRETTY_NAME=\"Ubuntu 24.04.1 LTS\"\nVERSION_ID=\"24.04\"\n",
        );
        assert_eq!(parsed.pretty_name.as_deref(), Some("Ubuntu 24.04.1 LTS"));
        assert_eq!(parsed.id.as_deref(), Some("ubuntu"));
        assert_eq!(parsed.version_id.as_deref(), Some("24.04"));
        assert_eq!(parsed.id_like, vec!["debian".to_string()]);
    }

    #[test]
    fn skips_comments_and_blank_lines() {
        let parsed = parse_os_release("# a comment\n\nID=arch\nnot-a-pair\n");
        assert_eq!(parsed.id.as_deref(), Some("arch"));
        assert!(parsed.pretty_name.is_none());
    }

    #[test]
    fn unquotes_escapes() {
        assert_eq!(unquote("\"Red Hat \\\"Linux\\\"\""), "Red Hat \"Linux\"");
        assert_eq!(unquote("bare"), "bare");
    }

    #[test]
    fn resolves_packaging_through_the_id_like_family() {
        // Pop!_OS is in no list here; `ID_LIKE=ubuntu debian` is what places it.
        let like = vec!["ubuntu".to_string(), "debian".to_string()];
        assert_eq!(distro_packaging(Some("pop"), &like), "deb");
        assert_eq!(distro_packaging(Some("fedora"), &[]), "rpm");
        assert_eq!(distro_packaging(Some("nixos"), &[]), "nix");
        assert_eq!(distro_packaging(Some("who-knows"), &[]), "unknown");
    }

    #[test]
    fn multi_word_id_like_survives_quoting() {
        let parsed = parse_os_release("ID=pop\nID_LIKE=\"ubuntu debian\"\n");
        assert_eq!(parsed.id_like, vec!["ubuntu".to_string(), "debian".to_string()]);
    }
}
