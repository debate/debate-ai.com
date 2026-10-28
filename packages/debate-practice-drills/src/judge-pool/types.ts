/**
 * @fileoverview The Judge Pool wire format — what `/api/judge-pool` sends and
 * what the "Volunteer as a judge" and "Hire a judge" blocks read.
 *
 * ## What the feature is made of
 *
 * - A **listing**, one per account: a judge offering to be hired for
 *   tournament weekends. It names up to {@link MAX_JUDGE_WEEKENDS} upcoming
 *   weekends from the circuit calendar (`./season-calendar.ts`), the states
 *   the judge is in, whether they will travel, the formats they judge, and
 *   their judge philosophy (paradigm). Switching it off hides it without
 *   forgetting it, the same rule as a practice profile.
 * - A **hire request**: a tournament organizer asking one listed judge to
 *   judge their tournament on one of the judge's weekends, with what they
 *   offer to pay. The judge accepts or declines; either side can call it off.
 *
 * Payment does not go through the site yet — {@link JudgePoolResponse.paymentsConnected}
 * is always `false` and the UI says to settle pay directly once a request is
 * accepted. The offer is a line of text, not a charge.
 *
 * @module debate-practice-rounds/judge-pool/types
 */

import type { PracticeFormat, PracticePerson } from "../practice-partners/types";

/** US states plus DC, by postal code. */
export const US_STATES = [
  { id: "AL", label: "Alabama" },
  { id: "AK", label: "Alaska" },
  { id: "AZ", label: "Arizona" },
  { id: "AR", label: "Arkansas" },
  { id: "CA", label: "California" },
  { id: "CO", label: "Colorado" },
  { id: "CT", label: "Connecticut" },
  { id: "DE", label: "Delaware" },
  { id: "DC", label: "District of Columbia" },
  { id: "FL", label: "Florida" },
  { id: "GA", label: "Georgia" },
  { id: "HI", label: "Hawaii" },
  { id: "ID", label: "Idaho" },
  { id: "IL", label: "Illinois" },
  { id: "IN", label: "Indiana" },
  { id: "IA", label: "Iowa" },
  { id: "KS", label: "Kansas" },
  { id: "KY", label: "Kentucky" },
  { id: "LA", label: "Louisiana" },
  { id: "ME", label: "Maine" },
  { id: "MD", label: "Maryland" },
  { id: "MA", label: "Massachusetts" },
  { id: "MI", label: "Michigan" },
  { id: "MN", label: "Minnesota" },
  { id: "MS", label: "Mississippi" },
  { id: "MO", label: "Missouri" },
  { id: "MT", label: "Montana" },
  { id: "NE", label: "Nebraska" },
  { id: "NV", label: "Nevada" },
  { id: "NH", label: "New Hampshire" },
  { id: "NJ", label: "New Jersey" },
  { id: "NM", label: "New Mexico" },
  { id: "NY", label: "New York" },
  { id: "NC", label: "North Carolina" },
  { id: "ND", label: "North Dakota" },
  { id: "OH", label: "Ohio" },
  { id: "OK", label: "Oklahoma" },
  { id: "OR", label: "Oregon" },
  { id: "PA", label: "Pennsylvania" },
  { id: "RI", label: "Rhode Island" },
  { id: "SC", label: "South Carolina" },
  { id: "SD", label: "South Dakota" },
  { id: "TN", label: "Tennessee" },
  { id: "TX", label: "Texas" },
  { id: "UT", label: "Utah" },
  { id: "VT", label: "Vermont" },
  { id: "VA", label: "Virginia" },
  { id: "WA", label: "Washington" },
  { id: "WV", label: "West Virginia" },
  { id: "WI", label: "Wisconsin" },
  { id: "WY", label: "Wyoming" },
] as const;

export type UsState = (typeof US_STATES)[number]["id"];

/** How many upcoming weekends a judge may offer at once. */
export const MAX_JUDGE_WEEKENDS = 3;
/** How many states a judge may list. */
export const MAX_JUDGE_STATES = 5;
/** The longest a judge philosophy may be, in characters. */
export const MAX_PHILOSOPHY_LENGTH = 4000;
/** The longest a tournament name on a hire request may be. */
export const MAX_TOURNAMENT_NAME_LENGTH = 120;
/** The longest the pay offer line may be ("$250 + hotel"). */
export const MAX_OFFER_LENGTH = 80;
/** The longest a hire request's message may be. */
export const MAX_HIRE_MESSAGE_LENGTH = 1000;
/**
 * How many hire requests one organizer may have waiting on an answer. Every
 * request is a notification to a judge, so this keeps one account from
 * spamming the whole pool.
 */
export const MAX_PENDING_HIRES = 20;

/** A judge's listing as its owner edits it. */
export interface JudgeListingInput {
  /** Listed in the pool and open to hire requests. */
  active: boolean;
  /** Saturday ISO keys of up to three upcoming season weekends. */
  weekends: string[];
  /** Postal codes of the states the judge is in. */
  states: UsState[];
  /** Willing to travel to a tournament outside those states. */
  canTravel: boolean;
  formats: PracticeFormat[];
  /** Free text: the judge's paradigm. */
  philosophy: string;
}

/** The listing a judge starts from before they have saved one. */
export const DEFAULT_JUDGE_LISTING: JudgeListingInput = {
  active: true,
  weekends: [],
  states: [],
  canTravel: false,
  formats: [],
  philosophy: "",
};

/** One judge in the pool, as an organizer sees them. */
export interface JudgePoolEntry extends JudgeListingInput {
  judge: PracticePerson;
  /** Unix seconds — when the listing was last saved. */
  updatedAt: number;
}

/**
 * Where a hire request is. `pending` → `accepted` | `declined` by the judge,
 * or `cancelled` by the organizer; an accepted request can still be
 * `cancelled` by either side. `declined` and `cancelled` are final.
 */
export type HireStatus = "pending" | "accepted" | "declined" | "cancelled";

export type HireAction = "accept" | "decline" | "cancel";

/** A hire request as either side sees it. */
export interface JudgeHireRequest {
  id: string;
  status: HireStatus;
  organizer: PracticePerson;
  judge: PracticePerson;
  tournamentName: string;
  /** Saturday ISO key of the weekend asked for. */
  weekend: string;
  /** What the organizer offers to pay, as they wrote it. */
  offer: string;
  message: string;
  /** Unix seconds. */
  createdAt: number;
  /** Unix seconds. */
  updatedAt: number;
}

/** A new hire request as the browser sends it. */
export interface NewHireRequest {
  judgeId: string;
  tournamentName: string;
  weekend: string;
  offer: string;
  message: string;
}

/** What `GET /api/judge-pool` returns. */
export interface JudgePoolResponse {
  viewer: PracticePerson;
  /** The viewer's own listing, or `null` before they have saved one. */
  listing: JudgeListingInput | null;
  /** Active listings with at least one upcoming weekend, the viewer's own excluded. */
  pool: JudgePoolEntry[];
  /** Hire requests the viewer sent or received, newest first. */
  hires: JudgeHireRequest[];
  /** Whether hiring takes payment on the site. Not yet. */
  paymentsConnected: false;
}
