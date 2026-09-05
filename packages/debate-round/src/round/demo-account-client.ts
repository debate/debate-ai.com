/**
 * @fileoverview Network calls for the shared demo account (`/api/demo` and
 * `/api/demo/login` in `apps/debate-ai.com`). See `state/demoAccount.ts`
 * for the account's identity and seed content, and
 * docs/features/user-library.md for the feature.
 *
 * @module round/demo-account-client
 */

/** What `GET /api/demo` reports: whether the demo sign-in is offered on this deployment. */
export interface DemoAccountStatus {
  enabled: boolean;
  email: string;
  name: string;
}

/** What `POST /api/demo/login` returns once the session cookie is set. */
export interface DemoSignInResult {
  user: { id: string; email: string; name: string };
  seeded: { documents: number; flows: number; sharedFiles: number };
  reset: boolean;
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload?.error ?? fallback;
  } catch {
    return fallback;
  }
}

/** Whether this deployment offers the demo account. Resolves to `enabled: false` on any failure so the login form just hides the button. */
export async function fetchDemoAccountStatus(endpoint = "/api/demo"): Promise<DemoAccountStatus> {
  try {
    const res = await fetch(endpoint);
    if (!res.ok) return { enabled: false, email: "", name: "" };
    const data = (await res.json()) as Partial<DemoAccountStatus>;
    return { enabled: Boolean(data.enabled), email: data.email ?? "", name: data.name ?? "" };
  } catch {
    return { enabled: false, email: "", name: "" };
  }
}

/**
 * Signs the browser in as the demo account (the server sets the session
 * cookie). `reset: true` wipes the demo account's documents, flows, and
 * shared files back to the seed first. Throws with the server's message on
 * failure — including when the demo account is disabled.
 */
export async function signInAsDemoAccount(options: { reset?: boolean } = {}, endpoint = "/api/demo/login"): Promise<DemoSignInResult> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reset: Boolean(options.reset) }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "The demo account is not available right now."));
  return (await res.json()) as DemoSignInResult;
}
