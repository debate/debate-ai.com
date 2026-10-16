/**
 * @fileoverview The recording release: what a signed-in user lets the site
 * publish of their recorded speeches and webcam video, and how they are
 * credited on it.
 *
 * Settings → Privacy (`components/settings/PrivacySettingsSection.tsx`)
 * edits it, `/api/settings/privacy` stores it as JSON in
 * `user_settings.recording_privacy`, and anything that publishes a
 * recording reads it back and asks this module what it may do:
 *
 * - `mayPublishRecording` — nothing is published until the user has
 *   agreed to the current release text.
 * - `includeVideo` — false when the user chose audio only, so a publisher
 *   keeps the audio track and drops the camera.
 * - `publicCreditName` — the name to show beside a published recording:
 *   "Anonymous contributor", their chosen username, or their real name
 *   in full or as first name plus last initial.
 *
 * Pure and storage-free, so the API route, the settings UI and any
 * publisher share one validator and one set of rules.
 *
 * @module lib/privacy/recording-release
 */

/**
 * Bumped whenever `RECORDING_RELEASE_PARAGRAPHS` changes in substance, so an
 * agreement given to older wording no longer counts (`mayPublishRecording`).
 */
export const RECORDING_RELEASE_VERSION = 1

/**
 * The release a user agrees to before anything they record is published.
 *
 * Plain-language placeholder wording: it has not been reviewed by a lawyer
 * and must be before it is relied on.
 */
export const RECORDING_RELEASE_PARAGRAPHS: readonly string[] = [
  "When you record a speech, practice round or webcam session on Debate AI, you can choose to let us publish it so other debaters can learn from it. Publishing is off until you agree below, and you can change or withdraw your choice here at any time.",
  "By agreeing, you give Debate AI a non-exclusive, royalty-free permission to host, stream, transcribe, clip and display the recordings you choose to publish, on this site and in its apps, for educational purposes. You keep the rights to your own speeches; this release only lets us share them as you set out on this page.",
  "You choose how much of you is shown: audio and video, or audio only with your camera left out, and whether you are credited as an anonymous contributor, by a username, or by your real name (in full, or first name and last initial). These choices apply to everything you publish from now on.",
  "If you are under 18, please agree only with a parent's or guardian's permission. You can withdraw this release, or ask us to delete some or all of your data, at any time from this page. Withdrawing stops new publishing; recordings already published are taken down when you ask us to delete them.",
]

/** Whether recordings may be published at all. */
export type RecordingRelease = "not-released" | "released"
/** Which tracks of a published recording are shown. */
export type RecordingMedia = "audio-video" | "audio-only"
/** How the user is named beside a published recording. */
export type RecordingCredit = "anonymous" | "username" | "real-name"
/** How much of a real name is shown when credit is `real-name`. */
export type RealNameFormat = "full" | "first-initial"

/** A user's recording release and credit choices. */
export interface RecordingPrivacy {
  /** `released` only once the user has agreed to the release text. */
  release: RecordingRelease
  /** Publish audio and video, or audio only (camera hidden). */
  media: RecordingMedia
  /** Anonymous contributor, a username, or the real name. */
  credit: RecordingCredit
  /** Full real name, or first name plus last initial. */
  realNameFormat: RealNameFormat
  /** The public username shown when `credit` is `username`. */
  username: string
  /** The `RECORDING_RELEASE_VERSION` the user agreed to, or null. */
  releaseVersion: number | null
  /** ISO time the user agreed, or null. */
  releasedAt: string | null
}

/** Nothing published, audio and video, anonymous: the most private choices. */
export const DEFAULT_RECORDING_PRIVACY: RecordingPrivacy = {
  release: "not-released",
  media: "audio-video",
  credit: "anonymous",
  realNameFormat: "first-initial",
  username: "",
  releaseVersion: null,
  releasedAt: null,
}

export const RECORDING_RELEASES: readonly RecordingRelease[] = ["not-released", "released"]
export const RECORDING_MEDIA: readonly RecordingMedia[] = ["audio-video", "audio-only"]
export const RECORDING_CREDITS: readonly RecordingCredit[] = ["anonymous", "username", "real-name"]
export const REAL_NAME_FORMATS: readonly RealNameFormat[] = ["full", "first-initial"]

