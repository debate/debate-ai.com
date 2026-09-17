/**
 * @fileoverview What sits beside a video: its long-form documents and the
 * videos an editor has tied to it.
 *
 * `video-repository.ts` serves the feed — thousands of rows, trimmed to
 * tuples, cached hard. This serves one video's page: a transcript that can
 * run past ten thousand words, and the handful of analysis videos linked to
 * it. Those are never part of a feed response, so they are read here, once,
 * by the page that is actually about that video.
 *
 * Every read degrades to empty rather than throwing. These tables arrived
 * after the library did, so a database that has not taken the migration yet
 * — or a preview deployment with no D1 binding at all — must still render a
 * watch page, just without the extra tabs.
 * @module lib/videos/video-content
 */

import { and, asc, eq, inArray } from "drizzle-orm";
import {
  isVideoDocumentKind,
  type VideoDocument,
  type VideoDocumentKind,
} from "debate-videos";
import type { VideoTuple } from "debate-data-sync/src/videos/video-rows";
import { videoDocuments, videoRelations } from "@/lib/database/schema";
import { getDBFromContext } from "@/lib/database/context";
import { getVideoPage } from "./video-repository";

/** One video an editor tied to another, with the row it points at. */
export interface LinkedVideoRecord {
  video: VideoTuple;
  relation: string;
  note: string | null;
}

/** How many links one video may show, ordered by the editor's positions. */
const MAX_LINKED_VIDEOS = 24;

/** Resolves the drizzle handle, or `null` where no database is reachable. */
async function tryGetDb() {
  try {
    return await getDBFromContext();
  } catch {
    return null;
  }
}

/** Turns a stored row into the shape the watch page's panel reads. */
function toDocument(row: {
  videoId: string;
  kind: string;
  title: string | null;
  body: string;
  author: string;
  model: string | null;
  wordCount: number;
  updatedAt: Date | number | null;
}): VideoDocument | null {
  if (!isVideoDocumentKind(row.kind)) return null;
  return {
    videoId: row.videoId,
    kind: row.kind as VideoDocumentKind,
    title: row.title,
    body: row.body ?? "",
    author: row.author,
    model: row.model,
    wordCount: row.wordCount ?? 0,
    updatedAt:
      row.updatedAt instanceof Date ? row.updatedAt.toISOString() : (row.updatedAt ?? null),
  };
}

/**
 * Fetches every long-form document stored for one video.
 *
 * @param videoId - YouTube video id.
 * @returns The documents, empty when the video has none or the table is
 *   missing. Ordering is left to the UI, which has its own tab order.
 */
export async function getVideoDocuments(videoId: string): Promise<VideoDocument[]> {
  const db = await tryGetDb();
  if (!db) return [];

  try {
    const rows = await db
      .select()
      .from(videoDocuments)
      .where(eq(videoDocuments.videoId, videoId));
    return (rows as any[]).map(toDocument).filter((row): row is VideoDocument => row !== null);
  } catch {
    // No table yet — the watch page simply has no document tabs.
    return [];
  }
}

/**
 * Fetches the videos an editor tied to this one, in the stated order.
 *
 * The relation rows carry only ids, so the rows themselves come from the
 * feed's own query path — one `IN` lookup, then reordered back into the
 * editor's sequence, because SQL returns them in whatever order it likes.
 *
 * @param videoId - The video being watched.
 * @returns Linked videos with their relation and note. See
 *   {@link LinkedVideoRecord}.
 */
