/**
 * @fileoverview The browser half of `/api/rebuttal-drills`. Every call
 * returns a typed result or throws an `Error` whose message is fit to show; a
 * signed-out board read resolves to `null` instead (the page then shows the
 * playlists and asks the reader to sign in to start a drill).
 *
 * @module debate-practice-rounds/rebuttal-playlists/client
 */

import type { CoachHelp, NewRebuttalDrill, RebuttalBoardResponse, RebuttalDrill, RebuttalDrillUpdate } from "./types";

const DEFAULT_BASE_PATH = "/api/rebuttal-drills";

export interface RebuttalDrillsClientOptions {
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

function doFetch(options: RebuttalDrillsClientOptions | undefined): typeof fetch {
  return options?.fetchImpl ?? globalThis.fetch.bind(globalThis);
}

/** The viewer's drills and the open seats, or `null` when signed out. */
export async function fetchRebuttalBoard(options: RebuttalDrillsClientOptions = {}): Promise<RebuttalBoardResponse | null> {
  const response = await doFetch(options)(options.basePath ?? DEFAULT_BASE_PATH);
  if (response.status === 401) return null;
  if (!response.ok) throw await errorFrom(response, "Could not load your rebuttal drills.");
  return (await response.json()) as RebuttalBoardResponse;
}

/** Starts a drill (or joins a waiting partner's) and returns it. `joined` says whether a partner was found. */
export async function startRebuttalDrill(
  drill: NewRebuttalDrill,
  options: RebuttalDrillsClientOptions = {},
): Promise<{ drill: RebuttalDrill; joined: boolean }> {
  const response = await doFetch(options)(options.basePath ?? DEFAULT_BASE_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(drill),
  });
  if (!response.ok) throw await errorFrom(response, "Could not start the drill.");
  return (await response.json()) as { drill: RebuttalDrill; joined: boolean };
}

/** Makes one move on a drill and returns it updated (with the coach's help, for `coach`). */
export async function updateRebuttalDrill(
  id: string,
  update: RebuttalDrillUpdate,
  options: RebuttalDrillsClientOptions = {},
): Promise<{ drill: RebuttalDrill; coach?: CoachHelp }> {
  const response = await doFetch(options)(`${options.basePath ?? DEFAULT_BASE_PATH}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  if (!response.ok) throw await errorFrom(response, "Could not update the drill.");
  return (await response.json()) as { drill: RebuttalDrill; coach?: CoachHelp };
}