/** Longest username accepted. */
export const MAX_USERNAME_LENGTH = 40
const USERNAME_RE = /^[\p{L}\p{N}_.\- ]*$/u

const ANONYMOUS_LABEL = "Anonymous contributor"

const oneOf = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (values as readonly string[]).includes(value)

/**
 * Reads a stored value back, falling back to the defaults field by field so
 * a malformed or partial row never widens what is published.
 */
export function parseRecordingPrivacy(raw: unknown): RecordingPrivacy {
  let value = raw
  if (typeof value === "string") {
    try {
      value = JSON.parse(value)
    } catch {
      return { ...DEFAULT_RECORDING_PRIVACY }
    }
  }
  if (!value || typeof value !== "object") return { ...DEFAULT_RECORDING_PRIVACY }
  const v = value as Record<string, unknown>
  const d = DEFAULT_RECORDING_PRIVACY
  const username = typeof v.username === "string" ? v.username.trim().slice(0, MAX_USERNAME_LENGTH) : d.username
  return {
    release: oneOf(RECORDING_RELEASES, v.release) ? v.release : d.release,
    media: oneOf(RECORDING_MEDIA, v.media) ? v.media : d.media,
    credit: oneOf(RECORDING_CREDITS, v.credit) ? v.credit : d.credit,
    realNameFormat: oneOf(REAL_NAME_FORMATS, v.realNameFormat) ? v.realNameFormat : d.realNameFormat,
    username: USERNAME_RE.test(username) ? username : d.username,
    releaseVersion: typeof v.releaseVersion === "number" && Number.isInteger(v.releaseVersion) ? v.releaseVersion : null,
    releasedAt: typeof v.releasedAt === "string" && !Number.isNaN(Date.parse(v.releasedAt)) ? v.releasedAt : null,
  }
}

/**
 * Validates a save from the settings tab. Returns the value to store, or the
 * reasons it was refused. Agreeing stamps the current release version and
 * time; withdrawing clears them.
 */
export function validateRecordingPrivacyPatch(
  body: unknown,
  previous: RecordingPrivacy,
  now: Date = new Date(),
): { value: RecordingPrivacy; errors: string[] } {
  const errors: string[] = []
  if (!body || typeof body !== "object") return { value: previous, errors: ["Expected a JSON object."] }
  const b = body as Record<string, unknown>
  const next: RecordingPrivacy = { ...previous }

  if (b.release !== undefined) {
    if (oneOf(RECORDING_RELEASES, b.release)) next.release = b.release
    else errors.push(`release must be one of ${RECORDING_RELEASES.join(", ")}.`)
  }
  if (b.media !== undefined) {
    if (oneOf(RECORDING_MEDIA, b.media)) next.media = b.media
    else errors.push(`media must be one of ${RECORDING_MEDIA.join(", ")}.`)
  }
  if (b.credit !== undefined) {
    if (oneOf(RECORDING_CREDITS, b.credit)) next.credit = b.credit
    else errors.push(`credit must be one of ${RECORDING_CREDITS.join(", ")}.`)
  }
  if (b.realNameFormat !== undefined) {
    if (oneOf(REAL_NAME_FORMATS, b.realNameFormat)) next.realNameFormat = b.realNameFormat
    else errors.push(`realNameFormat must be one of ${REAL_NAME_FORMATS.join(", ")}.`)
  }
  if (b.username !== undefined) {
    const username = typeof b.username === "string" ? b.username.trim() : null
    if (username === null || username.length > MAX_USERNAME_LENGTH || !USERNAME_RE.test(username)) {
      errors.push(`username must be up to ${MAX_USERNAME_LENGTH} letters, numbers, spaces, dots, dashes or underscores.`)
    } else {
      next.username = username
    }
  }
  if (next.credit === "username" && !next.username) {
    errors.push("Choose a username to be credited by it.")
  }

  if (next.release === "released") {
    if (previous.release !== "released" || previous.releaseVersion !== RECORDING_RELEASE_VERSION) {
      next.releaseVersion = RECORDING_RELEASE_VERSION
      next.releasedAt = now.toISOString()
    }
  } else {
    next.releaseVersion = null
    next.releasedAt = null
  }

  return { value: next, errors }
}

