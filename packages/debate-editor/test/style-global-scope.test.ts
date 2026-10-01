/**
 * The engine stylesheet is unlayered, and unlayered CSS outranks the host
 * app's `@layer base` rules no matter how specific they are. So every
 * page-level selector in it is not a tie to be won on specificity — it is
 * the engine repainting the host. `body { background; color; font-family }`
 * hands the whole page the engine's palette, a bare `:focus` reset erases
 * the host's focus rings, a bare `code` rule restyles every inline code span
 * in the app, and a `:root[data-motion="reduce"] *` rule (the media-query
 * variant matches whenever the attribute is merely ABSENT) kills all motion
 * everywhere.
 *
 * These assertions lock the scoping in. A future upstream rebase that
 * reintroduces a bare selector fails here instead of quietly wrecking every
 * page the editor is embedded in.
 *
 * The tokens themselves stay on `:root` on purpose: JS resolves several of
 * them off `document.documentElement` (benchmark-ui.ts, settings-ui.ts), and
 * the floaters resolve them from wherever they are mounted. Only the
 * *application* of the resets is scoped.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CSS = readFileSync(join(import.meta.dirname, "..", "src", "editor", "style.css"), "utf8");


/** Rules whose selector could match host-owned elements — i.e. anything the
 * engine did not put inside its own container or a `pmd-` floater root. */
function unscopedSelectors(): string[] {
  // Strip comments and @keyframes bodies (their `from`/`to`/`50%` children are
  // not selectors we own).
  const noComments = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  const keyframeBodies = [...noComments.matchAll(/@keyframes\s+[\w-]+\s*\{(?:[^{}]|\{[^{}]*\})*\}/g)].map((m) => m[0]);
  const scannable = keyframeBodies.reduce((acc, block) => acc.replace(block, ""), noComments);

  const selectors: string[] = [];
  for (const m of scannable.matchAll(/([^{}]+)\{/g)) {
    const sel = (m[1] ?? "").trim();
    if (!sel || sel.startsWith("@")) continue;
    selectors.push(...sel.split(",").map((s) => s.trim()).filter(Boolean));
  }
  return selectors;
}

const ENGINE_SCOPE = /\.dec-cardmirror-root|\.pmd-|\.ribbon-|\.ProseMirror|\.cm-|\.status-|\.zoom-controls/;

describe("style.css global scope", () => {
  it("never styles bare page-level elements", () => {
    // `body { margin: 0 }` is deliberately kept: the host resets margin to 0
    // too, so it agrees with the host rather than fighting it.
    const allowed = new Set(["body", ":root"]);
    const offenders = unscopedSelectors().filter(
      (sel) => /^(body|html|code|button|\*|:focus|:focus-visible)$/.test(sel) && !allowed.has(sel),
    );
    expect(offenders).toEqual([]);
  });

  it("does not force reduced motion on host-owned elements", () => {
    // Both the explicit attribute and the prefers-reduced-motion variant must
    // stay scoped: the engine writes `data-motion` to the SHARED <html>, and
    // the media-query rule matches when the attribute is absent, which is the
    // default on every machine whose OS asks for reduced motion.
    const offenders = unscopedSelectors().filter((sel) => /:root[^\n]*\*/.test(sel) && !ENGINE_SCOPE.test(sel));
    expect(offenders).toEqual([]);
  });

  it("does not blank the host when printing", () => {
    const printBlock = CSS.slice(CSS.indexOf("@media print"));
    // The blanket `body * { visibility: hidden }` only fires once the
    // reference print root is in the document.
    expect(printBlock).not.toMatch(/^\s*body \*\s*\{/m);
    expect(printBlock).toMatch(/body:has\(\.pmd-reference-print-root\) \*/);
  });

  it("keeps scroll padding off the host's <html> when embedded", () => {
    // `html { scroll-padding-* }` is the one <html> rule that reaches host
    // content — it shifts where every scroll position on the page lands. Only
    // the page-owning deployment scrolls the document; in an embed the scroller
    // is the engine's own box and the host owns <html>. The other
    // `html:not(.pmd-…)` rules in this sheet gate on engine state but select
    // engine ids/classes, so they are not host-facing and are left alone.
    const offenders = unscopedSelectors().filter((sel) => /^html\b/.test(sel) && /scroll-padding/.test(sel));
    expect(offenders).toEqual([]);
    expect(CSS).toMatch(/html:not\(:has\(\.dec-cardmirror-embed\)\) \{\s*scroll-padding-top/);
  });

  it("still styles the engine's own container and body-mounted floaters", () => {
    // Scoping must not be so aggressive that the editor loses its palette:
    // the reset block has to reach the container AND the transient floaters
    // the engine mounts on <body> (tooltips, dialogs, the pill tray), which
    // sit outside the container by design.
    expect(CSS).toContain(':where(.dec-cardmirror-root, body > [class^="pmd-"], body > [class*=" pmd-"]) {');
    expect(CSS).toMatch(/font-family: var\(--pmd-ui-font\)/);
  });

  it("keeps the scoped resets at zero specificity", () => {
    // Scoped with plain selectors, the resets outranked the engine's own
    // single-class rules: `body > [class^="pmd-"]` is 0-1-1, so the opaque
    // background landed on every engine element (the see-through, full-window
    // `.pmd-tour` layer painted the whole host page white) and the document
    // lost its body font. `:where()` keeps them as weak as the bare `*` /
    // `body` rules they replaced.
    const noComments = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
    const SCOPE = ':where(.dec-cardmirror-root, body > [class^="pmd-"], body > [class*=" pmd-"])';
    for (const tail of [" *", " :focus", " :focus-visible", " button", " code", " [data-shading]"]) {
      expect(noComments).toContain(SCOPE + tail);
    }
    expect(noComments).not.toMatch(/^:is\(\.dec-cardmirror-root, body > \[class\^="pmd-"\], body > \[class\*=" pmd-"\]\) \*/m);
    for (const plain of [
      ".dec-cardmirror-root :focus",
      ".dec-cardmirror-root button",
      ".dec-cardmirror-root code",
      ".dec-cardmirror-root [data-shading]",
    ]) {
      expect(noComments).not.toContain(plain);
    }
  });

  it("paints the background on the container alone", () => {
    const noComments = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
    const reset = noComments.match(
      /:where\(\.dec-cardmirror-root, body > \[class\^="pmd-"\], body > \[class\*=" pmd-"\]\) \{([^}]*)\}/,
    );
    expect(reset?.[1]).toMatch(/color: var\(--pmd-c-text\)/);
    expect(reset?.[1]).not.toMatch(/background/);
    expect(noComments).toMatch(/:where\(\.dec-cardmirror-root\) \{\s*background: var\(--pmd-c-bg\);/);
  });
});
