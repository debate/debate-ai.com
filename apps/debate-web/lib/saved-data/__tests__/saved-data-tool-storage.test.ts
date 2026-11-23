/**
 * @fileoverview Keeps Settings → General "Where each tool saves" honest about
 * the SQL tables behind Settings → "Saved to your account". Every saved-data
 * kind whose tool is in the `/tools` catalog must be described as saved to the
 * account: either a `sql` override or a synced tool that names the table in
 * `TOOL_SQL_ALONGSIDE`. Before this, Practice vs AI, the Reason Editor and AI
 * Judge Decision read "kept on this device otherwise" although their main
 * items are SQL rows linked to the user. Flows and rounds (`/debate`) have no
 * catalog entry but are listed through `STORAGE_PAGES_OUTSIDE_CATALOG`, so
 * they are checked the same way.
 */
import { describe, expect, it } from "vitest";
import { ALL_TOOLS } from "@debate-ai/webview/routes/tools/tool-groups";
import {
  STORAGE_PAGES_OUTSIDE_CATALOG,
  describeToolStorage,
  resolveToolStorage,
} from "@debate-ai/webview/lib/tools/tool-storage";
import { SAVED_DATA_KINDS } from "../saved-data";

const catalogHrefs = new Set([
  ...ALL_TOOLS.map((tool) => tool.href),
  ...STORAGE_PAGES_OUTSIDE_CATALOG.flatMap((group) => group.tools.map((tool) => tool.href)),
]);

describe("SAVED_DATA_KINDS vs the tool storage map", () => {
  const inCatalog = SAVED_DATA_KINDS.filter((kind) => catalogHrefs.has(kind.href));

  it("checks at least the documents, flows and rounds, practice debates and judge decisions tools", () => {
    expect(inCatalog.map((kind) => kind.href)).toEqual(
      expect.arrayContaining(["/reason-editor", "/debate", "/practice/versus-ai", "/practice/judge-decision"]),
    );
  });

  it.each(inCatalog.map((kind) => [kind.label, kind.href] as const))(
    "%s (%s) is described as saved to the account",
    (_label, href) => {
      const storage = resolveToolStorage(href);
      const accountBacked = storage?.kind === "sql" || (storage?.kind === "synced" && Boolean(storage.sql));
      expect(accountBacked, `add ${href} to TOOL_SQL_ALONGSIDE or TOOL_STORAGE_OVERRIDES`).toBe(true);
      expect(describeToolStorage(storage)).toMatch(/^Saved to your account: /);
    },
  );
});
