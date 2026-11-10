/**
 * @fileoverview The browser half of the Online Challenges API. Every call
 * returns a typed result or throws an `Error` whose message is fit to show; a
 * signed-out board read resolves to `null` instead (the board then asks the
 * reader to sign in).
 *
 * @module debate-practice-rounds/debate-challenges/client
 */

import type {
  ChallengeBoardResponse,
  ChallengePerson,
  DebateChallenge,
  DebateChallengeUpdate,
  NewDebateChallenge,
} from "./types";

const DEFAULT_BASE_PATH = "/api/debate-challenges";

export interface ChallengesClientOptions {
  basePath?: string;
  /** Injected for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

async function errorFrom(response: Response, fallback: string): Promise<Error> {
  try {
    const payload = (await response.json()) as { error?: unknown };
    if (typeof payload?.error === "string" && payload.error) return new Error(payload.error);
  } catch {
    // Not JSON; the fallback says enough.
  }
  return new Error(fallback);
}

function doFetch(options: ChallengesClientOptions | undefined): typeof fetch {
  return options?.fetchImpl ?? globalThis.fetch.bind(globalThis);
}

/** The board, or `null` when signed out. */
export async function fetchChallengeBoard(options: ChallengesClientOptions = {}): Promise<ChallengeBoardResponse | null> {
  const response = await doFetch(options)(options.basePath ?? DEFAULT_BASE_PATH);
  if (response.status === 401) return null;
  if (!response.ok) throw await errorFrom(response, "Could not load your challenges.");
  return (await response.json()) as ChallengeBoardResponse;
}

/** Sends a challenge and returns it as the board shows it. */
export async function sendDebateChallenge(
  challenge: NewDebateChallenge,
  options: ChallengesClientOptions = {},
): Promise<DebateChallenge> {
  const response = await doFetch(options)(options.basePath ?? DEFAULT_BASE_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(challenge),
  });
  if (!response.ok) throw await errorFrom(response, "Could not send the challenge.");
  return ((await response.json()) as { challenge: DebateChallenge }).challenge;
}

/** Makes one move on a challenge (or collects its reward) and returns it updated. */
export async function updateDebateChallenge(
  id: string,
  update: DebateChallengeUpdate,
  options: ChallengesClientOptions = {},
): Promise<DebateChallenge> {
  const response = await doFetch(options)(`${options.basePath ?? DEFAULT_BASE_PATH}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  if (!response.ok) throw await errorFrom(response, "Could not update the challenge.");
  return ((await response.json()) as { challenge: DebateChallenge }).challenge;
}

/** Registered players whose name matches `query`, for the opponent picker (never their emails). */
export async function searchChallengeOpponents(
  query: string,
  options: Pick<ChallengesClientOptions, "fetchImpl"> = {},
): Promise<ChallengePerson[]> {
  const q = query.trim();
  if (!q) return [];
  const response = await doFetch(options)(`/api/users/search?q=${encodeURIComponent(q)}`);
  if (!response.ok) return [];
  const payload = (await response.json()) as { users?: { id: string; name: string | null; image: string | null }[] };
  return (payload.users ?? []).map((row) => ({ id: row.id, name: row.name || "Debater", imageUrl: row.image ?? null }));
}
