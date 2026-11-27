/** @vitest-environment jsdom */
import { act } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { POLL_MS } from "../../../src/components/admin/env/BuildSection";
import { EnvironmentPanel } from "../../../src/components/admin/env/EnvironmentPanel";
import { parseEnvText } from "../../../src/components/admin/env/parse-env";
import { bodyText, button, change, cleanup, clickAsync, flush, installDomShims, mockFetch, mount, toggle } from "../../helpers/dom";

const TOKEN = "cf-token-that-must-never-render-1234";

const STATUS = {
  cloudflare: { set: true, endsIn: "1234", unreadable: false, updatedAt: 1, updatedBy: "admin@example.com", accountId: "a".repeat(32), script: "d-ebate-app" },
  github: { set: true, endsIn: "wxyz", unreadable: false, updatedAt: 1, updatedBy: "admin@example.com", owner: "debate", repo: "debate-ai.com", branch: "master", workflow: "cloudflare-workers-deploy.yml", wranglerPath: "apps/debate-web/wrangler.jsonc" },
};

const VARS = {
  script: "d-ebate-app",
  vars: [
    { name: "ADMIN_EMAIL", kind: "plain_text", value: "boss@example.com", protected: true, inWrangler: true },
    { name: "RESEND_API_KEY", kind: "secret_text", protected: false, inWrangler: false },
    { name: "SITE_NAME", kind: "plain_text", value: "Debate", protected: false, inWrangler: false },
  ],
  bindings: [{ name: "debate_db", type: "d1", protected: true }],
  protectedVars: { ADMIN_EMAIL: "The hardcoded admin." },
  wrangler: { path: "w", name: "d-ebate-app", keepVars: true, varNames: ["ADMIN_EMAIL"] },
  wranglerError: null,
  warnings: [],
};

beforeAll(() => installDomShims());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function routes(extra: Parameters<typeof mockFetch>[0] = [], status: unknown = STATUS) {
  return mockFetch([
    ...extra,
    { match: "/api/admin/env/credentials", method: "POST", respond: { ok: true, status } },
    { match: "/api/admin/env/credentials", respond: { status } },
    { match: "/api/admin/env/vars", respond: VARS },
    { match: "/api/admin/env/audit", respond: { entries: [{ id: 1, at: 1, actor: "admin@example.com", action: "apply", names: ["update:SITE_NAME"], detail: "ok" }] } },
  ]);
}

const input = (label: string) => document.querySelector(`input[aria-label='${label}'], #${label}`) as HTMLInputElement;
const row = (name: string) => document.querySelector(`[data-testid='row-${name}']`) as HTMLElement;

describe("credentials", () => {
  it("shows a token as set with its last four characters and never renders it", async () => {
    routes();
    mount(<EnvironmentPanel />);
    await flush();
    expect(bodyText()).toContain("Set · ends in 1234");
    expect(bodyText()).toContain("Set · ends in wxyz");
    expect(bodyText()).not.toContain(TOKEN);
    expect(input("cf-token").value).toBe("");
    expect(input("cf-token").type).toBe("password");
  });

  it("saves a typed token, clears the field and sends nothing for a blank one", async () => {
    const { calls } = routes();
    mount(<EnvironmentPanel />);
    await flush();
    change(input("cf-token"), TOKEN);
    await clickAsync(button("Save Cloudflare"));
    const save = calls.find((c) => c.method === "POST" && c.url.endsWith("/credentials"));
    expect(save?.body).toMatchObject({ cloudflareToken: TOKEN, accountId: "a".repeat(32), script: "d-ebate-app" });
    expect(input("cf-token").value).toBe("");
    expect(bodyText()).toContain("Saved.");
    expect(bodyText()).not.toContain(TOKEN);
  });

  it("shows which permissions a failed connection test is missing", async () => {
    routes([
      {
        match: "/api/admin/env/test",
        method: "POST",
        respond: {
          target: "cloudflare",
          ok: false,
          checks: [{ name: "Worker settings readable", ok: false, detail: "Authentication error" }],
          missing: ["Account · Workers Scripts · Read (and Edit to save changes)"],
          required: ["Account · Workers Scripts · Edit"],
        },
      },
    ]);
    mount(<EnvironmentPanel />);
    await flush();
    await clickAsync(document.querySelectorAll<HTMLButtonElement>("#env-cloudflare button")[1]);
    expect(bodyText()).toContain("Connection problems found.");
    expect(bodyText()).toContain("Missing permissions");
    expect(bodyText()).toContain("Workers Scripts · Read");
  });

  it("disables variables until Cloudflare is connected", async () => {
    routes([], { ...STATUS, cloudflare: { ...STATUS.cloudflare, set: false, endsIn: "" } });
    mount(<EnvironmentPanel />);
    await flush();
    expect(bodyText()).toContain("Save the Cloudflare token and account ID above");
    expect(row("SITE_NAME")).toBeNull();
  });
});

