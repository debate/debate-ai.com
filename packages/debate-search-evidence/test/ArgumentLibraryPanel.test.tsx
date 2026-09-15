// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `ArgumentLibraryPanel`, which had no
 * component test at all before this file. Closes the stale "No rename for an
 * existing collection" / "No editing a saved collection's tag list directly"
 * Known gaps recorded in
 * `packages/debate-help-docs/content/docs/features/argument-library-collections.mdx`
 * — both `useSavedArgumentCollections`'s `renameCollection`/`updateCollection`
 * and this panel's "Rename"/"Update" buttons already existed and were fully
 * wired together, just never exercised by a test, so the doc's gaps had gone
 * stale without anyone noticing. Uses the same jsdom + `react-dom/client` +
 * `act` pattern `debate-videos/test/glowing-effect-listeners.test.tsx` and
 * `debate-round/test/FlowEditLogPanel.test.tsx` established for a component
 * that loads its own data inside a `useEffect` (a `node`-environment
 * `renderToStaticMarkup` snapshot never runs effects, so it can't see this
 * panel's library or saved collections at all).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";

import { ArgumentLibraryPanel } from "../src/panels/ArgumentLibraryPanel";
import { saveEvidenceLibraryEntry } from "../src/state/evidenceLibraryEntries";
import type { EvidenceLibraryEntry } from "../src/lib/shared-evidence-library";
import { click, flush, mount, type } from "./helpers/mount";
import type { Mounted } from "./helpers/mount";

function makeEntry(overrides: Partial<EvidenceLibraryEntry> = {}): EvidenceLibraryEntry {
  return {
    id: "e1",
    argBlock: "Warming DA",
    wordCount: 100,
    topic: "Should the US increase environmental regulations",
    caseArea: "Neg",
    tags: ["warming"],
    kind: "card",
    text: "The ice caps are melting fast.",
    cite: "Smith 24",
    ...overrides,
  };
}

function byTagText(container: HTMLElement, tag: string, text: string): HTMLElement | null {
  return (
    (Array.from(container.querySelectorAll(tag)).find((el) => el.textContent?.trim() === text) as
      | HTMLElement
      | undefined) ?? null
  );
}

function byAriaLabel(container: HTMLElement, tag: string, label: string): HTMLElement | null {
  return (
    (Array.from(container.querySelectorAll(tag)).find((el) => el.getAttribute("aria-label") === label) as
      | HTMLElement
      | undefined) ?? null
  );
}

const buttonByText = (container: HTMLElement, text: string) =>
  byTagText(container, "button", text) as HTMLButtonElement | null;
const buttonByLabel = (container: HTMLElement, label: string) =>
  byAriaLabel(container, "button", label) as HTMLButtonElement | null;
const inputByAriaLabel = (container: HTMLElement, label: string) =>
  byAriaLabel(container, "input", label) as HTMLInputElement | null;
const inputById = (container: HTMLElement, id: string) =>
  container.querySelector(`#${id}`) as HTMLInputElement | null;

async function selectOption(select: HTMLSelectElement, value: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  await flush(() => {
    setter?.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

let view: Mounted;

beforeEach(() => {
  localStorage.clear();
  // No fetch stub means `useSavedArgumentCollections`'s account-sync merge
  // rejects (no `fetch` global under plain jsdom), which the hook already
  // treats as "signed out, stay local-only" — exactly the state these tests
  // want, so nothing here talks to a real network.
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("no network in tests")));
});

afterEach(async () => {
  await view?.unmount();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("ArgumentLibraryPanel empty state", () => {
  it("shows the empty state with no persisted entries", async () => {
    view = await mount(createElement(ArgumentLibraryPanel));
    expect(view.container.textContent).toContain("No argument library entries yet.");
  });
});

describe("ArgumentLibraryPanel library rendering", () => {
  it("renders topic folders and tag collections from persisted entries", async () => {
    saveEvidenceLibraryEntry(makeEntry());
    saveEvidenceLibraryEntry(
      makeEntry({ id: "e2", argBlock: "Case", caseArea: "Aff", tags: ["warming", "econ"] }),
    );

    view = await mount(createElement(ArgumentLibraryPanel));

    expect(view.container.textContent).toContain("Should the US increase environmental regulations");
    expect(buttonByText(view.container, "warming (2)")).not.toBeNull();
    expect(buttonByText(view.container, "econ (1)")).not.toBeNull();
  });

  it("filters to the tagged cards and back when a tag chip is toggled", async () => {
    saveEvidenceLibraryEntry(makeEntry());
    view = await mount(createElement(ArgumentLibraryPanel));

    expect(buttonByText(view.container, "Clear filter")).toBeNull();

    await click(buttonByText(view.container, "warming (1)")!);
    expect(buttonByText(view.container, "Clear filter")).not.toBeNull();

    await click(buttonByText(view.container, "Clear filter")!);
    expect(buttonByText(view.container, "Clear filter")).toBeNull();
  });
});

describe("ArgumentLibraryPanel saved collections", () => {
  async function saveCollection(name: string, tagLabel: string) {
    await click(buttonByText(view.container, tagLabel)!);
    await type(inputById(view.container, "save-collection-name")!, name);
    await click(buttonByText(view.container, "Save collection")!);
  }

  beforeEach(async () => {
    saveEvidenceLibraryEntry(makeEntry());
    saveEvidenceLibraryEntry(
      makeEntry({ id: "e2", argBlock: "Case", caseArea: "Aff", tags: ["warming", "econ"] }),
    );
    view = await mount(createElement(ArgumentLibraryPanel));
  });

  it("saves the current tag selection under a name", async () => {
    await saveCollection("Warming Answers", "warming (2)");

    expect(view.container.textContent).toContain('Saved "Warming Answers" (1 tag).');
    expect(buttonByText(view.container, "Warming Answers (1)")).not.toBeNull();
  });

  it("refuses a second collection with the same name", async () => {
    await saveCollection("Warming Answers", "warming (2)");
    await click(buttonByText(view.container, "Clear filter")!);
    await saveCollection("Warming Answers", "econ (1)");

    expect(view.container.textContent).toContain('A collection named "Warming Answers" already exists.');
    // Still only the one collection from the first, successful save.
    expect(buttonByText(view.container, "Warming Answers (1)")).not.toBeNull();
  });

  it("applies a saved collection's tags when its button is clicked", async () => {
    await saveCollection("Warming Answers", "warming (2)");
    await click(buttonByText(view.container, "Clear filter")!);
    expect(buttonByText(view.container, "Clear filter")).toBeNull();

    await click(buttonByText(view.container, "Warming Answers (1)")!);

    expect(buttonByText(view.container, "Clear filter")).not.toBeNull();
  });

  it("renames a saved collection", async () => {
    await saveCollection("Warming Answers", "warming (2)");

    await click(buttonByLabel(view.container, 'Rename saved collection "Warming Answers"')!);
    const renameInput = inputByAriaLabel(view.container, 'New name for saved collection "Warming Answers"');
    expect(renameInput).not.toBeNull();
    await type(renameInput!, "Warming Rebuttals");
    await click(buttonByText(view.container, "Save")!);

    expect(view.container.textContent).toContain('Renamed "Warming Answers" to "Warming Rebuttals".');
    expect(buttonByText(view.container, "Warming Rebuttals (1)")).not.toBeNull();
    expect(buttonByLabel(view.container, 'Rename saved collection "Warming Answers"')).toBeNull();
  });

  it("refuses renaming onto another saved collection's name", async () => {
    await saveCollection("Warming Answers", "warming (2)");
    await click(buttonByText(view.container, "Clear filter")!);
    await saveCollection("Econ Answers", "econ (1)");

    await click(buttonByLabel(view.container, 'Rename saved collection "Econ Answers"')!);
    const renameInput = inputByAriaLabel(view.container, 'New name for saved collection "Econ Answers"');
    await type(renameInput!, "Warming Answers");
    await click(buttonByText(view.container, "Save")!);

    expect(view.container.textContent).toContain('A collection named "Warming Answers" already exists.');
    // The rename editor stays open on a refused rename rather than silently
    // closing, so the user can see the message and try a different name.
    expect(inputByAriaLabel(view.container, 'New name for saved collection "Econ Answers"')).not.toBeNull();
  });

  it("replaces a saved collection's tags with the current selection", async () => {
    await saveCollection("Warming Answers", "warming (2)");
    await click(buttonByText(view.container, "econ (1)")!);

    await click(
      buttonByLabel(view.container, 'Update saved collection "Warming Answers" to the current selection')!,
    );

    expect(view.container.textContent).toContain('Updated "Warming Answers" to the current 2-tag selection.');
    expect(buttonByText(view.container, "Warming Answers (2)")).not.toBeNull();
  });

  it("removes a saved collection", async () => {
    await saveCollection("Warming Answers", "warming (2)");
    expect(buttonByText(view.container, "Warming Answers (1)")).not.toBeNull();

    await click(buttonByLabel(view.container, 'Remove saved collection "Warming Answers"')!);

    expect(buttonByText(view.container, "Warming Answers (1)")).toBeNull();
  });
});

describe("ArgumentLibraryPanel tag rename/merge", () => {
  it("renames a tag across every entry that carries it", async () => {
    saveEvidenceLibraryEntry(makeEntry());
    saveEvidenceLibraryEntry(
      makeEntry({ id: "e2", argBlock: "Case", caseArea: "Aff", tags: ["warming", "econ"] }),
    );
    view = await mount(createElement(ArgumentLibraryPanel));

    const oldTagSelect = view.container.querySelector("#rename-tag-old") as HTMLSelectElement;
    await selectOption(oldTagSelect, "warming");
    await type(view.container.querySelector("#rename-tag-new") as HTMLInputElement, "global-warming");
    await click(buttonByText(view.container, "Rename/merge")!);

    expect(view.container.textContent).toContain(
      'Renamed "warming" to "global-warming" on 2 evidence entries and 0 contributions.',
    );
    expect(buttonByText(view.container, "global-warming (2)")).not.toBeNull();
    expect(buttonByText(view.container, "warming (2)")).toBeNull();
  });
});
