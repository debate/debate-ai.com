/**
 * Keeps credentials and personal contact details out of API responses.
 *
 * The vendored upstream routes shape most responses by hand, but several
 * repos `selectAll()` a table and a controller may pass rows through. So the
 * handler runs every JSON body through `stripPrivateFields`, which drops the
 * keys no table allows publicly (`PRIVATE_KEYS`: password hashes, room
 * passwords, phone numbers, gender) at any depth. `publicRow` applies a
 * table's full allowlist (`PUBLIC_COLUMNS`) for code that returns rows of a
 * known table.
 */
import { PRIVATE_KEYS, PUBLIC_COLUMNS } from "../db/generated/columns";

const PRIVATE = new Set(PRIVATE_KEYS);

/** A copy of `value` with every private key removed, at any depth. */
export function stripPrivateFields<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripPrivateFields) as T;
  if (value === null || typeof value !== "object" || value instanceof Date) return value;
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    if (!PRIVATE.has(key)) out[key] = stripPrivateFields(inner);
  }
  return out as T;
}

/** Only the columns of `table` its public allowlist names. */
export function publicRow<T extends Record<string, unknown>>(table: string, row: T): Partial<T> {
  const allowed = PUBLIC_COLUMNS[table];
  if (!allowed) throw new Error(`No public field allowlist for table "${table}"`);
  return Object.fromEntries(Object.entries(row).filter(([key]) => allowed.includes(key))) as Partial<T>;
}

/** `response` with `stripPrivateFields` applied to its body, when it is JSON. */
export async function withoutPrivateFields(response: Response): Promise<Response> {
  const type = response.headers.get("content-type") ?? "";
  if (!/\bjson\b/i.test(type) || !response.body) return response;
  const text = await response.text();
  let body: string;
  try {
    body = JSON.stringify(stripPrivateFields(JSON.parse(text)));
  } catch {
    body = text;
  }
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}
