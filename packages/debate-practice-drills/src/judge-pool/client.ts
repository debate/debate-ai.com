/**
 * @fileoverview The browser half of the Judge Pool API.
 *
 * Same contract as `../practice-partners/client.ts`: a typed result, or an
 * `Error` whose message is fit to show; a signed-out read resolves to `null`.
 *
 * @module debate-practice-rounds/judge-pool/client
 */

import type { HireAction, JudgeHireRequest, JudgeListingInput, JudgePoolResponse, NewHireRequest } from "./types";

const DEFAULT_BASE_PATH = "/api/judge-pool";

export interface JudgePoolClientOptions {
  /** Prefix for the API routes. Defaults to `/api/judge-pool`. */
  basePath?: string;
  /** Injected for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

async function errorFrom(response: Response, fallback: string): Promise<Error> {
  try {
    const payload = (await response.json()) as { error?: unknown };
    if (typeof payload?.error === "string" && payload.error.length > 0) return new Error(payload.error);
  } catch {
    // A non-JSON error body: the fallback says enough.
  }
  return new Error(fallback);
}

function requester(options: JudgePoolClientOptions | undefined) {
  const basePath = options?.basePath ?? DEFAULT_BASE_PATH;
  const doFetch = options?.fetchImpl ?? globalThis.fetch.bind(globalThis);
  return async (path: string, init: RequestInit | undefined, fallback: string): Promise<Response> => {
    const response = await doFetch(`${basePath}${path}`, {
      ...init,
      headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
    });
    if (!response.ok && response.status !== 401) throw await errorFrom(response, fallback);
    return response;
  };
}

/** The pool, the viewer's listing and their hire requests — or `null` when signed out. */
export async function fetchJudgePool(options: JudgePoolClientOptions = {}): Promise<JudgePoolResponse | null> {
  const response = await requester(options)("", undefined, "Could not load the judge pool.");
  if (response.status === 401) return null;
  return (await response.json()) as JudgePoolResponse;
}

/** Saves the viewer's judge listing and returns it as stored. */
export async function saveJudgeListing(
  listing: JudgeListingInput,
  options: JudgePoolClientOptions = {},
): Promise<JudgeListingInput> {
  const response = await requester(options)(
    "/listing",
    { method: "PUT", body: JSON.stringify(listing) },
    "Could not save your judge listing.",
  );
  if (response.status === 401) throw new Error("Sign in to volunteer as a judge.");
  return (await response.json()) as JudgeListingInput;
}

/** Sends a hire request to a listed judge. */
export async function sendHireRequest(
  request: NewHireRequest,
  options: JudgePoolClientOptions = {},
): Promise<JudgeHireRequest> {
  const response = await requester(options)(
    "/hires",
    { method: "POST", body: JSON.stringify(request) },
    "Could not send your hire request.",
  );
  if (response.status === 401) throw new Error("Sign in to hire a judge.");
  return (await response.json()) as JudgeHireRequest;
}

/** Accepts, declines or cancels a hire request. */
export async function actOnHireRequest(
  hireId: string,
  action: HireAction,
  options: JudgePoolClientOptions = {},
): Promise<JudgeHireRequest> {
  const response = await requester(options)(
    `/hires/${encodeURIComponent(hireId)}`,
    { method: "PATCH", body: JSON.stringify({ action }) },
    "Could not update that hire request.",
  );
  if (response.status === 401) throw new Error("Sign in to answer hire requests.");
  return (await response.json()) as JudgeHireRequest;
}
