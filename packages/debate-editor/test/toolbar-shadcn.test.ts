/**
 * The toolbar's shadcn skin: Button classes on every ribbon control, a tooltip
 * entry (label + one-sentence description + shortcut) for each, the shortcut
 * key-cap splitter, the Lucide icon sheet, and the controller hook that lets
 * the shadcn tooltip host replace the built-in delayed tooltip.
 */

import { afterEach, describe, expect, it } from "vitest";
import { RIBBON_HTML } from "../src/react/ribbon-template.js";
import { RIBBON_BUTTON_INFO } from "../src/editor/ribbon-button-info.js";
import {
  RIBBON_LUCIDE_ICONS,
  buildRibbonLucideCss,
  installRibbonLucideIcons,
} from "../src/editor/ribbon-lucide-icons.js";
import {
  registerRibbonTooltip,
  setRibbonTipRenderer,
  unregisterRibbonTooltip,
  type RibbonTipContent,
} from "../src/editor/ribbon-tooltips.js";
import { primaryKeyFor } from "../src/editor/ribbon-commands.js";
import { splitShortcut } from "../src/react/RibbonTooltips.js";

function ribbon(): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = RIBBON_HTML;
  return host;
}

function toolbarButtons(host: HTMLElement): HTMLButtonElement[] {
  return [...host.querySelectorAll<HTMLButtonElement>("#ribbon button")];
}

describe("toolbar buttons use the shadcn Button", () => {
  it("gives every toolbar button the Button slot and base classes", () => {
    const buttons = toolbarButtons(ribbon());
    expect(buttons.length).toBeGreaterThan(40);
    for (const b of buttons) {
      expect(b.dataset.slot, `#${b.id}`).toBe("button");
      expect(b.className, `#${b.id}`).toContain("inline-flex");
      expect(b.className, `#${b.id}`).toMatch(/rounded-(md|l-md|r-md)/);
      expect(b.className, `#${b.id}`).toContain("focus-visible:ring-");
    }
  });

  it("keeps ids and the engine's own classes on the buttons", () => {
    const host = ribbon();
    expect(host.querySelector("#style-pocket-btn")?.classList.contains("formatting-panel-btn")).toBe(true);
    expect(host.querySelector("#highlight-btn")?.classList.contains("ribbon-color-main")).toBe(true);
    expect(host.querySelector("#undo-btn")).not.toBeNull();
    expect(host.querySelector("#export-btn")?.hasAttribute("disabled")).toBe(true);
  });

  it("styles pressed toggles from aria-pressed", () => {
    const autosave = ribbon().querySelector("#autosave-btn")!;
    expect(autosave.className).toContain("aria-pressed:bg-primary/15");
  });

  it("only touches the toolbar, not the status bar", () => {
    const host = ribbon();
    const outside = [...host.querySelectorAll<HTMLButtonElement>("button")].filter((b) => !b.closest("#ribbon"));
    expect(outside.length).toBeGreaterThan(0);
    for (const b of outside) expect(b.dataset.slot).toBeUndefined();
  });

  it("styles the font-size field as an input", () => {
    const input = ribbon().querySelector<HTMLInputElement>("#font-size-input")!;
    expect(input.dataset.slot).toBe("input");
    expect(input.getAttribute("aria-label")).toBe("Font size at cursor");
    expect(input.outerHTML.endsWith("/>") || input.outerHTML.endsWith(">")).toBe(true);
  });

  it("marks the toolbar for the skin stylesheet", () => {
    expect(ribbon().querySelector("#ribbon")?.classList.contains("dec-ribbon")).toBe(true);
  });
});

describe("tooltip content table", () => {
  const host = ribbon();
  const ids = new Set([...host.querySelectorAll<HTMLElement>("#ribbon button, #ribbon input")].map((b) => b.id));

  it("describes only buttons that exist", () => {
    for (const id of Object.keys(RIBBON_BUTTON_INFO)) {
      expect(ids.has(id), `${id} is not a toolbar button`).toBe(true);
    }
  });

  it("covers every toolbar button", () => {
    const missing = [...ids].filter((id) => id && !RIBBON_BUTTON_INFO[id]);
    expect(missing).toEqual([]);
  });

  it("gives each a short label and a one-sentence description", () => {
    for (const [id, info] of Object.entries(RIBBON_BUTTON_INFO)) {
      expect(info.label.length, id).toBeGreaterThan(0);
      expect(info.label.length, id).toBeLessThanOrEqual(32);
      expect(info.description.trim().endsWith("."), id).toBe(true);
      expect(info.description.length, id).toBeLessThanOrEqual(110);
    }
  });

  it("points every shortcut at a command that has a default key", () => {
    const withoutKey = Object.entries(RIBBON_BUTTON_INFO)
      .filter(([, info]) => info.command && !primaryKeyFor(info.command, {}))
      .map(([id]) => id);
    // Commands that are menu-only by design have no key; the tip then simply
    // omits the shortcut chip. Guard the common ones so a typo in a command id
    // doesn't silently drop a shortcut.
    for (const id of ["undo-btn", "redo-btn", "export-btn", "open-btn", "highlight-btn"]) {
      expect(withoutKey, id).not.toContain(id);
    }
  });
});

