import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `src/` is upstream CardMirror (the `packages/debate-editor-cm` submodule),
 * copied in by `scripts/sync-upstream.mjs`, plus the files git tracks there —
 * ours, including the upstream files we override. An edit made to one of the
 * generated copies would be silently overwritten by the next install, so CI
 * fails until it is kept with `--override`. The script skips (and passes)
 * when the submodule isn't checked out.
 */
describe("upstream CardMirror sync", () => {
  it("keeps every generated upstream copy identical to upstream", () => {
    const script = join(import.meta.dirname, "..", "scripts", "sync-upstream.mjs");
    const r = spawnSync(process.execPath, [script, "--check"], { encoding: "utf8" });
    expect(r.stderr).toBe("");
    expect(r.status).toBe(0);
  }, 60_000);
});
