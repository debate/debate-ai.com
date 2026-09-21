// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `BrainstormBoardPanel`'s account-synced
 * session timer (`useBrainstormSessionTimerSync`) — closes
 * `brainstorm-board.mdx`'s Known gaps entry "The session timer is
 * `localStorage`-only, not account-synced." Mirrors
 * `PrepNotesPanel.test.tsx`'s jsdom + `react-dom/client` + `act` pattern,
 * plus `debate-round/test/flow-sync-client.test.ts`'s `vi.stubGlobal("fetch", ...)`
 * mocking style.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";

import { BrainstormBoardPanel } from "../src/panels/BrainstormBoardPanel";
import { startSessionTimer } from "../src/state/brainstormSessionTimer";
import { click, flush, mount } from "./helpers/mount";
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

/** Stubs `fetch` to answer every call (GET or PUT) the same way, mirroring `/api/settings`'s shape closely enough for this hook. */
function stubFetch(response: Record<string, unknown>, status = 200) {
  const fetchMock = vi.fn(async () => ({
    ok: status < 400,
    status,
    json: async () => response,
  })) as unknown as typeof fetch;
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Lets a mocked `fetch`'s microtask chain (fetch → `.json()` → `.then`) fully settle before assertions, inside `act`. */
async function settle(): Promise<void> {
  await flush(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
}

let view: Mounted;

beforeEach(() => {
  localStorage.clear();
});

afterEach(async () => {
  await view?.unmount();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("BrainstormBoardPanel session-timer account sync", () => {
  it("never calls fetch when signed out", async () => {
    const fetchMock = stubFetch({ brainstormSessionTimer: null });

    view = await mount(createElement(BrainstormBoardPanel));
    await settle();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("adopts the account's saved timer while the local timer is idle", async () => {
    stubFetch({
      brainstormSessionTimer: { durationSeconds: 600, status: "idle", endsAt: null, remainingSecondsWhenPaused: null },
    });

    view = await mount(<BrainstormBoardPanel signedInContributorId="alice" />);
    await settle();

    expect(view.container.textContent).toContain("10:00");
  });

  it("never overwrites a timer already running in this browser", async () => {
    startSessionTimer(Date.now());
    stubFetch({
      brainstormSessionTimer: { durationSeconds: 600, status: "idle", endsAt: null, remainingSecondsWhenPaused: null },
    });

    view = await mount(<BrainstormBoardPanel signedInContributorId="alice" />);
    await settle();

    expect(buttonByText(view.container, "Pause")).not.toBeNull();
    expect(view.container.textContent).not.toContain("10:00");
  });

  it("pushes a started timer to the account", async () => {
    const fetchMock = stubFetch({ brainstormSessionTimer: null });

    view = await mount(<BrainstormBoardPanel signedInContributorId="alice" />);
    await settle();
    await click(buttonByText(view.container, "Start")!);

    const calls = (fetchMock as ReturnType<typeof vi.fn>).mock.calls;
    const putCall = calls.find(([, init]) => (init as RequestInit | undefined)?.method === "PUT");
    expect(putCall).toBeDefined();
    const body = JSON.parse((putCall![1] as RequestInit).body as string);
    expect(body.brainstormSessionTimer.status).toBe("running");
  });

  it("never pushes to the account when signed out", async () => {
    const fetchMock = stubFetch({ brainstormSessionTimer: null });

    view = await mount(createElement(BrainstormBoardPanel));
    await settle();
    await click(buttonByText(view.container, "Start")!);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
