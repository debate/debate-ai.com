// @vitest-environment jsdom
/**
 * @fileoverview The plus button beside the library search bar opens a dialog
 * that files a video or channel to the moderators' queue (`/api/video-issues`)
 * rather than publishing anything itself.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { SubmitToLibraryButton } from "../src/components/video-search/SubmitToLibraryButton";
import { click, flush, mount, type, type Mounted } from "./helpers/mount";

let mounted: Mounted | null = null;

afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

/** Finds a button anywhere in the document (the dialog portals to body). */
function button(label: string): HTMLButtonElement {
  const found = [...document.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === label || b.getAttribute("aria-label") === label,
  );
  if (!found) throw new Error(`No button ${label}`);
  return found as HTMLButtonElement;
}

async function submit() {
  const form = document.querySelector("form")!;
  await flush(() => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

describe("SubmitToLibraryButton", () => {
  it("submits a video link to the moderators' queue", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true })));
    vi.stubGlobal("fetch", fetchMock);
    mounted = await mount(<SubmitToLibraryButton />);

    await click(button("Submit a video or channel"));
    expect(document.body.textContent).toContain("Add to the library");

    const [url, title] = [...document.querySelectorAll("input")] as HTMLInputElement[];
    await type(url, " https://youtu.be/dQw4w9WgXcQ ");
    await type(title, "TOC Finals");
    await type(document.querySelector("textarea")!, "2024 TOC");
    await submit();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(endpoint).toBe("/api/video-issues");
    expect(JSON.parse(String(init.body))).toEqual({
      kind: "submit-video",
      url: "https://youtu.be/dQw4w9WgXcQ",
      note: "2024 TOC",
      title: "TOC Finals",
    });
    expect(document.body.textContent).toContain("in the moderators");
  });

  it("shows the server's error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "Sign in to submit to the library" }), { status: 401 })),
    );
    mounted = await mount(<SubmitToLibraryButton />);
    await click(button("Submit a video or channel"));
    await type(document.querySelector("input")!, "https://youtu.be/dQw4w9WgXcQ");
    await submit();
    expect(document.body.textContent).toContain("Sign in to submit to the library");
  });
});
