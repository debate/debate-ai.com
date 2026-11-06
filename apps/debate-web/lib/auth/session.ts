import { getAuth } from "./index";
import { headers } from "next/headers";
import { describeError } from "@/lib/database/errors";

export interface AuthSession {
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
    /** better-auth organization plugin: the organization this session works in, or null for the personal workspace. */
    activeOrganizationId?: string | null;
  };
  user: {
    id: string;
    name: string;
    email: string;
    image?: string;
  };
}

/**
 * The session lookup itself failed — better-auth's `Failed to get session`,
 * usually D1 being overloaded or unreachable — so whether the caller is
 * signed in is unknown. Distinct from "signed out" on purpose: a route that
 * answers 401 here tells the client its session ended, and the account-sync
 * clients stop syncing for the rest of the visit on a 401. `withRouteErrors`
 * answers this with a 503 the client retries instead.
 */
export class SessionUnavailableError extends Error {
  constructor(cause: unknown) {
    super("Could not look up the session; try again shortly.", { cause });
    this.name = "SessionUnavailableError";
  }
}

async function lookupSession(): Promise<AuthSession | null> {
  const auth = await getAuth();
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session as AuthSession | null;
}

/**
 * The caller's session, or `null` when signed out — and also `null` when the
 * lookup fails, so a public route treats the caller as anonymous rather than
 * erroring. A route where "signed out" changes what the client does next
 * should use {@link getUserIdOrUnavailable} instead.
 */
export async function getSession(): Promise<AuthSession | null> {
  try {
    return await lookupSession();
  } catch (error) {
    console.error("Session retrieval error:", describeError(error));
    return null;
  }
}

export async function requireSession(): Promise<AuthSession> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function getUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.user?.id ?? null;
}

/**
 * The signed-in user's id, or `null` when signed out.
 *
 * @throws {SessionUnavailableError} When the session lookup itself failed, so
 *   an account-only route can answer 503 (try again) rather than 401 (signed out).
 */
export async function getUserIdOrUnavailable(): Promise<string | null> {
  let session: AuthSession | null;
  try {
    session = await lookupSession();
  } catch (error) {
    console.error("Session retrieval error:", describeError(error));
    throw new SessionUnavailableError(error);
  }
  return session?.user?.id ?? null;
}

export async function requireUserId(): Promise<string> {
  const session = await requireSession();
  return session.user.id;
}