export async function getLinkedVideos(videoId: string): Promise<LinkedVideoRecord[]> {
  const db = await tryGetDb();
  if (!db) return [];

  let links: Array<{ relatedVideoId: string; relation: string; note: string | null }>;
  try {
    links = await db
      .select({
        relatedVideoId: videoRelations.relatedVideoId,
        relation: videoRelations.relation,
        note: videoRelations.note,
      })
      .from(videoRelations)
      .where(eq(videoRelations.videoId, videoId))
      .orderBy(asc(videoRelations.position), asc(videoRelations.relatedVideoId))
      .limit(MAX_LINKED_VIDEOS);
  } catch {
    return [];
  }

  if (links.length === 0) return [];

  const ids = [...new Set(links.map((link) => link.relatedVideoId))];
  const page = await getVideoPage({ source: "all", ids, limit: ids.length, offset: 0 });
  const byId = new Map(page.videos.map((video) => [video[0] as string, video]));

  return links
    // A link whose target has since been removed from the library is dropped
    // rather than rendered as a card with no title behind it.
    .filter((link) => byId.has(link.relatedVideoId))
    .map((link) => ({
      video: byId.get(link.relatedVideoId) as VideoTuple,
      relation: link.relation,
      note: link.note,
    }));
}

/** Everything a watch page needs beside the player. */
export interface VideoSidePanelContent {
  documents: VideoDocument[];
  links: LinkedVideoRecord[];
}

/**
 * Fetches both halves of the watch page's side column in parallel.
 *
 * @param videoId - The video being watched.
 * @returns Documents and linked videos. See {@link VideoSidePanelContent}.
 */
export async function getVideoSidePanelContent(
  videoId: string,
): Promise<VideoSidePanelContent> {
  const [documents, links] = await Promise.all([
    getVideoDocuments(videoId),
    getLinkedVideos(videoId),
  ]);
  return { documents, links };
}

/** An admin's edit to one document. */
export interface VideoDocumentPatch {
  title?: string | null;
  body?: string;
  author?: string | null;
  model?: string | null;
}

