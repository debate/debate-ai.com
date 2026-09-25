/**
 * @fileoverview Write side of the admin "YouTube channels" tab.
 *
 * Split out of the route files the same way the query side is split out of
 * `app/api/admin/youtube/channels/route.ts`: so the mutations can be exercised
 * against a real database in tests without standing up a request handler.
 * @module lib/youtube/admin-channel-writes
 */

import { eq } from "drizzle-orm";
import { youtubeChannels, type YoutubeChannel } from "@/lib/database/schema";

/** What the add endpoint accepts. It takes a name alone — the channel id is
 *  resolved from YouTube on the next resync, never typed by an admin. */
export interface AddChannelInput {
  name: string;
}

/** What the edit endpoint accepts. Both fields optional; a rename re-keyed the
 *  unique name index, so the new name must not collide with an existing row. */
export interface EditChannelInput {
  name?: string;
  enabled?: boolean;
}

/** Result of adding a channel — the row as stored, or a conflict. */
export interface AddChannelResult {
  channel: YoutubeChannel | null;
  error: string | null;
}

/** Result of editing a channel. */
export interface EditChannelResult {
  channel: YoutubeChannel | null;
  error: string | null;
}

/** Result of deleting a channel. */
export interface DeleteChannelResult {
  deleted: boolean;
  error: string | null;
}

const MAX_NAME_LENGTH = 200;

/** Normalises a channel name: trimmed, non-empty, length-bounded. */
export function normalizeChannelName(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const name = input.trim();
  if (name.length === 0 || name.length > MAX_NAME_LENGTH) return null;
  return name;
}

/**
 * Adds a channel. A duplicate name is a conflict — the resync keys off it, so
 * two rows with the same name would both scan and double-upsert rounds.
 */
export async function addAdminChannel(db: any, input: AddChannelInput, addedBy: string | null): Promise<AddChannelResult> {
  const name = normalizeChannelName(input.name);
  if (!name) {
    return { channel: null, error: "Channel name is required." };
  }

  try {
    const [channel] = await db
      .insert(youtubeChannels)
      .values({ name, addedBy })
      .returning();
    return { channel: channel ?? null, error: null };
  } catch (error) {
    // A unique-name violation is the expected conflict; anything else is a
    // database problem worth surfacing verbatim.
    const message = String((error as Error)?.message ?? error);
    if (message.includes("UNIQUE constraint failed") || message.includes("unique")) {
      return { channel: null, error: `A channel named “${name}” already exists.` };
    }
    return { channel: null, error: message };
  }
}

/**
 * Edits a channel. A rename must not collide with another row's name; toggling
 * `enabled` is what pauses a channel without losing it.
 */
export async function editAdminChannel(
  db: any,
  id: number,
  input: EditChannelInput,
): Promise<EditChannelResult> {
  if (!Number.isInteger(id) || id <= 0) {
    return { channel: null, error: "Channel not found." };
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) {
    const name = normalizeChannelName(input.name);
    if (!name) return { channel: null, error: "Channel name is required." };
    patch.name = name;
  }
  if (input.enabled !== undefined) {
    patch.enabled = Boolean(input.enabled);
  }

  if (Object.keys(patch).length === 1) {
    // Only the timestamp touched — nothing to do.
    const [existing] = await db.select().from(youtubeChannels).where(eq(youtubeChannels.id, id)).limit(1);
    return { channel: existing ?? null, error: null };
  }

  try {
    const [channel] = await db
      .update(youtubeChannels)
      .set(patch)
      .where(eq(youtubeChannels.id, id))
      .returning();
    return { channel: channel ?? null, error: null };
  } catch (error) {
    const message = String((error as Error)?.message ?? error);
    if (message.includes("UNIQUE constraint failed") || message.includes("unique")) {
      return { channel: null, error: "Another channel already uses that name." };
    }
    return { channel: null, error: message };
  }
}

/**
 * Deletes a channel. Safe to run against an unknown id — it just no-ops.
 *
 * A deleted channel's rounds stay in `youtube_round_videos` (they are real
 * uploads, not derived from the subscription), so nothing cascades here.
 */
export async function deleteAdminChannel(db: any, id: number): Promise<DeleteChannelResult> {
  if (!Number.isInteger(id) || id <= 0) {
    return { deleted: false, error: "Channel not found." };
  }

  try {
    await db.delete(youtubeChannels).where(eq(youtubeChannels.id, id));
    // A deleted channel's rounds stay in `youtube_round_videos` (they are real
    // uploads, not derived from the subscription), so nothing cascades here.
    return { deleted: true, error: null };
  } catch (error) {
    return { deleted: false, error: String((error as Error)?.message ?? error) };
  }
}