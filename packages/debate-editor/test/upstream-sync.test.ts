import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `src/` is assembled from upstream CardMirror (the `packages/debate-editor-cm`
 * submodule) + `patches/debate-ai.patch` + `overlay/`, and is git-ignored. CI
 * fails when the patch no longer applies to the pinned upstream commit, when
 * an overlay file shadows an upstream one, or when `src/` holds an edit that
 * was never recorded with `scripts/sync-upstream.mjs --save` (it would never be
 * committed). The script skips (and passes) when the submodule isn't checked out.
 */
describe("upstream CardMirror sync", () => {
  it("assembles src/ from the submodule, the patch and the overlay", () => {
    const script = join(import.meta.dirname, "..", "scripts", "sync-upstream.mjs");
    const r = spawnSync(process.execPath, [script, "--check"], { encoding: "utf8" });
    expect(r.stderr).toBe("");
    expect(r.status).toBe(0);
  }, 60_000);
});
