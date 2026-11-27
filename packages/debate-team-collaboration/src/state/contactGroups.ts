/**
 * @fileoverview Network calls for personal contact groups ("teams") — the
 * `/api/contacts/groups` endpoint behind `ManageContactsDialog` and the share
 * dialog's group chips. Same conventions as `state/contacts.ts`: reads
 * resolve `null` when signed out or on failure, writes throw with the
 * server's `error` message so the caller can toast it.
 *
 * @module state/contactGroups
 */

/** A named set of the viewer's contacts. */
export interface ContactGroup {
  id: number;
  name: string;
  /** Account ids of the members; may include someone who has since stopped being a contact. */
  memberIds: string[];
}

const ENDPOINT = "/api/contacts/groups";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload?.error ?? fallback;
  } catch {
    return fallback;
  }
}

async function send(method: string, body: unknown, fallback: string, endpoint: string): Promise<ContactGroup | null> {
  const res = await fetch(endpoint, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, fallback));
  try {
    return ((await res.json()) as { group?: ContactGroup }).group ?? null;
  } catch {
    return null;
  }
}

/** The signed-in user's groups. `null` when signed out or on failure. */
export async function fetchContactGroups(endpoint = ENDPOINT): Promise<ContactGroup[] | null> {
  try {
    const res = await fetch(endpoint);
    if (!res.ok) return null;
    const payload = (await res.json()) as { groups?: ContactGroup[] };
    return Array.isArray(payload.groups) ? payload.groups : [];
  } catch (error) {
    console.error("Unable to load contact groups:", error);
    return null;
  }
}

export async function createContactGroup(
  input: { name: string; memberIds?: string[] },
  endpoint = ENDPOINT,
): Promise<ContactGroup | null> {
  return send("POST", input, "Could not create that group.", endpoint);
}

/** Renames a group and/or replaces its member list. */
export async function updateContactGroup(
  input: { id: number; name?: string; memberIds?: string[] },
  endpoint = ENDPOINT,
): Promise<ContactGroup | null> {
  return send("PATCH", input, "Could not update that group.", endpoint);
}

export async function deleteContactGroup(id: number, endpoint = ENDPOINT): Promise<void> {
  const res = await fetch(`${endpoint}?id=${encodeURIComponent(String(id))}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await readErrorMessage(res, "Could not delete that group."));
}
