/**
 * The replicated shape of a round.
 *
 * Every value is a last-writer-wins register, and every container is a plain
 * record keyed by a stable identity, so merging two replicas is a union with a
 * comparison and never a diff. Both the round and a sheet store their scalars
 * as dotted leaf paths rather than named fields: a path a newer build writes
 * survives a merge through an older one for free, which is the one property
 * that cannot be retrofitted once the protocol ships.
 */

import type { Stamp } from "./stamp";

/** Everything that crosses the wire or lands in a register. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** One value and the stamp that wrote it. */
export interface Register {
    value: Json;
    stamp: Stamp;
}

/**
 * What a peer may do to one round. A viewer reads it and writes nothing.
 *
 * Per round and never per peer: the same partner is an editor on the case a
 * pair is building together and a viewer on the one they are only being shown,
 * so the grant belongs to the round that made it and not to a row in the
 * contact table.
 */
export type Role = "editor" | "viewer";

/** A role off the wire, a ticket, or a sidecar, none of them trusted. */
export function isRole(value: unknown): value is Role {
    return value === "editor" || value === "viewer";
}

export interface CollabCell {
    /** Stored column index, the index `sheet.data` rows already use. */
    col: number;
    /** Immutable fractional index inside the column. */
    rank: string;
    /** Creator. "" marks a cell seeded from the file. Breaks a rank tie. */
    actor: string;
    text: string | null;
    textStamp: Stamp;
    /**
     * `CellMeta` as a bag, so a key a newer build writes survives. Text and
     * meta carry separate stamps: one stamp would let a bold toggle revert a
     * partner's concurrent text.
     */
    meta: Record<string, Json>;
    metaStamp: Stamp;
    /** Set once. A delete is never undone by a later write. */
    deleted: Stamp | null;
}

export interface CollabSheet {
    id: string;
    /** Leaf path to register: `title`, `group`, `order`, `kind`, `startSpeechId`. */
    fields: Record<string, Register>;
    deleted: Stamp | null;
    /** cellKey to cell, across every column of the sheet. */
    cells: Record<string, CollabCell>;
}

export interface CollabDoc {
    roundId: string;
    /** Leaf path to register: `event`, `firstSide`, and every scouting leaf. */
    round: Record<string, Register>;
    sheets: Record<string, CollabSheet>;
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