/** Counts words the way the panel's own header does. */
function countWords(body: string): number {
  const matches = (body ?? "").replace(/^#{1,6}\s+/gm, "").match(/\S+/g);
  return matches ? matches.length : 0;
}

/**
 * Writes one document, creating it when the video has none of that kind.
 *
 * The word count is derived here rather than trusted from the client, so the
 * number the tab strip shows always matches the body that was stored.
 *
 * @param db - Drizzle handle.
 * @param videoId - YouTube video id.
 * @param kind - Which document this is.
 * @param patch - Fields the admin changed.
 * @param editor - Admin email, for the audit trail.
 * @returns The stored row.
 */
export async function saveVideoDocument(
  db: any,
  videoId: string,
  kind: VideoDocumentKind,
  patch: VideoDocumentPatch,
  editor: string | null,
): Promise<VideoDocument | null> {
  const body = String(patch.body ?? "");
  const title = patch.title?.toString().trim() || null;
  const author = patch.author?.toString().trim() || "editor";
  const model = patch.model?.toString().trim() || null;
  const now = new Date();

  const values = {
    videoId,
    kind,
    title,
    body,
    author,
    model,
    wordCount: countWords(body),
    updatedBy: editor,
    createdAt: now,
    updatedAt: now,
  };

  await db
    .insert(videoDocuments)
    .values(values)
    .onConflictDoUpdate({
      target: [videoDocuments.videoId, videoDocuments.kind],
      set: {
        title,
        body,
        author,
        model,
        wordCount: values.wordCount,
        updatedBy: editor,
        updatedAt: now,
      },
    });

  const [row] = await db
    .select()
    .from(videoDocuments)
    .where(and(eq(videoDocuments.videoId, videoId), eq(videoDocuments.kind, kind)))
    .limit(1);
  return row ? toDocument(row as any) : null;
}

/**
 * Removes one document.
 *
 * @returns Whether a row was there to remove.
 */
export async function deleteVideoDocument(
  db: any,
  videoId: string,
  kind: VideoDocumentKind,
): Promise<boolean> {
  const [existing] = await db
    .select({ kind: videoDocuments.kind })
    .from(videoDocuments)
    .where(and(eq(videoDocuments.videoId, videoId), eq(videoDocuments.kind, kind)))
    .limit(1);
  if (!existing) return false;

  await db
    .delete(videoDocuments)
    .where(and(eq(videoDocuments.videoId, videoId), eq(videoDocuments.kind, kind)));
  return true;
}

/**
 * Ties one video to another.
 *
 * Self-links are rejected: a video listed as its own analysis renders a card
 * that navigates to the page it is already on. New links go to the end of
 * the list unless the caller states a position.
 *
 * @param db - Drizzle handle.
 * @param videoId - The video being watched.
 * @param relatedVideoId - The video to offer beside it.
 * @param relation - `analysis`, `related`, `rematch`.
 * @param note - The editor's reason, shown under the card.
 * @param editor - Admin email, for the audit trail.
 * @returns The stored link row.
 */
export async function addVideoRelation(
  db: any,
  videoId: string,
  relatedVideoId: string,
  relation: string,
  note: string | null,
  editor: string | null,
) {
  if (videoId === relatedVideoId) {
    throw new Error("A video cannot be linked to itself");
  }

  const existing = await db
    .select({ position: videoRelations.position })
    .from(videoRelations)
    .where(eq(videoRelations.videoId, videoId));
  const position = existing.reduce(
    (highest: number, row: { position: number }) => Math.max(highest, row.position + 1),
    0,
  );

  await db
    .insert(videoRelations)
    .values({
      videoId,
      relatedVideoId,
      relation,
      note,
      position,
      createdBy: editor,
      createdAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [videoRelations.videoId, videoRelations.relatedVideoId, videoRelations.relation],
      set: { note, createdBy: editor },
    });

  const [row] = await db
    .select()
    .from(videoRelations)
    .where(
      and(
        eq(videoRelations.videoId, videoId),
        eq(videoRelations.relatedVideoId, relatedVideoId),
        eq(videoRelations.relation, relation),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Removes one link.
 *
 * @returns Whether a link was there to remove.
 */
export async function removeVideoRelation(
  db: any,
  videoId: string,
  relatedVideoId: string,
  relation: string,
): Promise<boolean> {
  const where = and(
    eq(videoRelations.videoId, videoId),
    eq(videoRelations.relatedVideoId, relatedVideoId),
    eq(videoRelations.relation, relation),
  );
  const [existing] = await db
    .select({ relation: videoRelations.relation })
    .from(videoRelations)
    .where(where)
    .limit(1);
  if (!existing) return false;

  await db.delete(videoRelations).where(where);
  return true;
}

/**
 * Reorders one video's links to the given sequence of related ids.
 *
 * Ids the video is not actually linked to are ignored, so a stale admin tab
 * cannot write positions for links someone else has removed.
 *
 * @param db - Drizzle handle.
 * @param videoId - The video whose links are being ordered.
 * @param orderedIds - Related video ids, first to last.
 */
export async function reorderVideoRelations(
  db: any,
  videoId: string,
  orderedIds: string[],
): Promise<void> {
  if (orderedIds.length === 0) return;

  const rows = await db
    .select({ relatedVideoId: videoRelations.relatedVideoId })
    .from(videoRelations)
    .where(
      and(
        eq(videoRelations.videoId, videoId),
        inArray(videoRelations.relatedVideoId, orderedIds),
      ),
    );
  const known = new Set(rows.map((row: { relatedVideoId: string }) => row.relatedVideoId));

  let position = 0;
  for (const relatedVideoId of orderedIds) {
    if (!known.has(relatedVideoId)) continue;
    await db
      .update(videoRelations)
      .set({ position: position++ })
      .where(
        and(
          eq(videoRelations.videoId, videoId),
          eq(videoRelations.relatedVideoId, relatedVideoId),
        ),
      );
  }
}

/**
 * Lists one video's links for the admin dialog, newest ordering first.
 *
 * Unlike {@link getLinkedVideos} this keeps links whose target has left the
 * library, because that is exactly the broken link an admin came to clear.
 */
export async function listVideoRelations(db: any, videoId: string) {
  return db
    .select()
    .from(videoRelations)
    .where(eq(videoRelations.videoId, videoId))
    .orderBy(asc(videoRelations.position), asc(videoRelations.relatedVideoId));
}
