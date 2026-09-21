// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `PrepNotesPanel`'s `signedInContributorId`
 * prefill — the fix for `prep-notes.mdx`'s Known gaps entry noting a
 * reply's "Your name" field was free-form with no link to a real identity.
 * Mirrors `PrepNoteNotificationsPanel.test.tsx`'s jsdom + `react-dom/client`
 * + `act` pattern (this panel loads its data inside a `useEffect`, so a
 * `node`-environment `renderToStaticMarkup` snapshot never sees it) and
 * `debate-contributor-progress/test/ProgressUnlocksPanel.test.tsx`'s
 * `signedInContributorId` prefill coverage style.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createElement } from "react";

import { PrepNotesPanel } from "../src/panels/PrepNotesPanel";
import { addRoundPrepNote } from "../src/state/prepNotes";
import { click, mount, type } from "./helpers/mount";
import type { Mounted } from "./helpers/mount";

function byTagText(container: HTMLElement, tag: string, text: string): HTMLElement | null {
  return (
    (Array.from(container.querySelectorAll(tag)).find((el) => el.textContent?.trim() === text) as
      | HTMLElement
      | undefined) ?? null
  );
}

const buttonByText = (container: HTMLElement, text: string) =>
  byTagText(container, "button", text) as HTMLButtonElement | null;

function replyAuthorInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector('input[id^="prep-note-reply-author-"]') as HTMLInputElement;
}

let view: Mounted;

beforeEach(() => {
  localStorage.clear();
  addRoundPrepNote({ roundId: "round-1", authorId: "coach", text: "Cut the warming impact card" });
});

afterEach(async () => {
  await view?.unmount();
  localStorage.clear();
});

describe("PrepNotesPanel reply 'Your name' prefill", () => {
  it("prefills a reply's author field with the signed-in contributor id", async () => {
    view = await mount(<PrepNotesPanel signedInContributorId="alice" />);

    await click(buttonByText(view.container, "Replies (0)")!);

    expect(replyAuthorInput(view.container).value).toBe("alice");
  });

  it("leaves the field blank without a signed-in contributor id", async () => {
    view = await mount(createElement(PrepNotesPanel));

    await click(buttonByText(view.container, "Replies (0)")!);

    expect(replyAuthorInput(view.container).value).toBe("");
  });

  it("never overwrites a reply author the visitor already typed over", async () => {
    view = await mount(<PrepNotesPanel signedInContributorId="alice" />);

    await click(buttonByText(view.container, "Replies (0)")!);
    await type(replyAuthorInput(view.container), "bob");

    expect(replyAuthorInput(view.container).value).toBe("bob");
  });

  it("posts a reply under the prefilled signed-in author without retyping it", async () => {
    view = await mount(<PrepNotesPanel signedInContributorId="alice" />);

    await click(buttonByText(view.container, "Replies (0)")!);
    const textarea = view.container.querySelector(
      'textarea[id^="prep-note-reply-text-"]',
    ) as HTMLTextAreaElement;
    await type(textarea, "Sounds good");
    await click(buttonByText(view.container, "Post")!);

    expect(view.container.textContent).toContain("alice");
    expect(view.container.textContent).toContain("Sounds good");
  });
});
