/**
 * @fileoverview Research publishers and the publication details of a file.
 *
 * A research publisher is a named research group — a team, a camp lab, a
 * coach's squad — with its own page at `/research/publishers/<slug>`. Its
 * owner lists the students in the group, the seasons it has published, and a
 * monthly subscription price (free, or 50¢–$500). Readers subscribe from the
 * publisher's page: a paid subscription moves one month's price from the
 * reader's wallet to the owner's, and while it lasts the reader can save a
 * copy of any file the publisher has published.
 *
 * Each file of the owner's can carry publication details: who wrote it, the
 * publisher it is published under, the research group and student authors,
 * the seasons it covers and the date it was published. The editor sidebar
 * shows them in a small note under the file tree, with a link to the
 * publisher's page.
 *
 * Pure code only: request parsing, limits and wire types. The tables and
 * routes are in `apps/debate-web` (`lib/market/publishers.ts`,
 * `app/api/market/publishers`).
 *
 * @module debate-file-market/publishers
 */

import { formatCents, MAX_PRICE_CENTS, MIN_PRICE_CENTS, type Parsed } from "./pricing";

/** How long one paid month of a subscription lasts. */
export const SUBSCRIPTION_PERIOD_DAYS = 30;
/** Longest publisher or group name. */
export const MAX_NAME_LENGTH = 80;
/** Longest publisher description or file summary. */
export const MAX_DESCRIPTION_LENGTH = 2000;
/** Most student names on one publisher or file. */
export const MAX_STUDENTS = 40;
/** Longest single student name. */
export const MAX_STUDENT_LENGTH = 80;

/** Who publishes research: a research group with a page and a subscription. */
export interface ResearchPublisher {
  id: string;
  /** The URL segment of its page. */
  slug: string;
  name: string;
  description: string;
  /** The research group (team, school, lab) behind it. */
  researchGroup: string;
  /** Student names in the group. */
  students: string[];
  /** Seasons published, free text such as `"2024–2026"`. */
  years: string;
  /** A link of the publisher's own, or empty. */
  website: string;
  /** Monthly price in cents; 0 means subscribing is free. */
  priceCents: number;
  owner: { id: string; name: string; image: string | null };
  subscribers: number;
  /** ISO timestamp. */
  createdAt: string;
}

/** The viewer's own subscription to a publisher. */
export interface PublisherSubscription {
  /** ISO timestamp the paid month ends. */
  expiresAt: string;
  active: boolean;
}

/** One file listed on a publisher's page — its details, never its cards. */
export interface PublishedFile {
  documentId: number;
  title: string;
  author: string | null;
  researchGroup: string;
  students: string[];
  years: string;
  /** `YYYY-MM-DD`, or empty. */
  publishedOn: string;
  summary: string;
  quoteCount: number | null;
  pageCount: number | null;
}

/** `GET /api/market/publishers/<slug>` — a publisher's page. */
export interface PublisherPageResponse {
  publisher: ResearchPublisher;
  files: PublishedFile[];
  /** `null` signed out or never subscribed. */
  subscription: PublisherSubscription | null;
  isOwner: boolean;
  /** `null` signed out or on a guest account. */
  wallet: { balanceCents: number } | null;
}

/** `POST /api/market/publishers` and `PUT …/<slug>` — create or edit one. */
export interface PublisherRequest {
  name: string;
  description: string;
  researchGroup: string;
  students: string[];
  years: string;
  website: string;
  priceCents: number;
}

/** The publication details of one file, as the metadata dialog edits them. */
export interface FileMetadata {
  author: string;
  /** The publisher it is published under, or `null`. */
  publisherId: string | null;
  researchGroup: string;
  students: string[];
  years: string;
  /** `YYYY-MM-DD`, or empty. */
  publishedOn: string;
  summary: string;
}

/** A publisher as the file note and the publisher picker show it. */
export interface PublisherSummary {
  id: string;
  slug: string;
  name: string;
  priceCents: number;
}

/** `GET /api/doc/documents/<id>/metadata` — a file's details. */
export interface FileMetadataResponse {
  metadata: FileMetadata;
  /** The publisher it is published under, when there is one. */
  publisher: PublisherSummary | null;
  /** The publishers the viewer owns, for the dialog's picker. */
  ownPublishers: PublisherSummary[];
  /** Whether the viewer may edit these details (the file's owner). */
  canEdit: boolean;
}

