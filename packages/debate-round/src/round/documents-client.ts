/**
 * @fileoverview Network calls for the Reason Editor's per-user documents
 * (`/api/doc/documents` in `apps/debate-ai.com`), so `/library`'s Documents
 * tab and the editor itself share one client instead of each hand-rolling
 * `fetch` calls. Mirrors `round/saved-flows-client.ts`'s conventions.
 *
 * The documents route has an anonymous mode (signed out, it reads/writes
 * rows with no owner), so nothing here treats a `401` specially.
 *
 * @module round/documents-client
 */

/** One row of `documents` as the routes return it. */
export interface DocumentRecord {
  id: number;
  title: string;
  content: string;
  parentId: number | null;
  isFolder: boolean;
  updatedAt: string | number;
}

const DEFAULT_ENDPOINT = "/api/doc/documents";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload?.error ?? fallback;
  } catch {
    return fallback;
  }
}

/** Lists the current user's documents and folders, newest first. */
export async function listDocuments(endpoint = DEFAULT_ENDPOINT): Promise<DocumentRecord[]> {
  const res = await fetch(endpoint);
  if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to load your documents."));
  return (await res.json()) as DocumentRecord[];
}

/** Fetches one document with its content. `null` when missing or not the viewer's. */
export async function fetchDocument(id: number, endpoint = DEFAULT_ENDPOINT): Promise<DocumentRecord | null> {
  const res = await fetch(`${endpoint}/${id}`);
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to load this document."));
  return (await res.json()) as DocumentRecord;
}

export interface CreateDocumentInput {
  title?: string;
  content?: string;
  parentId?: number | null;
  isFolder?: boolean;
}

/** Creates a document or folder. */
export async function createDocument(input: CreateDocumentInput = {}, endpoint = DEFAULT_ENDPOINT): Promise<DocumentRecord> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to create the document."));
  return (await res.json()) as DocumentRecord;
}

/** Renames, moves, or rewrites a document. */
export async function updateDocument(
  id: number,
  patch: { title?: string; content?: string; parentId?: number | null },
  endpoint = DEFAULT_ENDPOINT,
): Promise<DocumentRecord> {
  const res = await fetch(`${endpoint}/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to update the document."));
  return (await res.json()) as DocumentRecord;
}

/** Deletes one document row. Folders don't cascade server-side — see {@link deleteDocumentTree}. */
export async function deleteDocument(id: number, endpoint = DEFAULT_ENDPOINT): Promise<void> {
  const res = await fetch(`${endpoint}/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to delete the document."));
}

/** Every id under (and including) `rootId` in a flat document list — what deleting a folder must remove. */
export function collectDocumentDescendantIds(
  documents: readonly Pick<DocumentRecord, "id" | "parentId">[],
  rootId: number,
): number[] {
  const byParent = new Map<number, number[]>();
  for (const doc of documents) {
    if (doc.parentId === null) continue;
    byParent.set(doc.parentId, [...(byParent.get(doc.parentId) ?? []), doc.id]);
  }
  const result: number[] = [];
  const seen = new Set<number>();
  const visit = (id: number) => {
    if (seen.has(id)) return;
    seen.add(id);
    result.push(id);
    for (const child of byParent.get(id) ?? []) visit(child);
  };
  visit(rootId);
  return result;
}

/** Deletes a document and, when it's a folder, everything inside it. Returns the deleted ids. */
export async function deleteDocumentTree(
  documents: readonly Pick<DocumentRecord, "id" | "parentId">[],
  rootId: number,
  endpoint = DEFAULT_ENDPOINT,
): Promise<number[]> {
  const ids = collectDocumentDescendantIds(documents, rootId);
  await Promise.all(ids.map((id) => deleteDocument(id, endpoint)));
  return ids;
}

/** The title a duplicate gets: "Title (copy)", then "Title (copy 2)", … avoiding names already in use. */
export function duplicateDocumentTitle(title: string, existingTitles: readonly string[]): string {
  const base = title.trim() || "Untitled";
  const taken = new Set(existingTitles.map((t) => t.trim()));
  let candidate = `${base} (copy)`;
  let n = 2;
  while (taken.has(candidate)) candidate = `${base} (copy ${n++})`;
  return candidate;
}

/** Copies a document (content included) into the same folder under a "(copy)" title. */
export async function duplicateDocument(
  id: number,
  existing: readonly Pick<DocumentRecord, "title">[],
  endpoint = DEFAULT_ENDPOINT,
): Promise<DocumentRecord> {
  const source = await fetchDocument(id, endpoint);
  if (!source) throw new Error("That document no longer exists.");
  return createDocument(
    {
      title: duplicateDocumentTitle(source.title, existing.map((doc) => doc.title)),
      content: source.content,
      parentId: source.parentId,
      isFolder: false,
    },
    endpoint,
  );
}
