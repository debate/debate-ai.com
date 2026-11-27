/**
 * A fake Cloudflare and GitHub for the env manager tests: `fetch` is replaced
 * by a router that holds a Worker's bindings and a repo's files, so a test can
 * assert what was sent (PATCH bodies, dispatches) and what came back.
 */

import { vi } from "vitest";

export interface Call {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

export const CF_TOKEN = "cf-secret-token-0123456789abcdef";
export const GH_TOKEN = "ghp_0123456789abcdefghijklmnopqrstuvwxyzAB";
export const ACCOUNT = "0123456789abcdef0123456789abcdef";

export const WRANGLER = `{
  // comment
  "name": "d-ebate-app",
  "keep_vars": true,
  "vars": { "ADMIN_EMAIL": "boss@example.com", },
}`;

export function fakeUpstream() {
  const state = {
    bindings: [
      { name: "ADMIN_EMAIL", type: "plain_text", text: "boss@example.com" },
      { name: "SITE_NAME", type: "plain_text", text: "Debate" },
      { name: "BETTER_AUTH_SECRET", type: "secret_text" },
      { name: "RESEND_API_KEY", type: "secret_text" },
      { name: "debate_db", type: "d1", id: "abc" },
      { name: "ASSETS", type: "assets" },
    ] as Array<Record<string, unknown>>,
    wrangler: WRANGLER,
    scopes: "repo, workflow" as string | null,
    dropOnPatch: null as string | null,
    runs: [] as Array<Record<string, unknown>>,
    dispatchReturnsRun: true,
    failCloudflare: null as { status: number; message: string } | null,
    failGithub: null as { status: number; message: string } | null,
    variables: new Map<string, string>(),
  };
  const calls: Call[] = [];

  const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
    new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

  const run = (id: number, status = "queued", conclusion: string | null = null) => ({
    id,
    status,
    conclusion,
    html_url: `https://github.com/debate/debate-ai.com/actions/runs/${id}`,
    created_at: new Date().toISOString(),
    head_sha: "abc123",
  });

  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    const headers = Object.fromEntries(Object.entries((init?.headers as Record<string, string>) ?? {}));
    let body: unknown = init?.body;
    if (body instanceof FormData) body = JSON.parse(String(body.get("settings")));
    else if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        // keep as text
      }
    }
    calls.push({ method, url, headers, body });

    if (url.startsWith("https://api.cloudflare.com/client/v4")) {
      if (state.failCloudflare) return json({ success: false, errors: [{ code: 10000, message: state.failCloudflare.message }] }, state.failCloudflare.status);
      if (url.endsWith("/tokens/verify")) return json({ success: true, result: { status: "active" } });
      if (url.endsWith("/settings") && method === "GET") return json({ success: true, result: { bindings: structuredClone(state.bindings) } });
      if (url.endsWith("/settings") && method === "PATCH") {
        const sent = (body as { bindings: Array<Record<string, unknown>> }).bindings;
        const prior = new Map(state.bindings.map((b) => [String(b.name), b]));
        state.bindings = sent
          .filter((b) => b.name !== state.dropOnPatch)
          .map((b) => {
            if (b.type === "inherit") return prior.get(String(b.name)) ?? { name: b.name, type: "plain_text", text: "" };
            if (b.type === "secret_text") return { name: b.name, type: "secret_text" };
            return b;
          });
        return json({ success: true, result: {} });
      }
    }

    if (url.startsWith("https://api.github.com")) {
      if (state.failGithub) return json({ message: state.failGithub.message }, state.failGithub.status);
      const path = url.replace("https://api.github.com", "");
      if (/^\/repos\/[^/]+\/[^/]+$/.test(path)) return json({ full_name: "debate/debate-ai.com" }, 200, state.scopes === null ? {} : { "x-oauth-scopes": state.scopes });
      if (path.includes("/branches/")) return json({ name: "master" });
      if (path.includes("/contents/")) return new Response(state.wrangler, { status: 200 });
      if (path.includes("/actions/variables") && method === "GET") return json({ variables: [] });
      const variable = /\/actions\/variables\/([^/?]+)$/.exec(path);
      if (variable && method === "PATCH") {
        if (!state.variables.has(variable[1])) return json({ message: "Not Found" }, 404);
        state.variables.set(variable[1], (body as { value: string }).value);
        return json({}, 204);
      }
      if (variable && method === "DELETE") {
        state.variables.delete(variable[1]);
        return json({}, 204);
      }
      if (path.endsWith("/actions/variables") && method === "POST") {
        state.variables.set((body as { name: string }).name, (body as { value: string }).value);
        return json({}, 201);
      }
      if (/\/actions\/workflows\/[^/]+\/dispatches$/.test(path)) {
        const next = run(9001);
        state.runs = [next];
        return state.dispatchReturnsRun ? json({ workflow_run_id: 9001, html_url: next.html_url, run_url: "x" }, 200) : json({}, 204);
      }
      if (/\/actions\/workflows\/[^/]+\/runs/.test(path)) return json({ workflow_runs: state.runs });
      if (/\/actions\/workflows\/[^/]+$/.test(path)) return json({ id: 1 });
      const runId = /\/actions\/runs\/(\d+)$/.exec(path);
      if (runId) return json(state.runs.find((r) => String(r.id) === runId[1]) ?? run(Number(runId[1]), "completed", "success"));
    }
    return json({ message: `unhandled ${method} ${url}` }, 404);
  });

  return { state, calls, fetchMock, run };
}
