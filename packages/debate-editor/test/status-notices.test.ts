import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetNoticesForTests,
  postNotice,
  wireStatusNotices,
} from "../src/editor/status-notices.js";

function setupChip(): HTMLButtonElement {
  document.body.innerHTML = '<button id="notice-chip" hidden></button>';
  wireStatusNotices();
  return document.getElementById("notice-chip") as HTMLButtonElement;
}

function openPanelByClickingChip(chip: HTMLButtonElement): HTMLElement {
  chip.click();
  const panel = document.querySelector(".pmd-notice-panel");
  if (!panel) throw new Error("panel did not open");
  return panel as HTMLElement;
}

function findButton(panel: HTMLElement, text: string): HTMLButtonElement | null {
  return (
    (Array.from(panel.querySelectorAll("button")).find(
      (b) => b.textContent === text,
    ) as HTMLButtonElement | undefined) ?? null
  );
}

describe("status notices — download offer", () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    __resetNoticesForTests();
    createObjectURL = vi.fn(() => "blob:mock-url");
    revokeObjectURL = vi.fn();
    // jsdom doesn't implement these — every anchor+Blob download path in
    // this repo needs them stubbed to run under Vitest.
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
  });

  afterEach(() => {
    __resetNoticesForTests();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("renders no Download button when a notice has no download payload", () => {
    const chip = setupChip();
    postNotice({ severity: "warning", title: "Heads up", body: "Something happened.", toast: false });
    const panel = openPanelByClickingChip(chip);
    expect(findButton(panel, "Download")).toBeNull();
  });

  it("renders a Download button that saves the attached content", () => {
    const chip = setupChip();
    postNotice({
      severity: "error",
      title: "Couldn't read this document's saved content",
      body: "Download the raw content and salvage it yourself.",
      toast: false,
      download: { filename: "unreadable-doc-1.html", content: "<p>lost work</p>" },
    });
    const panel = openPanelByClickingChip(chip);
    const downloadBtn = findButton(panel, "Download");
    expect(downloadBtn).not.toBeNull();

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    downloadBtn!.click();

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0]![0] as Blob;
    expect(blob.type).toBe("text/html");
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    clickSpy.mockRestore();
  });

  it("keeps a previously-attached download across a coalesced repeat that omits it", () => {
    const chip = setupChip();
    postNotice({
      severity: "error",
      title: "Couldn't read this document's saved content",
      body: "first",
      toast: false,
      key: "cardmirror-unreadable:doc-1",
      download: { filename: "unreadable-doc-1.html", content: "<p>first</p>" },
    });
    // A repeat under the same key, as markUnreadable's own re-entrancy guard
    // means never happens twice for one key in practice — but postNotice's
    // general coalescing path (shared with every other notice) must not
    // silently drop the download offer if it ever did.
    postNotice({
      severity: "error",
      title: "Couldn't read this document's saved content",
      body: "second",
      toast: false,
      key: "cardmirror-unreadable:doc-1",
    });

    const panel = openPanelByClickingChip(chip);
    expect(findButton(panel, "Download")).not.toBeNull();
  });

  it("hides the chip again once the notice is dismissed", () => {
    const chip = setupChip();
    postNotice({
      severity: "error",
      title: "Couldn't read this document's saved content",
      body: "body",
      toast: false,
      download: { filename: "doc.html", content: "<p>x</p>" },
    });
    expect(chip.hidden).toBe(false);
    const panel = openPanelByClickingChip(chip);
    findButton(panel, "Dismiss")!.click();
    expect(chip.hidden).toBe(true);
  });
});
