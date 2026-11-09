/**
 * Parses the admin Emails section's "Send to a list" box: addresses separated
 * by commas, semicolons, spaces or new lines, optionally pasted as
 * `Name <address>`. Shared by the panel (to count what will be sent) and by
 * POST /api/admin/emails/send (which re-checks everything it is given).
 */

/** Most addresses one send accepts, so a send fits in one Worker request. */
export const MAX_BULK_RECIPIENTS = 500;

/** Practical address check: one `@`, no spaces, a dotted domain. */
const EMAIL_PATTERN = /^[^\s@<>(),;:"[\]]+@[^\s@<>(),;:"[\]]+\.[^\s@<>(),;:"[\]]{2,}$/;

export function isValidEmailAddress(address: string): boolean {
  return address.length <= 254 && EMAIL_PATTERN.test(address);
}

export interface ParsedRecipientList {
  /** Valid addresses, lowercased, first occurrence order, no repeats. */
  valid: string[];
  /** Entries that are not an email address, as typed. */
  invalid: string[];
  /** How many repeats of an earlier address were dropped. */
  duplicates: number;
}

export function parseRecipientList(raw: string | readonly string[]): ParsedRecipientList {
  const text = typeof raw === "string" ? raw : raw.join("\n");
  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  // `Name <a@b.co>` → `a@b.co`, before splitting on spaces breaks names apart.
  const unwrapped = text.replace(/[^,;\n<>]*<([^<>]+)>/g, (_, address: string) => ` ${address} `);
  for (const entry of unwrapped.split(/[\s,;]+/)) {
    const candidate = entry.trim().replace(/^mailto:/i, "");
    if (!candidate) continue;
    const address = candidate.toLowerCase();
    if (!isValidEmailAddress(address)) {
      invalid.push(candidate);
    } else if (seen.has(address)) {
      duplicates += 1;
    } else {
      seen.add(address);
      valid.push(address);
    }
  }
  return { valid, invalid, duplicates };
}