/** Where a publisher's page lives. */
export function publisherHref(slug: string): string {
  return `/research/publishers/${encodeURIComponent(slug)}`;
}

/** A URL segment for a publisher name: lowercase words joined by hyphens. */
export function publisherSlug(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || "publisher";
}

/** Splits typed student names (one per line, or comma-separated) into a clean list. */
export function parseStudentList(input: string): string[] {
  return cleanStudents(input.split(/[\n,;]+/));
}

function cleanStudents(values: unknown[]): string[] {
  const seen = new Set<string>();
  const students: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const name = value.replace(/\s+/g, " ").trim().slice(0, MAX_STUDENT_LENGTH);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    students.push(name);
    if (students.length >= MAX_STUDENTS) break;
  }
  return students;
}

/** Reads a stored JSON student list, tolerating anything malformed. */
export function readStudents(stored: string | null | undefined): string[] {
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? cleanStudents(parsed) : [];
  } catch {
    return [];
  }
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** A subscription price: free (0), or within the market's price limits. */
export function validateSubscriptionPrice(value: unknown): Parsed<number> {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return { ok: false, error: "Set a monthly price in whole cents, or 0 for free." };
  }
  if (value === 0) return { ok: true, value };
  if (value < MIN_PRICE_CENTS) {
    return { ok: false, error: `A paid subscription is at least ${formatCents(MIN_PRICE_CENTS)} a month.` };
  }
  if (value > MAX_PRICE_CENTS) {
    return { ok: false, error: `The highest monthly price is ${formatCents(MAX_PRICE_CENTS)}.` };
  }
  return { ok: true, value };
}

/** Validates the body of a create or edit publisher request. */
export function parsePublisherRequest(payload: unknown): Parsed<PublisherRequest> {
  if (!payload || typeof payload !== "object") return { ok: false, error: "Invalid request." };
  const body = payload as Record<string, unknown>;
  const name = text(body.name, MAX_NAME_LENGTH);
  if (!name) return { ok: false, error: "Give the publisher a name." };
  const price = validateSubscriptionPrice(body.priceCents ?? 0);
  if (!price.ok) return price;
  const website = text(body.website, 300);
  if (website && !/^https?:\/\//i.test(website)) {
    return { ok: false, error: "The website must start with http:// or https://." };
  }
  return {
    ok: true,
    value: {
      name,
      description: text(body.description, MAX_DESCRIPTION_LENGTH),
      researchGroup: text(body.researchGroup, MAX_NAME_LENGTH),
      students: Array.isArray(body.students) ? cleanStudents(body.students) : [],
      years: text(body.years, 40),
      website,
      priceCents: price.value,
    },
  };
}

/** Validates the body of `PUT /api/doc/documents/<id>/metadata`. */
export function parseFileMetadata(payload: unknown): Parsed<FileMetadata> {
  if (!payload || typeof payload !== "object") return { ok: false, error: "Invalid request." };
  const body = payload as Record<string, unknown>;
  const publishedOn = text(body.publishedOn, 10);
  if (publishedOn && !isIsoDate(publishedOn)) {
    return { ok: false, error: "Use a full date for the publication date." };
  }
  const publisherId = body.publisherId;
  if (publisherId !== null && publisherId !== undefined && (typeof publisherId !== "string" || !publisherId)) {
    return { ok: false, error: "Pick a publisher from the list." };
  }
  return {
    ok: true,
    value: {
      author: text(body.author, MAX_NAME_LENGTH),
      publisherId: typeof publisherId === "string" ? publisherId : null,
      researchGroup: text(body.researchGroup, MAX_NAME_LENGTH),
      students: Array.isArray(body.students) ? cleanStudents(body.students) : [],
      years: text(body.years, 40),
      publishedOn,
      summary: text(body.summary, MAX_DESCRIPTION_LENGTH),
    },
  };
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** When a subscription paid at `from` ends. */
export function subscriptionEnd(from: Date): Date {
  return new Date(from.getTime() + SUBSCRIPTION_PERIOD_DAYS * 24 * 60 * 60 * 1000);
}

/** `"$5.00 / month"`, or `"Free"`. */
export function formatSubscriptionPrice(priceCents: number): string {
  return priceCents > 0 ? `${formatCents(priceCents)} / month` : "Free";
}