describe("variables", () => {
  it("lists text values, hides secrets and flags wrangler-owned and protected names", async () => {
    routes();
    mount(<EnvironmentPanel />);
    await flush();
    expect(row("SITE_NAME").textContent).toContain("Debate");
    expect(row("RESEND_API_KEY").textContent).toContain("hidden");
    expect(row("ADMIN_EMAIL").textContent).toContain("protected");
    expect(row("ADMIN_EMAIL").textContent).toContain("in wrangler.jsonc");
    expect(bodyText()).toContain("debate_db (d1)");
  });

  it("stages an edit, a new secret and a deletion, reviews the diff, and applies with confirmation and a rebuild", async () => {
    const plan = {
      entries: [
        { name: "SITE_NAME", action: "update", kind: "plain_text", previousKind: "plain_text", before: "Debate", after: "Debate AI", protected: false, warnings: [] },
        { name: "NEW_SECRET", action: "add", kind: "secret_text", previousKind: null, before: null, after: null, protected: false, warnings: [] },
        { name: "RESEND_API_KEY", action: "delete", kind: "secret_text", previousKind: "secret_text", before: null, after: null, protected: false, warnings: [] },
      ],
      hasDeletes: true,
      hasProtected: false,
      needsRebuild: [],
      warnings: [],
    };
    const { calls } = routes([
      { match: "/api/admin/env/apply", method: "POST", respond: (call: { body: unknown }) => ((call.body as { dryRun?: boolean }).dryRun ? { plan } : { applied: 3, plan, rebuild: { run: { id: 7, status: "queued", conclusion: null, url: "https://github.com/x/y/actions/runs/7", createdAt: "", sha: null }, dispatchedAt: 1, variables: [] } }) },
    ]);
    mount(<EnvironmentPanel />);
    await flush();

    await clickAsync(row("SITE_NAME").querySelector("button[aria-label='Edit SITE_NAME']")!);
    change(input("New value for SITE_NAME"), "Debate AI");
    await clickAsync(button("Stage"));
    change(document.getElementById("env-new-name")!, "NEW_SECRET");
    change(document.getElementById("env-new-kind")!, "secret_text");
    change(document.getElementById("env-new-value")!, "hunter2-never-shown");
    await clickAsync(button("Stage variable"));
    await clickAsync(row("RESEND_API_KEY").querySelector("button[aria-label='Delete RESEND_API_KEY']")!);
    expect(bodyText()).toContain("3 staged changes");
    expect(bodyText()).not.toContain("hunter2-never-shown");

    await clickAsync(button("Review changes"));
    const diff = document.querySelector("[data-testid='plan']")!.textContent!;
    expect(diff).toContain("Debate AI");
    expect(diff).toContain("NEW_SECRET");
    expect(diff).toContain("value hidden");
    expect(diff).not.toContain("hunter2-never-shown");

    expect(button("Apply and rebuild").disabled).toBe(true);
    toggle(document.querySelector("[data-testid='plan'] input[type=checkbox]") as HTMLInputElement);
    await flush();
    expect(button("Apply and rebuild").disabled).toBe(false);
    await clickAsync(button("Apply and rebuild"));

    const apply = calls.filter((c) => c.url.endsWith("/apply")).at(-1)!;
    expect(apply.body).toEqual({
      changes: [
        { op: "set", name: "SITE_NAME", kind: "plain_text", value: "Debate AI" },
        { op: "set", name: "NEW_SECRET", kind: "secret_text", value: "hunter2-never-shown" },
        { op: "delete", name: "RESEND_API_KEY" },
      ],
      confirmDelete: true,
      confirmProtected: false,
      rebuild: true,
    });
    expect(bodyText()).toContain("Applied 3 changes");
    expect(bodyText()).toContain("Queued…");
    expect(document.querySelector<HTMLAnchorElement>("[data-testid='run'] a")?.href).toBe("https://github.com/x/y/actions/runs/7");
  });

  it("makes the admin tick a protected-variable warning before applying", async () => {
    const plan = {
      entries: [{ name: "ADMIN_EMAIL", action: "update", kind: "plain_text", previousKind: "plain_text", before: "boss@example.com", after: "x@example.com", protected: true, warnings: ["Defined in wrangler.jsonc `vars`: overwritten."] }],
      hasDeletes: false,
      hasProtected: true,
      needsRebuild: [],
      warnings: [],
    };
    routes([{ match: "/api/admin/env/apply", method: "POST", respond: { plan } }]);
    mount(<EnvironmentPanel />);
    await flush();
    await clickAsync(row("ADMIN_EMAIL").querySelector("button[aria-label='Edit ADMIN_EMAIL']")!);
    change(input("New value for ADMIN_EMAIL"), "x@example.com");
    await clickAsync(button("Stage"));
    await clickAsync(button("Review changes"));
    expect(bodyText()).toContain("Protected variables are in this change");
    expect(bodyText()).toContain("overwritten");
    expect(button("Apply").disabled).toBe(true);
    toggle(document.querySelector("[data-testid='plan'] input[type=checkbox]") as HTMLInputElement);
    await flush();
    expect(button("Apply", document).disabled).toBe(false);
  });

  it("stages bulk-pasted .env entries, as secrets when asked", async () => {
    routes();
    mount(<EnvironmentPanel />);
    await flush();
    const textarea = document.querySelector("textarea[aria-label='Bulk .env entries']") as HTMLTextAreaElement;
    change(textarea, "# c\nA=1\nexport B='two words'\nbad line");
    toggle(document.querySelector("details input[type=checkbox]") as HTMLInputElement);
    await clickAsync(button("Stage pasted entries"));
    const staged = document.querySelector("[data-testid='staged']")!.textContent!;
    expect(staged).toContain("add A (Secret)");
    expect(staged).toContain("add B (Secret)");
    expect(bodyText()).toContain("Staged 2 entries. Skipped: Line 4");
  });
});

