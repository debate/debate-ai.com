/**
 * @fileoverview Following a team or school profile: the shapes `/api/follows`
 * speaks, the request validation the route runs, and the client calls the
 * profile pages and the news feed make. The table behind it is
 * `profile_follows` (see `migrations/0002_profile_follows.sql`).
 * @module lib/follows/profile-follows
 */

/** API path for follow state, following and unfollowing, and listing follows. */
export const FOLLOWS_PATH = "/api/follows"

/** What can be followed: a team (or LD debater) profile, or a school profile. */
export type FollowKind = "team" | "school"

/** One profile the viewer follows. */
export interface ProfileFollow {
  kind: FollowKind
  /** The profile's URL segment, from `teamSlug` or `profileSlug`. */
  slug: string
  /** Display name at follow time, e.g. "Harker Lee & Lin" or "Harker". */
  name: string
  /** Epoch milliseconds the follow was made. */
  followedAt: number
}

/** Follow state of one profile, as the profile header shows it. */
export interface FollowState {
  kind: FollowKind
  slug: string
  followers: number
  following: boolean
  signedIn: boolean
}

/** `GET /api/follows` with no profile named: everything the viewer follows. */
export interface FollowListResponse {
  follows: ProfileFollow[]
  signedIn: boolean
}

/** Longest slug or name the API stores. */
const MAX_SLUG_LENGTH = 160
const MAX_NAME_LENGTH = 200

/** Whether `kind` is a followable kind. */
export function isFollowKind(kind: unknown): kind is FollowKind {
  return kind === "team" || kind === "school"
}

/** Whether `slug` has the shape `profileSlug` produces: lowercase words joined by dashes. */
export function isProfileSlug(slug: unknown): slug is string {
  return typeof slug === "string" && slug.length <= MAX_SLUG_LENGTH && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
}

/** A validated follow or unfollow request. */
export type ParsedFollowBody =
  | { ok: true; kind: FollowKind; slug: string; name: string; follow: boolean }
  | { ok: false; error: string }

/**
 * Validates a `PUT /api/follows` body: `{ kind, slug, name, follow }`. `name`
 * is only needed to follow; an unfollow may omit it.
 */
export function parseFollowBody(body: unknown): ParsedFollowBody {
  if (!body || typeof body !== "object") return { ok: false, error: "Expected a JSON body." }
  const { kind, slug, name, follow } = body as Record<string, unknown>
  if (!isFollowKind(kind)) return { ok: false, error: 'kind must be "team" or "school".' }
  if (!isProfileSlug(slug)) return { ok: false, error: "slug must be a profile URL segment." }
  if (typeof follow !== "boolean") return { ok: false, error: "follow must be true or false." }
  const cleanName = typeof name === "string" ? name.trim().slice(0, MAX_NAME_LENGTH) : ""
  if (follow && !cleanName) return { ok: false, error: "name is required to follow." }
  return { ok: true, kind, slug, name: cleanName, follow }
}

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null
  if (!response.ok || !data) throw new Error(data?.error || fallback)
  return data
}

/** Follower count of a profile, and whether the viewer follows it. */
export async function fetchFollowState(
  kind: FollowKind,
  slug: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FollowState> {
  const params = new URLSearchParams({ kind, slug })
  const response = await fetchImpl(`${FOLLOWS_PATH}?${params}`, { credentials: "same-origin" })
  return readJson(response, "Couldn't load followers.")
}

/** Follows (`follow: true`) or unfollows a profile; answers with its new state. */
export async function setProfileFollow(
  target: { kind: FollowKind; slug: string; name: string },
  follow: boolean,
  fetchImpl: typeof fetch = fetch,
): Promise<FollowState> {
  const response = await fetchImpl(FOLLOWS_PATH, {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...target, follow }),
  })
  return readJson(response, follow ? "Couldn't follow." : "Couldn't unfollow.")
}

/** Every profile the viewer follows, newest first. Empty when signed out. */
export async function fetchMyFollows(fetchImpl: typeof fetch = fetch): Promise<FollowListResponse> {
  const response = await fetchImpl(FOLLOWS_PATH, { credentials: "same-origin" })
  return readJson(response, "Couldn't load your follows.")
}

/** Path of a followed profile's page. */
export function followHref(follow: Pick<ProfileFollow, "kind" | "slug">): string {
  return `/${follow.kind === "team" ? "teams" : "schools"}/${follow.slug}`
}
