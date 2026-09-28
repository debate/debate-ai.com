import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `src/` is upstream CardMirror (the `packages/debate-editor-cm` submodule)
 * plus `patches/debate-ai.patch`. An edit to an upstream file that isn't
 * recorded in the patch would be silently lost on the next upstream sync, so
 * CI fails until `scripts/sync-upstream.mjs --save-patch` is run. The script
 * skips (and passes) when the submodule isn't checked out.
 */
describe("upstream CardMirror sync", () => {
  it("records every change to an upstream file in patches/debate-ai.patch", () => {
    const script = join(import.meta.dirname, "..", "scripts", "sync-upstream.mjs");
    const r = spawnSync(process.execPath, [script, "--check"], { encoding: "utf8" });
    expect(r.stderr).toBe("");
    expect(r.status).toBe(0);
  }, 60_000);
});
