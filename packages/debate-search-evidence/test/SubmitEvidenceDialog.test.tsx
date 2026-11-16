// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `SubmitEvidenceDialog`, the **Submit card**
 * popup on the cards search page. Covers opening and the three ways to close
 * it (Escape, the close button, a backdrop click), the dialog's accessible
 * name/description, focus moving in on open and back to the trigger on close,
 * and that the Evidence Library form's **Format citation** tool works inside
 * the popup (the evidence-citation-format internals page says it does).
 * Uses this package's jsdom + `react-dom/client` + `act` harness.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";

import { SubmitEvidenceDialog } from "../src/components/SubmitEvidenceDialog";
import { click, flush, mount, type, type Mounted } from "./helpers/mount";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

let view: Mounted;

beforeEach(() => {
  localStorage.clear();
});

afterEach(async () => {
  await view?.unmount();
  localStorage.clear();
});

const trigger = () => view.container.querySelector<HTMLButtonElement>("button[aria-label='Submit a card or block']")!;
const dialog = () => document.body.querySelector<HTMLElement>("[role='dialog']");

async function openDialog() {
  view = await mount(createElement(SubmitEvidenceDialog));
  await click(trigger());
  expect(dialog()).not.toBeNull();
}

describe("SubmitEvidenceDialog", () => {
  it("opens a labelled, described modal with the submission form", async () => {
    view = await mount(createElement(SubmitEvidenceDialog));
    expect(dialog()).toBeNull();
    await click(trigger());

    const el = dialog()!;
    expect(el.getAttribute("aria-modal")).toBe("true");
    const title = document.getElementById(el.getAttribute("aria-labelledby")!);
    expect(title?.textContent).toBe("Submit to the Evidence Library");
    const description = document.getElementById(el.getAttribute("aria-describedby")!);
    expect(description?.textContent).toMatch(/share a cut card/i);
    expect(el.querySelector("#evidence-cite")).not.toBeNull();
    // Submit-only: the library's dashboards stay on its own page.
    expect(el.textContent).not.toContain("Team reuse dashboard");
  });

  it("moves focus into the dialog on open and back to the trigger on Escape", async () => {
    await openDialog();
    expect(dialog()!.contains(document.activeElement)).toBe(true);

    await flush(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it("closes from the close button and returns focus to the trigger", async () => {
    await openDialog();
    await click(dialog()!.querySelector("button[aria-label='Close']")!);
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it("closes on a backdrop press but not on a press inside the dialog", async () => {
    await openDialog();
    const backdrop = dialog()!.parentElement!;

    await flush(() => {
      dialog()!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(dialog()).not.toBeNull();

    await flush(() => {
      backdrop.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(dialog()).toBeNull();
  });

  it("leaves focus alone on close when the user had moved it outside the dialog", async () => {
    const outside = document.createElement("button");
    document.body.append(outside);
    try {
      await openDialog();
      outside.focus();
      await flush(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      });
      expect(document.activeElement).toBe(outside);
    } finally {
      outside.remove();
    }
  });

  it("offers Format citation inside the popup", async () => {
    await openDialog();
    const el = dialog()!;
    const cite = el.querySelector<HTMLInputElement>("#evidence-cite")!;
    await type(cite, "Jane Smith, Professor at MIT, 2024");
    await type(el.querySelector<HTMLInputElement>("#evidence-source-url")!, "https://example.com/a");
    const format = Array.from(el.querySelectorAll("button")).find((b) => b.textContent === "Format citation")!;
    await click(format);
    expect(cite.value).toBe("Smith 24 — Jane Smith, Professor at MIT, 2024, https://example.com/a");
    expect(el.querySelector("[data-cite-note]")?.textContent).toBe("Formatted as Smith 24.");
  });
});
