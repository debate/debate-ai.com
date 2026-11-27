/**
 * @fileoverview Shapes shared by the admin Emails section's "Import existing
 * emails" action and POST/GET /api/admin/emails/lists/import: the one saved
 * list that holds every current customer, and what a preview or import reports.
 */

/** Fixed id of the saved list "Import existing emails" creates and refreshes, so re-importing never makes a second list. */
export const CURRENT_CUSTOMERS_LIST_ID = "current-customers";

export const DEFAULT_CUSTOMERS_LIST_NAME = "All current customers";

/** One place addresses were found, in the order they are merged. */
export interface CustomerSourceBreakdown {
  id: string;
  label: string;
  /** Distinct valid, still-subscribed addresses this source holds. */
  count: number;
  /** Of those, how many no earlier source already supplied. */
  added: number;
}

export interface CustomerImportReport {
  /** Addresses the list would hold. */
  total: number;
  /** Distinct addresses left out because they unsubscribed. */
  excludedUnsubscribed: number;
  /** Stored values that are not email addresses (counted, never listed). */
  invalid: number;
  sources: CustomerSourceBreakdown[];
}

export interface CustomerImportPreview extends CustomerImportReport {
  /** The list a previous import saved, if any. */
  existing: { id: string; name: string; count: number } | null;
  /** Versus `existing`: addresses a refresh would add and remove. */
  added: number;
  removed: number;
  /** The most addresses one list holds. */
  maxRecipients: number;
}
