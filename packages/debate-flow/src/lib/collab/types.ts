/**
 * The replicated shape of a round. The type definitions (and their field docs)
 * live in `@types/debate`; the helpers that work on them stay here.
 */

import type { CollabCell, Json, Role } from "debate";

export type { Json, Register, Role, CollabCell, CollabSheet, CollabDoc } from "debate";

/** A role off the wire, a ticket, or a sidecar, none of them trusted. */
export function isRole(value: unknown): value is Role {
    return value === "editor" || value === "viewer";
}

/**
 * Identity only. Ranks vary in length, so the joined string does not sort the
 * way the cells do; use compareCells for order.
 */
export function cellKey(col: number, rank: string, actor: string): string {
    return `${col}|${rank}|${actor}`;
}

/** Row order inside a column: rank, then creator. */
export function compareCells(a: CollabCell, b: CollabCell): number {
    if (a.rank !== b.rank) return a.rank < b.rank ? -1 : 1;
    return a.actor < b.actor ? -1 : a.actor > b.actor ? 1 : 0;
}

/**
 * Walks an object into `out` as dotted leaf paths. A plain object is descended
 * into; an array, a scalar, and null are leaves. An undefined leaf is skipped,
 * so an absent optional field stays absent on the far side.
 */
export function flattenLeaves(value: unknown, prefix: string, out: Record<string, Json>): void {
    if (value === undefined) return;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
            flattenLeaves(child, prefix ? `${prefix}.${key}` : key, out);
        }
        return;
    }
    out[prefix] = value as Json;
}

/**
 * Inverse of flattenLeaves for one path, creating the objects along the way.
 *
 * A register path is whatever a peer put on the wire, and three segments reach
 * the prototype chain rather than the round: walking one would assign through
 * `Object.prototype` for the whole process, and the sidecar would carry it
 * back in on every later open. A path holding one is not a path into this
 * document, so nothing is written.
 */
export function setPath(target: Record<string, unknown>, path: string, value: Json): void {
    const parts = path.split(".");
    if (parts.some((p) => p === "__proto__" || p === "constructor" || p === "prototype")) return;
    let node = target;
    for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i];
        const next = node[key];
        if (next === null || typeof next !== "object" || Array.isArray(next)) {
            node[key] = {};
        }
        node = node[key] as Record<string, unknown>;
    }
    node[parts[parts.length - 1]] = value;
}
