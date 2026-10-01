/**
 * The React shell mounts exactly one document into the engine and waits for
 * the single-doc `mountView` (`singleton.ts` → `waitForView`). The three-pane
 * shell boots its panes hidden with no active view, so a synced
 * `multiDocWorkspace: true` used to leave every embed on "Loading editor…"
 * until the 30s boot timeout, and then forever.
 *
 * `index.ts` is side-effecting module code that can only boot once per page,
 * so these assertions read its source rather than booting it twice.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const INDEX = readFileSync(join(import.meta.dirname, "..", "src", "editor", "index.ts"), "utf8");
const SHELL = readFileSync(join(import.meta.dirname, "..", "src", "react", "CardMirrorEditor.tsx"), "utf8");

describe("embedded CardMirror boots single-doc", () => {
  it("never boots the three-pane shell inside the React embed", () => {
    expect(INDEX).toMatch(/const BOOT_EMBEDDED = BOOT_MOBILE_ENV\.embedded;/);
    expect(INDEX).toMatch(
      /const BOOT_MULTI_DOC_WORKSPACE =\s*!BOOT_MOBILE && !BOOT_EMBEDDED && settings\.get\('multiDocWorkspace'\);/,
    );
  });

  it("does not treat the stored three-pane setting as a mode switch in the embed", () => {
    expect(INDEX).toMatch(/if \(BOOT_MOBILE \|\| BOOT_EMBEDDED\) return;/);
  });

  it("surfaces a failed boot instead of loading forever", () => {
    expect(SHELL).toMatch(/setBootError\(/);
    expect(SHELL).toMatch(/Couldn't load the editor/);
  });
});
