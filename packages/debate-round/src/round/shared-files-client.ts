/**
 * @fileoverview Network calls for the shared-file library (`/api/shared-files`
 * in `apps/debate-ai.com`). Kept separate from `state/sharedFiles.ts`'s pure
 * helpers so those stay unit-testable without mocking `fetch`, mirroring
 * `round/saved-flows-client.ts`.
 *
 * Reads (`listSharedFiles`, `fetchSharedFile`) work signed out — the public
 * library is readable by everyone — while `listMySharedFiles` resolves to
 * `null` on a `401` so the caller can show a "sign in" state. Writes throw
 * on failure with the server's error message.
 *
 * @module round/shared-files-client
 */

import type { SharedFileItem, SharedFilePayload } from "../state/sharedFiles";

const DEFAULT_ENDPOINT = "/api/shared-files";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload?.error ?? fallback;
  } catch {
    return fallback;
  }
}

/** Lists every published shared file (admin Topic Starter packs and user-shared files alike). */
export async function listSharedFiles(endpoint = DEFAULT_ENDPOINT): Promise<SharedFileItem[]> {
  const res = await fetch(endpoint);
  if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to load the shared-file library."));
  const data = (await res.json()) as { items?: SharedFileItem[] };
  return data.items ?? [];
}

/** Lists the current user's own shared files, published or not. `null` when signed out. */
export async function listMySharedFiles(endpoint = DEFAULT_ENDPOINT): Promise<SharedFileItem[] | null> {
  const res = await fetch(`${endpoint}?scope=mine`);
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to load your shared files."));
  const data = (await res.json()) as { items?: SharedFileItem[] };
  return data.items ?? [];
}

/** Fetches one shared file (with content). `null` when it doesn't exist or isn't visible to this viewer. */
export async function fetchSharedFile(id: number, endpoint = DEFAULT_ENDPOINT): Promise<SharedFileItem | null> {
  const res = await fetch(`${endpoint}/${id}`);
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to load this shared file."));
  return (await res.json()) as SharedFileItem;
}

/** Creates a shared file or folder from an explicit payload. Requires a session. */
export async function createSharedFile(payload: SharedFilePayload, endpoint = DEFAULT_ENDPOINT): Promise<SharedFileItem> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to share this file."));
  return (await res.json()) as SharedFileItem;
}

/**
 * Publishes one of the user's Reason Editor documents to the library —
 * re-sharing the same document updates its existing shared copy.
 */
export async function shareDocument(
  documentId: number,
  options: { published?: boolean; tags?: string[]; parentId?: number | null } = {},
  endpoint = DEFAULT_ENDPOINT,
): Promise<SharedFileItem> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ documentId, ...options }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to share this document."));
  return (await res.json()) as SharedFileItem;
}

/** Updates a shared file the user owns (rename, publish/unpublish, retag, move, edit content). */
export async function updateSharedFile(
  id: number,
  payload: SharedFilePayload,
  endpoint = DEFAULT_ENDPOINT,
): Promise<SharedFileItem> {
  const res = await fetch(`${endpoint}/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to update this shared file."));
  return (await res.json()) as SharedFileItem;
}

/** Deletes a shared file (and, for a folder, everything under it) the user owns. */
export async function deleteSharedFile(id: number, endpoint = DEFAULT_ENDPOINT): Promise<{ deleted: number }> {
  const res = await fetch(`${endpoint}/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to delete this shared file."));
  return (await res.json()) as { deleted: number };
}

/** The document created by {@link copySharedFileToDocuments}. */
export interface CopiedDocumentSummary {
  id: number;
  title: string;
}

/** Copies a shared file into the viewer's own Reason Editor documents so they can edit it. */
export async function copySharedFileToDocuments(id: number, endpoint = DEFAULT_ENDPOINT): Promise<CopiedDocumentSummary> {
  const res = await fetch(`${endpoint}/${id}/copy`, { method: "POST" });
  if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to copy this file to your documents."));
  return (await res.json()) as CopiedDocumentSummary;
}

/** Result of a `.docx`/`.zip` upload into the library. */
export interface SharedFileUploadResult {
  root: SharedFileItem;
  imported: number;
}

/** Uploads a `.docx` or a `.zip` of `.docx` files as a new shared folder. Requires a session. */
export async function uploadSharedFiles(
  file: File,
  options: { title?: string; published?: boolean } = {},
  endpoint = DEFAULT_ENDPOINT,
): Promise<SharedFileUploadResult> {
  const form = new FormData();
  form.set("file", file);
  if (options.title) form.set("title", options.title);
  if (options.published !== undefined) form.set("published", String(options.published));
  const res = await fetch(`${endpoint}/upload`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await readErrorMessage(res, "Upload failed."));
  return (await res.json()) as SharedFileUploadResult;
}
