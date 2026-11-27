import { describe, expect, it } from "vitest";
import { buildBindings } from "../cloudflare";
import { parseJsonc, readWranglerInfo } from "../jsonc";
import { redact, tail } from "../redact";
import { type Plan, effectiveChanges, isBuildTimeVar, isProtected, listVars, planChanges, validateChanges } from "../vars";
import { appInput } from "../github";
import { WRANGLER } from "./helpers";

describe("parseJsonc / readWranglerInfo", () => {
  it("reads comments, trailing commas and urls inside strings", () => {
    expect(parseJsonc(`{ /* a */ "u": "https://x.y//z", // c\n "list": [1, 2,], }`)).toEqual({ u: "https://x.y//z", list: [1, 2] });
  });
  it("extracts the facts that matter for env vars", () => {
    expect(readWranglerInfo("w.jsonc", WRANGLER)).toEqual({ path: "w.jsonc", name: "d-ebate-app", keepVars: true, varNames: ["ADMIN_EMAIL"] });
    expect(readWranglerInfo("w.jsonc", "{}")).toMatchObject({ keepVars: false, varNames: [], name: null });
  });
  it("parses this repo's real wrangler.jsonc", async () => {
    const { readFileSync } = await import("node:fs");
    const text = readFileSync(new URL("../../../wrangler.jsonc", import.meta.url), "utf8");
    expect(readWranglerInfo("wrangler.jsonc", text)).toMatchObject({ name: "d-ebate-app", keepVars: true });
  });
});

describe("redact", () => {
  it("blanks known secrets and token shapes", () => {
    const out = redact("failed with Bearer abcdefghijklmnop1234 and ghp_abcdefghijklmnopqrstuvwx and mysecretvalue", ["mysecretvalue"]);
    expect(out).not.toMatch(/abcdefghijklmnop1234|ghp_abc|mysecretvalue/);
  });
  it("shows only the last four characters of a long token", () => {
    expect(tail("abcdefghijkl")).toBe("ijkl");
    expect(tail("short")).toBe("");
  });
});

describe("validateChanges", () => {
  it("accepts well-formed changes and rejects bad ones", () => {
    expect(validateChanges([{ op: "set", name: "A_1", kind: "plain_text", value: "" }])).toEqual({ changes: [{ op: "set", name: "A_1", kind: "plain_text", value: "" }] });
    expect(validateChanges([{ op: "set", name: "A", kind: "weird", value: "x" }])).toHaveProperty("error");
    expect(validateChanges([{ op: "set", name: "A", kind: "plain_text", value: "x".repeat(6000) }])).toHaveProperty("error");
    expect(validateChanges([{ op: "nope", name: "A" }])).toHaveProperty("error");
    expect(validateChanges("x")).toHaveProperty("error");
  });
});

describe("planChanges / buildBindings", () => {
  const bindings = [
    { name: "A", type: "plain_text", text: "1" },
    { name: "S", type: "secret_text" },
    { name: "BETTER_AUTH_SECRET", type: "secret_text" },
    { name: "R2", type: "r2_bucket", bucket_name: "b" },
  ];
  it("marks unchanged values, missing deletes and build-time vars", () => {
    const changes = validateChanges([
      { op: "set", name: "A", kind: "plain_text", value: "1" },
      { op: "delete", name: "GONE" },
      { op: "set", name: "NEXT_PUBLIC_X", kind: "plain_text", value: "v" },
    ]) as { changes: Parameters<typeof planChanges>[1] };
    const { plan } = planChanges(bindings, changes.changes, { varNames: [], keepVars: false }) as { plan: Plan };
    expect(plan.entries.map((e) => [e.name, e.action])).toEqual([["A", "unchanged"], ["GONE", "delete"], ["NEXT_PUBLIC_X", "add"]]);
    expect(plan.hasDeletes).toBe(false);
    expect(plan.needsRebuild).toEqual(["NEXT_PUBLIC_X"]);
    expect(plan.warnings[0]).toContain("keep_vars");
    expect(effectiveChanges(changes.changes, plan).map((c) => c.name)).toEqual(["NEXT_PUBLIC_X"]);
  });
  it("inherits every binding it does not own and never re-sends secrets", () => {
    const out = buildBindings(bindings, [{ op: "set", name: "S", kind: "plain_text", value: "now plain" }]);
    expect(out).toEqual([
      { type: "plain_text", name: "A", text: "1" },
      { type: "inherit", name: "BETTER_AUTH_SECRET" },
      { type: "inherit", name: "R2" },
      { type: "plain_text", name: "S", text: "now plain" },
    ]);
  });
  it("classifies names", () => {
    expect(isProtected("SERVICE_LOGINS_SECRET")).toBe(true);
    expect(isProtected("toString")).toBe(false);
    expect(isBuildTimeVar("NEXT_PUBLIC_A")).toBe(true);
    expect(listVars(bindings, ["A"]).vars.find((v) => v.name === "A")).toMatchObject({ inWrangler: true, value: "1" });
  });
});

describe("appInput", () => {
  it("derives the workflow's app input from the wrangler path", () => {
    expect(appInput("apps/debate-web/wrangler.jsonc")).toBe("debate-web");
    expect(appInput("wrangler.toml")).toBeNull();
  });
});