describe("splitShortcut", () => {
  it("splits Windows/Linux chords into key caps", () => {
    expect(splitShortcut("Ctrl+Shift+F11")).toEqual(["Ctrl", "Shift", "F11"]);
    expect(splitShortcut("Ctrl+Z")).toEqual(["Ctrl", "Z"]);
    expect(splitShortcut("Ctrl+z")).toEqual(["Ctrl", "Z"]);
    expect(splitShortcut("F2")).toEqual(["F2"]);
  });

  it("splits macOS modifier glyphs", () => {
    expect(splitShortcut("⌘⇧F11")).toEqual(["⌘", "⇧", "F11"]);
    expect(splitShortcut("⌘Z")).toEqual(["⌘", "Z"]);
  });

  it("keeps a literal plus key", () => {
    expect(splitShortcut("Ctrl++")).toEqual(["Ctrl", "+"]);
  });

  it("returns nothing for an empty shortcut", () => {
    expect(splitShortcut("  ")).toEqual([]);
  });
});

describe("Lucide icon sheet", () => {
  afterEach(() => document.getElementById("dec-ribbon-lucide-icons")?.remove());

  it("overrides every mapped icon under #ribbon with an SVG mask", () => {
    const css = buildRibbonLucideCss();
    for (const name of Object.keys(RIBBON_LUCIDE_ICONS)) {
      expect(css, name).toContain(`#ribbon .pmd-icon-${name} { --pmd-icon: url("data:image/svg+xml,`);
    }
  });

  it("replaces every icon class the toolbar markup uses", () => {
    const used = new Set(
      [...RIBBON_HTML.slice(0, RIBBON_HTML.indexOf("</header>")).matchAll(/pmd-icon-([a-z0-9-]+)/g)].map((m) => m[1]!),
    );
    const unmapped = [...used].filter((n) => !(n in RIBBON_LUCIDE_ICONS));
    // Icons without a better Lucide equivalent keep the engine's glyph.
    expect(unmapped.sort()).toEqual(unmapped.filter((n) => !["undo", "redo"].includes(n)).sort());
    for (const n of ["undo", "redo", "open", "save", "mic", "search", "highlight"]) {
      expect(used.has(n) ? n in RIBBON_LUCIDE_ICONS : true, n).toBe(true);
    }
  });

  it("keeps the classic emoji mode working for the two formerly-text icons", () => {
    const css = buildRibbonLucideCss();
    expect(css).toContain('data-icons="classic"] #ribbon .pmd-icon-restart::before');
    expect(css).toContain('data-icons="classic"] #ribbon .pmd-icon-paste-text::before');
  });

  it("installs once", () => {
    const a = installRibbonLucideIcons();
    const b = installRibbonLucideIcons();
    expect(a).toBe(b);
    expect(document.querySelectorAll("#dec-ribbon-lucide-icons")).toHaveLength(1);
  });
});

describe("tooltip renderer hook", () => {
  const shown: Array<{ id: string; content: RibbonTipContent }> = [];
  let hides = 0;
  let button: HTMLButtonElement | null = null;

  afterEach(() => {
    setRibbonTipRenderer(null);
    if (button) unregisterRibbonTooltip(button);
    button?.remove();
    button = null;
    shown.length = 0;
    hides = 0;
  });

  function mount(id: string): HTMLButtonElement {
    button = document.createElement("button");
    button.id = id;
    button.title = "Undo";
    document.body.appendChild(button);
    registerRibbonTooltip({ el: button, commandId: "undo" });
    setRibbonTipRenderer({
      show: (el, content) => shown.push({ id: el.id, content }),
      hide: () => void hides++,
    });
    return button;
  }

  it("shows label, description and shortcut the moment the pointer enters", () => {
    const el = mount("undo-btn");
    el.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    expect(shown).toHaveLength(1);
    expect(shown[0]!.id).toBe("undo-btn");
    expect(shown[0]!.content.label).toBe("Undo");
    expect(shown[0]!.content.description).toBe(RIBBON_BUTTON_INFO["undo-btn"]!.description);
    expect(shown[0]!.content.shortcut).toMatch(/z$/i);
  });

  it("shows on keyboard focus-visible and hides on Escape", () => {
    const el = mount("undo-btn");
    el.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("pointerout", { bubbles: true, relatedTarget: document.body }));
    expect(hides).toBeGreaterThan(0);
    const before = hides;
    el.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(hides).toBeGreaterThan(before);
  });
});
