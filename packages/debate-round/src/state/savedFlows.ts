/**
 * @fileoverview Account-linked flow cloud save — TODO.md idea #17 ("User
 * Settings — account-linked debate preferences"), follow-up (3), "flows"
 * half. Pure validation/derivation helpers shared by the `/api/flows`
 * D1-backed routes (`apps/debate-ai.com`) and the `FlowHistoryDialog` cloud
 * UI, kept framework/fetch-free so both sides agree on what a "valid saved
 * flow" is without duplicating logic, mirroring `state/userSettings.ts`'s
 * split for the settings slice.
 *
 * @module state/savedFlows
 */

import type { Box, Flow } from "../types/flow";

/** Hard cap on a single flow's JSON size, generous for even a very long flow but well short of D1's row-size limits. */
export const MAX_SAVED_FLOW_BYTES = 2_000_000;

/** Recursion depth cap for `Box.children`, guarding the validator (and D1) against pathological/malicious nesting. */
const MAX_BOX_DEPTH = 200;

function isBox(value: unknown, depth: number): value is Box {
  if (depth > MAX_BOX_DEPTH) return false;
  if (typeof value !== "object" || value === null) return false;
  const box = value as Record<string, unknown>;
  if (typeof box.content !== "string") return false;
  if (typeof box.index !== "number") return false;
  if (typeof box.level !== "number") return false;
  if (typeof box.focus !== "boolean") return false;
  if (!Array.isArray(box.children)) return false;
  return box.children.every((child) => isBox(child, depth + 1));
}

/**
 * Structural validator for an untrusted (e.g. parsed request-body JSON)
 * value claiming to be a `Flow`. Checks required fields and recursively
 * validates the `children` `Box` tree; optional fields are only checked
 * when present, since `Flow` treats them as such.
 */
export function isValidFlow(value: unknown): value is Flow {
  if (typeof value !== "object" || value === null) return false;
  const flow = value as Record<string, unknown>;

  if (typeof flow.content !== "string") return false;
  if (typeof flow.level !== "number") return false;
  if (!Array.isArray(flow.columns) || !flow.columns.every((c) => typeof c === "string")) return false;
  if (typeof flow.invert !== "boolean") return false;
  if (typeof flow.focus !== "boolean") return false;
  if (typeof flow.index !== "number") return false;
  if (!Array.isArray(flow.lastFocus) || !flow.lastFocus.every((n) => typeof n === "number")) return false;
  if (!Array.isArray(flow.children) || !flow.children.every((child) => isBox(child, 0))) return false;
  if (typeof flow.id !== "number") return false;

  return true;
}

/**
 * Derives a short display label for a saved flow from its `content`, so
 * `GET /api/flows`'s list view doesn't need to parse every row's full
 * `data` blob just to show something to the user. Mirrors
 * `FlowHistoryDialog`'s own `flow.content || "Speech ${flow.speechNumber}"`
 * fallback for an untitled flow.
 */
export function deriveFlowLabel(flow: Pick<Flow, "content" | "speechNumber">): string {
  const trimmed = flow.content.trim();
  if (trimmed.length > 0) return trimmed.slice(0, 120);
  return flow.speechNumber !== undefined ? `Speech ${flow.speechNumber}` : "Untitled flow";
}

/** A saved flow's list-view summary — everything `GET /api/flows` returns without the full `data` blob. */
export type SavedFlowSummary = {
  clientId: number;
  label: string;
  updatedAt: string;
};

/**
 * Optimistic-concurrency check for `PUT /api/flows/[clientId]`: is a save
 * about to clobber a version the caller doesn't know about?
 *
 * `currentUpdatedAt` is the currently-saved row's `updatedAt` (ISO string),
 * or `null` if no row exists yet for this `(userId, clientId)` — a brand
 * new save never conflicts. `baseUpdatedAt` is what the caller believes is
 * saved: the `updatedAt` from the last list/load/save response it saw, or
 * `null`/`undefined` if it has no idea a saved version might already exist
 * (e.g. it never opened the "Saved to account" tab this session). An
 * unknown baseline against an existing row is treated as a conflict rather
 * than allowed through, so a save can't silently overwrite a version the
 * caller never saw.
 */
export function hasFlowSaveConflict(
  currentUpdatedAt: string | null,
  baseUpdatedAt: string | null | undefined,
): boolean {
  if (currentUpdatedAt === null) return false;
  return baseUpdatedAt == null || baseUpdatedAt !== currentUpdatedAt;
}
