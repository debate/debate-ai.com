/**
 * Ties Amplitude events and Session Replay recordings to the signed-in user.
 *
 * Amplitude only attributes a replay to a person when its own identity field
 * is set with `setUserId()` — a custom `userId` event property does not count.
 * We use the stable database `user.id` (better-auth's 32-character id), never
 * the email, so it clears Browser SDK 2's default `minIdLength` of 5.
 *
 * `setUserId()` only applies to events sent after it, so this has to run on
 * sign-in / sign-up *and* whenever an already-authenticated session is
 * restored on page load. `reset()` on sign-out gives the next visitor on the
 * same browser a fresh device id instead of inheriting this user's identity.
 */

/** The subset of the `@amplitude/unified` API the helpers use. */
export interface AmplitudeIdentityClient {
  getUserId: () => string | undefined
  setUserId: (userId: string | undefined) => void
  track: (eventInput: string) => unknown
  reset: () => void
}

/** The session user shape we read — anonymous guests have a DB id too. */
export interface IdentifiableUser {
  id?: string | number | null
  isAnonymous?: boolean | null
}

export const USER_IDENTIFIED_EVENT = "User Identified"

/**
 * Sets Amplitude's user id to `user.id`. A no-op when Amplitude already holds
 * that id (it persists it across reloads), so restoring a session doesn't send
 * a "User Identified" event on every page view.
 */
export function identifySignedInUser(client: AmplitudeIdentityClient, user: IdentifiableUser): void {
  if (user?.id == null || user.id === "") {
    throw new Error("A stable application user ID is required.")
  }
  const userId = String(user.id)
  if (client.getUserId() === userId) return
  client.setUserId(userId)
  // Verification event, sent under the new user id.
  client.track(USER_IDENTIFIED_EVENT)
}

/** Clears the identity on sign-out. A no-op for a visitor who was never identified. */
export function clearSignedInUser(client: AmplitudeIdentityClient): void {
  if (client.getUserId() === undefined) return
  client.reset()
}

/**
 * Brings Amplitude's identity in line with the current auth session: a real
 * signed-in user is identified, while a signed-out visitor or an anonymous
 * guest session is left (or put back) unidentified.
 */
export function syncAmplitudeIdentity(
  client: AmplitudeIdentityClient,
  user: IdentifiableUser | null | undefined,
): void {
  if (user && user.id != null && user.id !== "" && !user.isAnonymous) {
    identifySignedInUser(client, user)
  } else {
    clearSignedInUser(client)
  }
}
