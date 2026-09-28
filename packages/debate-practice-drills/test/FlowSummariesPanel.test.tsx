// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `FlowSummariesPanel`'s
 * `signedInContributorId` prefill on the "Send to Prep Notes" form — the fix
 * for `prep-notes.mdx`'s Known gaps entry noting that form's "Your name"
 * field was free-form with no link to a real identity. Uses the jsdom +
 * `react-dom/client` + `act` pattern `debate-team-collaboration/test/PrepNoteNotificationsPanel.test.tsx`
 * established (a `node`-environment `renderToStaticMarkup` snapshot never
 * runs this panel's mount-time `useEffect`, so it can't see its persisted
 * records at all) — this package's first use of that pattern, so it also
 * adds `test/helpers/mount.tsx`, mirroring
 * `debate-team-collaboration/test/helpers/mount.tsx`'s `mount`/`click`/
 * `type` API exactly rather than inventing a new one.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FlowSummariesPanel } from "../src/panels/FlowSummariesPanel";
import { saveFlowSummary, type FlowSummaryRecord } from "../src/state/flowSummaries";
import { click, mount, type } from "./helpers/mount";
import type { Mounted } from "./helpers/mount";

const SUMMARY_A: FlowSummaryRecord = {
  roundId: "round-1",
  summaries: [
    {
      rowIndex: 0,
      isHeading: false,
      argument: "Solvency deficit — the plan can't overcome bureaucratic inertia.",
      originSpeech: "1AC",
      entries: [
        { speech: "1AC", content: "Solvency deficit — the plan can't overcome bureaucratic inertia." },
      ],
      lastSpeech: "1AC",
      isUnanswered: true,
    },
  ],
};

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement | null {
  return (
    (Array.from(container.querySelectorAll("button")).find((el) => el.textContent?.trim() === text) as
      | HTMLButtonElement
      | undefined) ?? null
  );
}

function sendAuthorInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector('input[id^="flow-summaries-send-author-"]') as HTMLInputElement;
}

let view: Mounted;

beforeEach(() => {
  localStorage.clear();
  saveFlowSummary(SUMMARY_A);
});

afterEach(async () => {
  await view?.unmount();
  localStorage.clear();
});

describe("FlowSummariesPanel 'Send to Prep Notes' author prefill", () => {
  it("prefills the form's author field with the signed-in contributor id", async () => {
    view = await mount(<FlowSummariesPanel onSendToPrepNotes={() => {}} signedInContributorId="alice" />);

    await click(buttonByText(view.container, "Send to Prep Notes")!);

    expect(sendAuthorInput(view.container).value).toBe("alice");
  });

  it("leaves the field blank without a signed-in contributor id", async () => {
    view = await mount(<FlowSummariesPanel onSendToPrepNotes={() => {}} />);

    await click(buttonByText(view.container, "Send to Prep Notes")!);

    expect(sendAuthorInput(view.container).value).toBe("");
  });

  it("never overwrites an author id the visitor already typed over", async () => {
    view = await mount(<FlowSummariesPanel onSendToPrepNotes={() => {}} signedInContributorId="alice" />);

    await click(buttonByText(view.container, "Send to Prep Notes")!);
    await type(sendAuthorInput(view.container), "bob");

    expect(sendAuthorInput(view.container).value).toBe("bob");
  });

  it("sends under the prefilled signed-in author without retyping it", async () => {
    const sent: { roundId: string; authorId: string; text: string }[] = [];
    view = await mount(
      <FlowSummariesPanel onSendToPrepNotes={(input) => sent.push(input)} signedInContributorId="alice" />,
    );

    await click(buttonByText(view.container, "Send to Prep Notes")!);
    await click(buttonByText(view.container, "Send")!);

    expect(sent).toHaveLength(1);
    expect(sent[0].authorId).toBe("alice");
    expect(sent[0].roundId).toBe("round-1");
  });
});
