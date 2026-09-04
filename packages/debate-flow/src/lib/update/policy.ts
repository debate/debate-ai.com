import type { UpdateManifest, UpdatePlatformEntry } from "./types";

function isPlatformEntry(value: unknown): value is UpdatePlatformEntry {
    if (typeof value !== "object" || value === null) return false;
    const entry = value as Record<string, unknown>;
    return typeof entry.signature === "string" && typeof entry.url === "string";
}

/**
 * Validates and normalizes a raw manifest (from `latest.json`). Throws on an
 * invalid shape. Signature verification is the updater's job, not this
 * function's — this only checks that the manifest is well-formed enough to act
 * on.
 */
export function parseManifest(json: unknown): UpdateManifest {
    if (typeof json !== "object" || json === null) {
        throw new Error("Invalid manifest: expected an object");
    }
    const raw = json as Record<string, unknown>;

    if (typeof raw.version !== "string" || raw.version.length === 0) {
        throw new Error("Invalid manifest: missing version");
    }
    if (typeof raw.platforms !== "object" || raw.platforms === null) {
        throw new Error("Invalid manifest: missing platforms");
    }

    // Keys come from the manifest, and on an ordinary object literal a
    // `__proto__` entry re-points the prototype instead of adding a platform.
    const platforms = Object.create(null) as Record<string, UpdatePlatformEntry>;
    for (const [key, value] of Object.entries(raw.platforms)) {
        if (!isPlatformEntry(value)) {
            throw new Error(`Invalid manifest: malformed platform "${key}"`);
        }
        platforms[key] = { signature: value.signature, url: value.url };
    }

    const manifest: UpdateManifest = { version: raw.version, platforms };
    if (typeof raw.pub_date === "string") manifest.pub_date = raw.pub_date;
    if (typeof raw.notes === "string") manifest.notes = raw.notes;

    return manifest;
}

/** Parses a dotted version (tolerating a leading `v` and prerelease suffix). */
function versionParts(version: string): number[] {
    const core = version.replace(/^v/, "").split("-")[0] ?? "";
    return core.split(".").map((n) => Number.parseInt(n, 10) || 0);
}

/** Returns true if `candidate` is a strictly newer version than `current`. */
export function isNewerVersion(candidate: string, current: string): boolean {
    const a = versionParts(candidate);
    const b = versionParts(current);
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
        const ai = a[i] ?? 0;
        const bi = b[i] ?? 0;
        if (ai !== bi) return ai > bi;
    }
    return false;
}

/** The decision the update lifecycle should act on after a manifest check. */
export type UpdateAction =
    /** No newer version is available. */
    | { kind: "none" }
    /** A newer version — download and stage it. */
    | { kind: "download" };

/**
 * Pure decision for what to do given a fetched manifest and the running
 * version. This is the brain the `useAutoUpdate` hook wires to side effects;
 * keeping it pure makes the whole policy unit-testable without Tauri or timers.
 * The install itself never happens here: staging only, the user confirms.
 */
export function decideUpdateAction(manifest: UpdateManifest, currentVersion: string): UpdateAction {
    return isNewerVersion(manifest.version, currentVersion)
        ? { kind: "download" }
        : { kind: "none" };
}
