/**
 * @fileoverview The browser half of `/api/rebuttal-redos`. Every call returns
 * a typed result or throws an `Error` whose message is fit to show; a
 * signed-out board read resolves to `null`.
 *
 * @module debate-practice-rounds/rebuttal-redos/client
 */

import type { NewRedoRound, RebuttalRedo, RedoBoardResponse, RedoUpdate } from "./types";

export const REBUTTAL_REDOS_API = "/api/rebuttal-redos";

export interface RebuttalRedosClientOptions {
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

const doFetch = (options: RebuttalRedosClientOptions): typeof fetch => options.fetchImpl ?? globalThis.fetch.bind(globalThis);
const base = (options: RebuttalRedosClientOptions) => options.basePath ?? REBUTTAL_REDOS_API;

/** The viewer's assignments, the redos they judge, and their fiat points — or `null` when signed out. */
export async function fetchRedoBoard(options: RebuttalRedosClientOptions = {}): Promise<RedoBoardResponse | null> {
  const response = await doFetch(options)(base(options), { cache: "no-store" });
  if (response.status === 401) return null;
  if (!response.ok) throw await errorFrom(response, "Could not load your rebuttal redos.");
  return (await response.json()) as RedoBoardResponse;
}

/** Drafts redos for a round the viewer judged. `created` is false when that round already had them. */
export async function generateRoundRedos(
  round: NewRedoRound,
  options: RebuttalRedosClientOptions = {},
): Promise<{ redos: RebuttalRedo[]; created: boolean }> {
  const response = await doFetch(options)(base(options), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(round),
  });
  if (!response.ok) throw await errorFrom(response, "Could not draft rebuttal redos for this round.");
  return (await response.json()) as { redos: RebuttalRedo[]; created: boolean };
}

/** One move on a redo; returns it updated. */
export async function updateRedo(id: string, update: RedoUpdate, options: RebuttalRedosClientOptions = {}): Promise<RebuttalRedo> {
  const response = await doFetch(options)(`${base(options)}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  if (!response.ok) throw await errorFrom(response, "Could not update the redo.");
  return ((await response.json()) as { redo: RebuttalRedo }).redo;
}

/** Where a redo's recording is served (to its debater and judge only). */
export function redoAudioUrl(id: string, options: RebuttalRedosClientOptions = {}): string {
  return `${base(options)}/${encodeURIComponent(id)}/audio`;
}

/** Uploads (or replaces) the debater's recording of a redo. */
export async function uploadRedoAudio(id: string, audio: Blob, options: RebuttalRedosClientOptions = {}): Promise<void> {
  const response = await doFetch(options)(redoAudioUrl(id, options), {
    method: "PUT",
    headers: { "Content-Type": audio.type || "audio/webm" },
    body: audio,
  });
  if (!response.ok) throw await errorFrom(response, "Could not upload your recording.");
}
