/**
 * @fileoverview "Import existing emails" for the admin Emails section: gathers
 * every address the app already holds for a customer (accounts, Stripe billing
 * emails), validates, lowercases and dedupes them, leaves out anyone who
 * unsubscribed, and saves the result as one list that a refresh updates in place.
 */

import { and, eq, isNotNull, sql } from "drizzle-orm";
import {
  CURRENT_CUSTOMERS_LIST_ID,
  DEFAULT_CUSTOMERS_LIST_NAME,
  type CustomerImportPreview,
  type CustomerImportReport,
  type CustomerSourceBreakdown,
} from "@debate-ai/webview/lib/admin/email-customers";
import { MAX_LIST_RECIPIENTS, isValidEmailAddress } from "@debate-ai/webview/lib/admin/email-recipients";
import { stripeSubscriptions, user } from "@/lib/database/schema";
import { EmailListError, getEmailList, upsertEmailList, validateListName, type EmailList } from "./lists";
import { type Database } from "./tables";
import { listUnsubscribedEmails } from "./unsubscribe";

/** Raw addresses one table holds, in the order they are merged into the list. */
export interface CustomerEmailSource {
  id: string;
  label: string;
  emails: ReadonlyArray<string | null | undefined>;
}

export interface CustomerImport extends CustomerImportReport {
  /** Validated, lowercased, deduplicated, still subscribed, in source order. */
  emails: string[];
}

/**
 * Merges `sources` into one address list. Earlier sources win the `added`
 * credit for an address several tables hold. Pure, so the rules are testable
 * without a database.
 */
export function buildCustomerImport(sources: readonly CustomerEmailSource[], unsubscribed: ReadonlySet<string>): CustomerImport {
  const emails: string[] = [];
  const seen = new Set<string>();
  const excluded = new Set<string>();
  let invalid = 0;
  const breakdown: CustomerSourceBreakdown[] = [];

  for (const source of sources) {
    const own = new Set<string>();
    let added = 0;
    for (const raw of source.emails) {
      if (raw === null || raw === undefined) continue;
      const address = raw.trim().toLowerCase();
      if (!address) continue;
      if (!isValidEmailAddress(address)) {
        invalid += 1;
        continue;
      }
      if (unsubscribed.has(address)) {
        excluded.add(address);
        continue;
      }
      if (own.has(address)) continue;
      own.add(address);
      if (!seen.has(address)) {
        seen.add(address);
        emails.push(address);
        added += 1;
      }
    }
    breakdown.push({ id: source.id, label: source.label, count: own.size, added });
  }

  return { emails, total: emails.length, excludedUnsubscribed: excluded.size, invalid, sources: breakdown };
}

/**
 * Reads every table that holds a customer's address. Anonymous guest accounts
 * and banned accounts are skipped. The app keeps no newsletter or waitlist
 * table, so accounts and Stripe billing emails are the whole set today; add a
 * table here and it joins the import.
 */
export async function loadCustomerEmailSources(db: Database): Promise<CustomerEmailSource[]> {
  const accounts = await db
    .select({ email: user.email })
    .from(user)
    .where(and(eq(user.isAnonymous, false), sql`coalesce(${user.banned}, 0) = 0`));
  const billing = await db
    .select({ email: stripeSubscriptions.email })
    .from(stripeSubscriptions)
    .where(isNotNull(stripeSubscriptions.email));
  return [
    { id: "accounts", label: "Registered accounts", emails: accounts.map((row: { email: string }) => row.email) },
    { id: "stripe", label: "Stripe billing emails", emails: billing.map((row: { email: string | null }) => row.email) },
  ];
}

export async function collectCustomerImport(db: Database): Promise<CustomerImport> {
  const [sources, unsubscribed] = await Promise.all([loadCustomerEmailSources(db), listUnsubscribedEmails(db)]);
  return buildCustomerImport(sources, unsubscribed);
}

/** What an import would save, against the list a previous import left. Addresses are never returned. */
export async function previewCustomerImport(db: Database): Promise<CustomerImportPreview> {
  const [found, existing] = await Promise.all([collectCustomerImport(db), getEmailList(db, CURRENT_CUSTOMERS_LIST_ID)]);
  const { emails: _emails, ...report } = found;
  const before = new Set(existing?.emails ?? []);
  const after = new Set(found.emails);
  return {
    ...report,
    existing: existing ? { id: existing.id, name: existing.name, count: existing.count } : null,
    added: found.emails.filter((email) => !before.has(email)).length,
    removed: [...before].filter((email) => !after.has(email)).length,
    maxRecipients: MAX_LIST_RECIPIENTS,
  };
}

/**
 * Saves the customers list, creating it or replacing the previous import's
 * addresses (so a refresh drops people who have since unsubscribed or left).
 * `name` renames it; without one the existing name is kept.
 */
export async function importCustomerList(
  db: Database,
  input: { name?: unknown },
  updatedBy: string | null,
): Promise<{ list: EmailList; report: CustomerImportReport }> {
  const existing = await getEmailList(db, CURRENT_CUSTOMERS_LIST_ID);
  const name = validateListName(
    typeof input.name === "string" && input.name.trim() ? input.name : (existing?.name ?? DEFAULT_CUSTOMERS_LIST_NAME),
  );
  const found = await collectCustomerImport(db);
  if (found.emails.length === 0) throw new EmailListError("No subscribed customer emails were found to import.");
  if (found.emails.length > MAX_LIST_RECIPIENTS) {
    throw new EmailListError(`A list holds at most ${MAX_LIST_RECIPIENTS} addresses (found ${found.emails.length}).`);
  }
  const list = await upsertEmailList(db, { id: CURRENT_CUSTOMERS_LIST_ID, name, emails: found.emails }, updatedBy);
  const { emails: _emails, ...report } = found;
  return { list, report };
}
