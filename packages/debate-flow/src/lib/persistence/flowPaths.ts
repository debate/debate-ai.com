/**
 * Filename and path helpers for .ebb flow files. Pure string work: nothing here
 * touches a filesystem, so the Tauri adapter, the in-memory adapter, and the
 * tests all share one set of naming rules.
 *
 * Paths arrive from the OS verbatim, so every helper tolerates both separators
 * rather than assuming the platform it is running on.
 */

import type { EventId } from "../format/events";
import { teamCode } from "../model/teamCode";
import type { Scouting } from "../model/types";

export const EBB_EXT = ".ebb";

/** Longest name we will derive from scouting, before the extension. */
const MAX_STEM = 72;

function lastSeparator(path: string): number {
    return Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
}

/** Last path segment. */
export function basename(path: string): string {
    const cut = lastSeparator(path);
    return cut === -1 ? path : path.slice(cut + 1);
}

/** Directory portion of a path, or "" when the path has no separator. */
export function dirname(path: string): string {
    const cut = lastSeparator(path);
    return cut === -1 ? "" : path.slice(0, cut);
}

/** Basename with a trailing .ebb removed. */
export function stem(path: string): string {
    const name = basename(path);
    return name.toLowerCase().endsWith(EBB_EXT) ? name.slice(0, -EBB_EXT.length) : name;
}

/** Append .ebb unless it is already there. */
export function withEbbExt(name: string): string {
    return name.toLowerCase().endsWith(EBB_EXT) ? name : name + EBB_EXT;
}

/** Join a directory and a name using whichever separator the directory uses. */
export function joinPath(dir: string, name: string): string {
    if (!dir) return name;
    const sep = dir.includes("\\") && !dir.includes("/") ? "\\" : "/";
    return dir.endsWith(sep) ? dir + name : dir + sep + name;
}

/** Collapse the home directory to "~" for display. Never used to resolve. */
export function displayPath(path: string, home: string): string {
    if (!home) return path;
    const trimmed = home.replace(/[/\\]+$/, "");
    if (path === trimmed) return "~";
    const next = path[trimmed.length];
    if (path.startsWith(trimmed) && (next === "/" || next === "\\")) {
        return "~" + path.slice(trimmed.length);
    }
    return path;
}

/** Local (not UTC) calendar date, so a late-evening round is not filed tomorrow. */
function localDate(ts: number): string {
    const d = new Date(ts);
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    return `${d.getFullYear()}-${month}-${day}`;
}

function slug(s: string): string {
    return s
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/**
 * The filename to offer for a round: tournament, round, and team codes when the
 * round has been scouted, and the event plus the date when it has not. A new
 * flow is created before any scouting exists, so the second form is what most
 * files are born with; the name never changes afterwards, because a file that
 * renames itself underneath the user breaks every reference to it.
 *
 * Every part is slugged, the event included: a joined round carries whatever
 * the host's document said, and this result is a bare filename, never a path.
 */
export function suggestFilename(round: {
    event?: EventId;
    scouting: Scouting;
    createdAt: number;
}): string {
    const sc = round.scouting;
    const aff = teamCode(sc.affSchool ?? "", sc.aff.first, sc.aff.second);
    const neg = teamCode(sc.negSchool ?? "", sc.neg.first, sc.neg.second);
    const teams = aff && neg ? `${aff} vs ${neg}` : aff || neg;
    const parts = [sc.tournament, sc.round, teams].map((p) => slug(p ?? "")).filter(Boolean);
    const fallback = `${slug(round.event ?? "") || "policy"}-${localDate(round.createdAt)}`;
    const name = (parts.length ? parts.join("-") : fallback).slice(0, MAX_STEM).replace(/-+$/, "");
    return withEbbExt(name);
}

/**
 * First free variant of `name` given the names already in the directory:
 * "round.ebb", then "round-2.ebb", and so on. The Tauri adapter does this in
 * Rust against the real directory instead, where create-new makes it atomic;
 * this is for the in-memory adapter and its tests.
 */
export function dedupeFilename(name: string, taken: ReadonlySet<string>): string {
    if (!taken.has(name)) return name;
    const base = stem(name);
    for (let n = 2; n < 1000; n++) {
        const candidate = withEbbExt(`${base}-${n}`);
        if (!taken.has(candidate)) return candidate;
    }
    return withEbbExt(`${base}-${Date.now()}`);
}
