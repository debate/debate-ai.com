/**
 * @fileoverview Reads untrusted request bodies for Rebuttal Playlists. A drill
 * may only be started on a video that is on the playlist it names, so the API
 * never stores a drill the page can't place.
 *
 * @module debate-practice-rounds/rebuttal-playlists/validation
 */

import { findPlaylistVideo } from "./playlists";
import { DRILL_ACTIONS } from "./rules";
import type { DrillSide, NewRebuttalDrill, PlaylistVideo, RebuttalDrillAction, RebuttalDrillStatus } from "./types";

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const fail = (error: string): Parsed<never> => ({ ok: false, error });

export function isDrillSide(value: unknown): value is DrillSide {
  return value === "aff" || value === "neg";
}

const STATUSES: readonly RebuttalDrillStatus[] = ["waiting", "writing", "judging", "complete", "cancelled"];

export function isDrillStatus(value: unknown): value is RebuttalDrillStatus {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

/** A new drill, with the video it is on. */
export interface ParsedNewDrill extends NewRebuttalDrill {
  video: PlaylistVideo;
}

/** Reads the body of `POST /api/rebuttal-drills`. */
export function parseNewRebuttalDrill(payload: unknown): Parsed<ParsedNewDrill> {
  if (!payload || typeof payload !== "object") return fail("Invalid drill.");
  const body = payload as Partial<Record<keyof NewRebuttalDrill, unknown>>;
  if (typeof body.playlistId !== "string" || typeof body.videoId !== "string") return fail("Pick a video from a playlist.");
  const video = findPlaylistVideo(body.playlistId, body.videoId);
  if (!video) return fail("That video isn't on this playlist.");
  if (!isDrillSide(body.side)) return fail("Pick Aff or Neg.");
  if (body.partner !== "partner" && body.partner !== "ai") return fail("Pick a partner or the AI.");
  return {
    ok: true,
    value: { playlistId: body.playlistId, videoId: body.videoId, side: body.side, partner: body.partner, video },
  };
}

/** Reads the body of `PATCH /api/rebuttal-drills/[id]`. */
export function parseRebuttalDrillUpdate(payload: unknown): Parsed<{ action: RebuttalDrillAction; text?: string }> {
  if (!payload || typeof payload !== "object") return fail("Invalid update.");
  const body = payload as { action?: unknown; text?: unknown };
  if (typeof body.action !== "string" || !(DRILL_ACTIONS as readonly string[]).includes(body.action)) {
    return fail("Unknown action.");
  }
  if (body.text !== undefined && typeof body.text !== "string") return fail("The text must be a string.");
  return { ok: true, value: { action: body.action as RebuttalDrillAction, ...(typeof body.text === "string" ? { text: body.text } : {}) } };
}
