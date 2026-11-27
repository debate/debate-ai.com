/**
 * @fileoverview Staged environment variable changes: validation, the diff the
 * admin confirms, and the rules around risky names. The diff never contains a
 * secret's value (or its previous value), only its name.
 */

import { type Binding, type Change, VAR_KINDS, type VarKind } from "./cloudflare";

export const MAX_CHANGES = 100;
/** Cloudflare caps a variable at 5 KiB. */
export const MAX_VALUE_BYTES = 5 * 1024;
const NAME = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;

/**
 * Names whose change can lock the site or the admin out: the auth and
 * encryption keys (rotating SERVICE_LOGINS_SECRET or BETTER_AUTH_SECRET also
 * makes every saved token here unreadable), the admin allowlist, and the D1
 * binding. Bindings that are not plain variables or secrets are never
 * editable here at all.
 */
export const PROTECTED_VARS: Record<string, string> = {
  BETTER_AUTH_SECRET: "Signs every session. Changing it logs everyone out and makes the saved Cloudflare and GitHub tokens, service logins and Resend key unreadable.",
  BETTER_AUTH_URL: "The site's base URL for sign-in callbacks. A wrong value breaks sign-in.",
  SERVICE_LOGINS_SECRET: "Encrypts the saved tokens, service logins and Resend key. Changing it makes them all unreadable until re-entered.",
  ADMIN_EMAIL: "The hardcoded admin. A wrong value can lock every admin out of this panel.",
  ADMIN_EMAILS: "The extra admins. A wrong value can lock admins out of this panel.",
  debate_db: "The D1 database binding. It is not editable here.",
};

export function isProtected(name: string): boolean {
  return Object.hasOwn(PROTECTED_VARS, name);
}

/** Names that are inlined into the client bundle at build time, so only a rebuild picks up a change. */
export function isBuildTimeVar(name: string): boolean {
  return name.startsWith("NEXT_PUBLIC_");
}

export function validateChanges(raw: unknown): { changes: Change[] } | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { error: "Stage at least one change." };
  if (raw.length > MAX_CHANGES) return { error: `At most ${MAX_CHANGES} changes at a time.` };
  const seen = new Set<string>();
  const changes: Change[] = [];
  for (const item of raw as Array<Record<string, unknown>>) {
    const name = typeof item?.name === "string" ? item.name : "";
    if (!NAME.test(name)) return { error: `"${name.slice(0, 40)}" is not a valid variable name (letters, digits and underscores; no leading digit).` };
    if (seen.has(name)) return { error: `${name} is staged twice.` };
    seen.add(name);
    if (item.op === "delete") {
      changes.push({ op: "delete", name });
    } else if (item.op === "set") {
      const kind = item.kind as VarKind;
      const value = item.value;
      if (!VAR_KINDS.includes(kind)) return { error: `${name}: type must be plain_text, secret_text or json.` };
      if (typeof value !== "string") return { error: `${name}: value must be text.` };
      if (new TextEncoder().encode(value).length > MAX_VALUE_BYTES) return { error: `${name}: value is over 5 KiB.` };
      if (kind === "secret_text" && value === "") return { error: `${name}: a secret needs a value.` };
      if (kind === "json") {
        try {
          JSON.parse(value);
        } catch {
          return { error: `${name}: value is not valid JSON.` };
        }
      }
      changes.push({ op: "set", name, kind, value });
    } else {
      return { error: `${name}: unknown change.` };
    }
  }
  return { changes };
}

export interface CurrentVar {
  name: string;
  kind: VarKind;
  /** Absent for secrets: Cloudflare never returns them and neither do we. */
  value?: string;
  protected: boolean;
  inWrangler: boolean;
}

export interface CurrentBinding {
  name: string;
  type: string;
  protected: boolean;
}

const VAR_TYPES = new Set<string>(VAR_KINDS);

