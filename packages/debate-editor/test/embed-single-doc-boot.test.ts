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

const SINGLETON = readFileSync(join(import.meta.dirname, "..", "src", "react", "singleton.ts"), "utf8");
const CONTAINMENT = readFileSync(join(import.meta.dirname, "..", "src", "editor", "embed-containment.css"), "utf8");

describe("CardMirror stays inside its own component", () => {
  it("loads the engine stylesheets with the engine, not with the React shell", () => {
    // A static stylesheet import in the shell put the whole engine sheet on
    // every page whose bundle merely imported the package.
    expect(SHELL).not.toMatch(/^import\s+["'][^"']+\.css["'];?$/m);
    for (const sheet of ["style.css", "icons.css", "embed-containment.css"]) {
      expect(SINGLETON).toContain(`import('../editor/${sheet}')`);
    }
    expect(SINGLETON).toMatch(/async function boot\(\): Promise<void> \{\s*await loadEngineStyles\(\);/);
  });

  it("hides the engine's body-level floaters while no editor is mounted", () => {
    expect(CONTAINMENT).toMatch(
      /html:not\(:has\(\.dec-cardmirror-embed\)\) body > \[class\^="pmd-"\],\s*html:not\(:has\(\.dec-cardmirror-embed\)\) body > \[class\*=" pmd-"\] \{\s*display: none !important;/,
    );
  });
});
