import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The editor's document surface has to fill whatever box the host mounts
 * it in — toolbar pinned at the top, everything below it stretching to
 * the bottom and scrolling internally — instead of collapsing to the
 * height of its content and leaving dead space underneath. That contract
 * lives entirely in styles.css, so assert the declarations here.
 */

const css = readFileSync(
  join(import.meta.dirname, "..", "src", "react", "styles.css"),
  "utf8",
);

/** Body of the first rule whose selector list matches `selector`. */
function ruleBody(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `missing rule for \`${selector}\``).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("}", start));
}

describe("reason-editor layout styles", () => {
  it("makes the editor root a full-height flex column", () => {
    const root = ruleBody(".reason-editor");
    expect(root).toMatch(/flex-direction:\s*column/);
    expect(root).toMatch(/height:\s*100%/);
    expect(root).toMatch(/min-height:\s*0/);
    expect(root).toMatch(/max-width:\s*100%/);
  });

  it("keeps the toolbar at its natural height", () => {
    expect(ruleBody(".reason-editor > .reason-editor-toolbar")).toMatch(
      /flex:\s*0 0 auto/,
    );
  });

  it("gives the document surface the remaining space and its own scroll", () => {
    const content = ruleBody(".reason-editor > .reason-editor-content");
    expect(content).toMatch(/flex:\s*1 1 auto/);
    expect(content).toMatch(/min-height:\s*0/);
    expect(content).toMatch(/overflow-y:\s*auto/);
    expect(content).toMatch(/overflow-x:\s*hidden/);
  });

  it("stretches the editable area to the full scroll viewport", () => {
    const pm = ruleBody(".reason-editor .ProseMirror");
    expect(pm).toMatch(/min-height:\s*max\(8rem,\s*100%\)/);
    expect(pm).toMatch(/max-width:\s*100%/);
  });

  it("keeps wide content from forcing sideways page scroll", () => {
    expect(ruleBody(".reason-editor .ProseMirror img")).toMatch(
      /max-width:\s*100%/,
    );
    expect(ruleBody(".reason-editor .ProseMirror pre")).toMatch(
      /overflow-x:\s*auto/,
    );
    expect(ruleBody(".reason-editor .pmd-table")).toMatch(/max-width:\s*100%/);
  });
});