export function listVars(bindings: Binding[], wranglerVars: string[]): { vars: CurrentVar[]; bindings: CurrentBinding[] } {
  const owned = new Set(wranglerVars);
  const vars: CurrentVar[] = [];
  const others: CurrentBinding[] = [];
  for (const binding of bindings) {
    if (VAR_TYPES.has(binding.type)) {
      const kind = binding.type as VarKind;
      vars.push({
        name: binding.name,
        kind,
        ...(kind === "plain_text" ? { value: String(binding.text ?? "") } : kind === "json" ? { value: JSON.stringify(binding.json) } : {}),
        protected: isProtected(binding.name),
        inWrangler: owned.has(binding.name),
      });
    } else {
      others.push({ name: binding.name, type: binding.type, protected: isProtected(binding.name) });
    }
  }
  vars.sort((a, b) => a.name.localeCompare(b.name));
  others.sort((a, b) => a.name.localeCompare(b.name));
  return { vars, bindings: others };
}

export interface DiffEntry {
  name: string;
  action: "add" | "update" | "delete" | "unchanged";
  kind: VarKind | null;
  previousKind: VarKind | null;
  /** Plain-text and JSON values only; secrets are `null`. */
  before: string | null;
  after: string | null;
  protected: boolean;
  /** The Worker has no such variable (a delete of nothing). */
  missing?: boolean;
  warnings: string[];
}

export interface Plan {
  entries: DiffEntry[];
  hasDeletes: boolean;
  hasProtected: boolean;
  needsRebuild: string[];
  warnings: string[];
}

export interface WranglerFacts {
  varNames: string[];
  keepVars: boolean;
}

/** Builds the confirmation diff. Refuses to touch a non-variable binding. */
export function planChanges(
  bindings: Binding[],
  changes: Change[],
  wrangler: WranglerFacts | null,
): { plan: Plan } | { error: string } {
  const byName = new Map(bindings.map((binding) => [binding.name, binding]));
  const owned = new Set(wrangler?.varNames ?? []);
  const entries: DiffEntry[] = [];
  const needsRebuild: string[] = [];

  for (const change of changes) {
    const existing = byName.get(change.name);
    if (existing && !VAR_TYPES.has(existing.type)) {
      return { error: `${change.name} is a ${existing.type} binding, not a variable. Change it in wrangler.jsonc.` };
    }
    const previousKind = existing ? (existing.type as VarKind) : null;
    const before = previousKind === "plain_text" ? String(existing?.text ?? "") : previousKind === "json" ? JSON.stringify(existing?.json) : null;
    const warnings: string[] = [];
    if (owned.has(change.name)) {
      warnings.push("Defined in wrangler.jsonc `vars`: the next `wrangler deploy` (including the rebuild) overwrites this change with the file's value. Edit the file instead.");
    }
    if (isBuildTimeVar(change.name)) needsRebuild.push(change.name);

    if (change.op === "delete") {
      entries.push({ name: change.name, action: "delete", kind: previousKind, previousKind, before, after: null, protected: isProtected(change.name), missing: !existing, warnings });
      continue;
    }
    const after = change.kind === "secret_text" ? null : change.kind === "json" ? JSON.stringify(JSON.parse(change.value)) : change.value;
    const unchanged = existing && change.kind !== "secret_text" && previousKind === change.kind && before === after;
    entries.push({
      name: change.name,
      action: unchanged ? "unchanged" : existing ? "update" : "add",
      kind: change.kind,
      previousKind,
      before,
      after,
      protected: isProtected(change.name),
      warnings,
    });
  }

  const warnings: string[] = [];
  if (wrangler && !wrangler.keepVars) {
    warnings.push("wrangler.jsonc has no `keep_vars: true`: every `wrangler deploy` deletes dashboard variables that are not listed in `vars`. Add keep_vars before rebuilding.");
  }
  return {
    plan: {
      entries,
      hasDeletes: entries.some((entry) => entry.action === "delete" && !entry.missing),
      hasProtected: entries.some((entry) => entry.protected && entry.action !== "unchanged"),
      needsRebuild,
      warnings,
    },
  };
}

/** The changes that still need sending: unchanged and no-op deletes dropped. */
export function effectiveChanges(changes: Change[], plan: Plan): Change[] {
  const skip = new Set(plan.entries.filter((entry) => entry.action === "unchanged" || entry.missing).map((entry) => entry.name));
  return changes.filter((change) => !skip.has(change.name));
}
