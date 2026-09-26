/**
 * @fileoverview Web UI entry point for upstream Tabroom's record types.
 *
 * Re-exports upstream's `@tabroom/types` — the Zod schemas Tabroom's own API
 * validates with, and the types inferred from them — so a page showing
 * tournaments, entries, judges or results can check the data it gets against
 * the same contract Tabroom does, instead of a hand-copied type.
 * @module debate-tournaments-tabroom-adapter
 */

import type { z } from "zod";
import * as upstream from "./upstream";

export * from "./upstream";

/** Any Zod schema upstream exports. */
type AnySchema = z.ZodType;

/**
 * Every upstream schema keyed by record name — `TournSchema` as `Tourn` — for
 * code that picks a schema at runtime (an import dialog, an API explorer).
 */
export const tabroomSchemas: Readonly<Record<string, AnySchema>> = Object.freeze(
  Object.fromEntries(
    Object.entries(upstream)
      .filter(([name, value]) => name.endsWith("Schema") && isZodSchema(value))
      .map(([name, value]) => [name.slice(0, -"Schema".length), value as AnySchema]),
  ),
);

function isZodSchema(value: unknown): value is AnySchema {
  return typeof value === "object" && value !== null && typeof (value as AnySchema).safeParse === "function";
}

/** A parse result that never throws, with issues flattened for display. */
export type TabroomParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; issues: { path: string; message: string }[] };

/**
 * Validates `data` against a Tabroom schema without throwing.
 *
 * @param schema - An upstream schema, e.g. `TournSchema`.
 * @param data - The untrusted value.
 * @returns The parsed value, or each issue as a dotted path and message.
 */
export function parseTabroom<S extends AnySchema>(schema: S, data: unknown): TabroomParseResult<z.output<S>> {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, data: result.data as z.output<S> };
  return {
    ok: false,
    issues: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
  };
}
