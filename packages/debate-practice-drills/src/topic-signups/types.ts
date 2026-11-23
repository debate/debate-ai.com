/**
 * @fileoverview Wire format of Topic Sign-ups — the Practice Debates tab
 * (`/practice/debates?section=topics`) every listed resolution links to: sign
 * up to debate that topic, find partners or start / join a research squad for
 * it, and add new information (evidence, arguments, links) to its board.
 *
 * A board is keyed by the resolution's text (see `topicKey` in
 * `@debate-ai/rankings/src/topics/topic-signup-link`), so any list on the site
 * that prints the same resolution opens the same board.
 *
 * @module debate-practice-rounds/topic-signups/types
 */

/** What a sign-up offers. */
export const TOPIC_SIGNUP_ROLES = ["debate", "research"] as const
export type TopicSignupRole = (typeof TOPIC_SIGNUP_ROLES)[number]

/** Which side a debater wants. */
export const TOPIC_SIGNUP_SIDES = ["either", "aff", "neg"] as const
export type TopicSignupSide = (typeof TOPIC_SIGNUP_SIDES)[number]

/** What kind of information a note adds. */
export const TOPIC_NOTE_KINDS = ["evidence", "argument", "link", "question"] as const
export type TopicNoteKind = (typeof TOPIC_NOTE_KINDS)[number]

export const TOPIC_SIGNUP_ROLE_LABELS: Record<TopicSignupRole, string> = {
  debate: "Debate it",
  research: "Research only",
}
export const TOPIC_SIGNUP_SIDE_LABELS: Record<TopicSignupSide, string> = {
  either: "Either side",
  aff: "Aff / Pro",
  neg: "Neg / Con",
}
export const TOPIC_NOTE_KIND_LABELS: Record<TopicNoteKind, string> = {
  evidence: "Evidence",
  argument: "Argument",
  link: "Link",
  question: "Question",
}

/** Most members one research squad holds, its starter included. */
export const MAX_SQUAD_MEMBERS = 8
/** Most squads one account may start on one topic. */
export const MAX_SQUADS_PER_TOPIC = 2
/** Most notes one account may add in a day, across every topic. */
export const MAX_NOTES_PER_DAY = 40

export const MAX_NOTE_LENGTH = 2000
export const MAX_SIGNUP_NOTE_LENGTH = 280
export const MAX_SQUAD_NAME_LENGTH = 60
export const MAX_SQUAD_ABOUT_LENGTH = 280
export const MAX_NOTE_TITLE_LENGTH = 140

/** The topic a board is about. */
export interface TopicRef {
  key: string
  text: string
  format: string | null
  source: string | null
}

/** A person on the board. */
export interface TopicPerson {
  id: string
  name: string
  imageUrl: string | null
}

export interface TopicSignup {
  id: string
  person: TopicPerson
  role: TopicSignupRole
  side: TopicSignupSide
  note: string
  format: string | null
  /** Unix seconds. */
  createdAt: number
}

export interface TopicSquad {
  id: string
  name: string
  about: string
  creator: TopicPerson
  members: TopicPerson[]
  /** Whether the viewer is a member. */
  joined: boolean
  /** Unix seconds. */
  createdAt: number
}

export interface TopicNote {
  id: string
  person: TopicPerson
  kind: TopicNoteKind
  title: string
  url: string | null
  body: string
  /** Whether the viewer wrote it (and so may delete it). */
  mine: boolean
  /** Unix seconds. */
  createdAt: number
}

/** `GET /api/topic-signups?topic=…` and every write's answer. */
export interface TopicBoardResponse {
  topic: TopicRef
  viewer: TopicPerson & { isGuest: boolean }
  /** The viewer's own sign-up, when they have one. */
  mine: TopicSignup | null
  /** Everyone else signed up, newest first. */
  signups: TopicSignup[]
  squads: TopicSquad[]
  notes: TopicNote[]
}

/** One row of `GET /api/topic-signups` (no topic): the most active boards. */
export interface ActiveTopic {
  topic: TopicRef
  signups: number
  squads: number
  notes: number
  /** Unix seconds of the newest activity. */
  lastActive: number
}

export interface ActiveTopicsResponse {
  topics: ActiveTopic[]
}

/** A write to one board, `POST /api/topic-signups`. */
export type TopicAction =
  | { action: "signup"; role: TopicSignupRole; side: TopicSignupSide; note: string }
  | { action: "withdraw" }
  | { action: "create-squad"; name: string; about: string }
  | { action: "join-squad"; squadId: string }
  | { action: "leave-squad"; squadId: string }
  | { action: "add-note"; kind: TopicNoteKind; title: string; url: string | null; body: string }
  | { action: "delete-note"; noteId: string }

/** The topic fields every write carries. */
export interface TopicActionTarget {
  topic: string
  format?: string
  source?: string
}

export type TopicActionRequest = TopicActionTarget & TopicAction
