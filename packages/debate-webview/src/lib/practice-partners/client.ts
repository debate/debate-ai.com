/**
 * @fileoverview The browser half of the Practice Partners API — the calls the
 * practice board makes, and nothing else.
 *
 * Every call returns a typed result or throws an `Error` carrying a message fit
 * to show the reader, so a component never has to inspect a `Response`. The
 * one exception is a signed-out read, which resolves to `null` instead of
 * throwing: being signed out is not a failure of the board, it is the state in
 * which the board shows a sign-in prompt.
 *
 * @module lib/practice-partners/client
 */

import type {
  ChallengeAction,
  NewChallenge,
  PracticeBoardResponse,
  PracticeChallenge,
  PracticeProfileInput,
} from "./types";

/** Where the API lives. Overridable so a host can mount it elsewhere. */
const DEFAULT_BASE_PATH = "/api/practice-partners";

export interface PracticePartnersClientOptions {
  /** Prefix for the API routes. Defaults to `/api/practice-partners`. */
  basePath?: string;
  /** Injected for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

async function errorFrom(response: Response, fallback: string): Promise<Error> {
  try {
    const payload = (await response.json()) as { error?: unknown };
    if (typeof payload?.error === "string" && payload.error.length > 0) {
      return new Error(payload.error);
    }
  } catch {
    // A non-JSON error body is not worth parsing twice; the fallback says enough.
  }
  return new Error(fallback);
}

function requester(options: PracticePartnersClientOptions | undefined) {
  const basePath = options?.basePath ?? DEFAULT_BASE_PATH;
  const doFetch = options?.fetchImpl ?? globalThis.fetch.bind(globalThis);
  return async (path: string, init: RequestInit | undefined, fallback: string): Promise<Response> => {
    const response = await doFetch(`${basePath}${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
    if (!response.ok && response.status !== 401) {
      throw await errorFrom(response, fallback);
    }
    return response;
  };
}

/** The board, or `null` when the reader is signed out. */
export async function fetchPracticeBoard(
  options: PracticePartnersClientOptions = {},
): Promise<PracticeBoardResponse | null> {
  const response = await requester(options)("", undefined, "Could not load the practice board.");
  if (response.status === 401) return null;
  return (await response.json()) as PracticeBoardResponse;
}

/** Saves the viewer's practice profile and returns it as stored. */
export async function savePracticeProfile(
  profile: PracticeProfileInput,
  options: PracticePartnersClientOptions = {},
): Promise<PracticeProfileInput> {
  const response = await requester(options)(
    "/profile",
    { method: "PUT", body: JSON.stringify(profile) },
    "Could not save your practice profile.",
  );
  if (response.status === 401) throw new Error("Sign in to volunteer for practice rounds.");
  return (await response.json()) as PracticeProfileInput;
}

/** Sends a challenge and returns it as the board will show it. */
export async function createChallenge(
  challenge: NewChallenge,
  options: PracticePartnersClientOptions = {},
): Promise<PracticeChallenge> {
  const response = await requester(options)(
    "/challenges",
    {
      method: "POST",
      body: JSON.stringify({ ...challenge, topic: challenge.topic.trim(), message: challenge.message?.trim() }),
    },
    "Could not send your challenge.",
  );
  if (response.status === 401) throw new Error("Sign in to challenge someone.");
  return (await response.json()) as PracticeChallenge;
}

/** Takes one action on a challenge and returns it as it now stands. */
export async function actOnChallenge(
  challengeId: string,
  action: ChallengeAction,
  options: PracticePartnersClientOptions = {},
): Promise<PracticeChallenge> {
  const response = await requester(options)(
    `/challenges/${encodeURIComponent(challengeId)}`,
    { method: "PATCH", body: JSON.stringify({ action }) },
    "Could not update that challenge.",
  );
  if (response.status === 401) throw new Error("Sign in to answer challenges.");
  return (await response.json()) as PracticeChallenge;
}