describe("rebuild status", () => {
  it("polls the run until it finishes and links to it", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let polls = 0;
    const { calls } = routes([
      { match: "/api/admin/env/rebuild", method: "POST", respond: { run: { id: 5, status: "queued", conclusion: null, url: "https://github.com/x/y/actions/runs/5", createdAt: "", sha: null }, dispatchedAt: 1, variables: [] } },
      {
        match: "/api/admin/env/rebuild?runId=5",
        respond: () => ({ run: { id: 5, status: ++polls < 2 ? "in_progress" : "completed", conclusion: polls < 2 ? null : "success", url: "https://github.com/x/y/actions/runs/5", createdAt: "", sha: null } }),
      },
    ]);
    mount(<EnvironmentPanel />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    await act(async () => {
      button("Rebuild without changes").click();
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(bodyText()).toContain("Queued…");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS + 10);
    });
    expect(bodyText()).toContain("Building and deploying…");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS + 10);
    });
    expect(bodyText()).toContain("Deployed");
    const before = calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS * 3);
    });
    expect(calls.length).toBe(before);
  });
});

describe("parseEnvText", () => {
  it("handles comments, export, quotes, inline comments and multi-line values", () => {
    const { entries, errors } = parseEnvText(
      ['# top', 'A=1 # tail', 'export B="x\\ny"', "C='it is'", 'KEY="-----BEGIN', 'line2"', "D =spaced", "bad", "1X=no", 'A=override'].join("\n"),
    );
    expect(Object.fromEntries(entries.map((e) => [e.name, e.value]))).toEqual({ A: "override", B: "x\ny", C: "it is", KEY: "-----BEGIN\nline2", D: "spaced" });
    expect(errors).toHaveLength(2);
  });
});