/** Whether the user has agreed to the current release text. */
export function mayPublishRecording(privacy: RecordingPrivacy): boolean {
  return privacy.release === "released" && privacy.releaseVersion === RECORDING_RELEASE_VERSION
}

/** Whether a published recording may include the user's video. */
export function includeVideo(privacy: RecordingPrivacy): boolean {
  return privacy.media === "audio-video"
}

/** "Ada Lovelace" → "Ada L." — a single word is shown as is. */
export function firstNameAndInitial(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ""
  if (parts.length === 1) return parts[0]!
  const last = parts[parts.length - 1]!
  return `${parts[0]} ${Array.from(last)[0]!.toUpperCase()}.`
}

/**
 * The name to show beside a published recording. Falls back to
 * "Anonymous contributor" whenever the chosen credit has nothing to show,
 * never to a name the user did not pick.
 */
export function publicCreditName(privacy: RecordingPrivacy, account: { name?: string | null }): string {
  if (privacy.credit === "username") return privacy.username || ANONYMOUS_LABEL
  if (privacy.credit === "real-name") {
    const name = (account.name ?? "").trim()
    if (!name) return ANONYMOUS_LABEL
    return privacy.realNameFormat === "full" ? name : firstNameAndInitial(name)
  }
  return ANONYMOUS_LABEL
}

/** What a deletion request covers. */
export type DeletionScope = "all" | "part"
export const DELETION_SCOPES: readonly DeletionScope[] = ["all", "part"]

/** The kinds of data a partial deletion can name. */
export const DELETION_CATEGORIES = [
  { id: "recordings", label: "Published recordings and video" },
  { id: "speech-audio", label: "Saved speech audio" },
  { id: "flows", label: "Flows and round data" },
  { id: "documents", label: "Documents, cards and research" },
  { id: "comments", label: "Comments and forum posts" },
  { id: "account", label: "Account profile and settings" },
] as const
export type DeletionCategory = (typeof DELETION_CATEGORIES)[number]["id"]

/** Longest free-text deletion note accepted. */
export const MAX_DELETION_DETAILS_LENGTH = 4000

/** A validated deletion request, ready to store. */
export interface DeletionRequestInput {
  scope: DeletionScope
  categories: DeletionCategory[]
  details: string
}

/**
 * Validates a deletion request: everything, or a part named by categories
 * and/or the free-text box of suggested deletions.
 */
export function validateDeletionRequest(body: unknown): { value: DeletionRequestInput | null; errors: string[] } {
  if (!body || typeof body !== "object") return { value: null, errors: ["Expected a JSON object."] }
  const b = body as Record<string, unknown>
  const errors: string[] = []
  if (!oneOf(DELETION_SCOPES, b.scope)) errors.push(`scope must be one of ${DELETION_SCOPES.join(", ")}.`)
  const ids = DELETION_CATEGORIES.map((c) => c.id) as readonly string[]
  const rawCategories = b.categories === undefined ? [] : b.categories
  const categories = Array.isArray(rawCategories)
    ? [...new Set(rawCategories.filter((c): c is DeletionCategory => typeof c === "string" && ids.includes(c)))]
    : null
  if (categories === null || (Array.isArray(rawCategories) && categories.length !== new Set(rawCategories).size)) {
    errors.push(`categories must be a list of ${ids.join(", ")}.`)
  }
  const details = typeof b.details === "string" ? b.details.trim() : b.details === undefined ? "" : null
  if (details === null) errors.push("details must be text.")
  else if (details.length > MAX_DELETION_DETAILS_LENGTH) {
    errors.push(`details must be at most ${MAX_DELETION_DETAILS_LENGTH} characters.`)
  }
  if (errors.length === 0 && b.scope === "part" && categories!.length === 0 && !details) {
    errors.push("Pick what to delete, or describe it in the box.")
  }
  if (errors.length > 0) return { value: null, errors }
  return {
    value: { scope: b.scope as DeletionScope, categories: b.scope === "all" ? [] : categories!, details: details! },
    errors,
  }
}
