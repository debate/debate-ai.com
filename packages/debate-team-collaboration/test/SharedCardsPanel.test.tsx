// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `SharedCardsPanel`: the sign-in prompt,
 * received shares (new badge, open, dismiss), sent shares (stop sharing),
 * and sharing a card by code or invite link with picked contacts.
 */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SharedCardsPanel } from "../src/panels/SharedCardsPanel";
import { SHARE_CODE, contact, fakeShares, share, user } from "./helpers/contacts";
import { click, mount, type, type Mounted } from "./helpers/mount";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

let view: Mounted;
const text = () => view.container.textContent ?? "";
const button = (label: string) =>
  Array.from(view.container.querySelectorAll("button")).find((el) => el.textContent?.trim() === label);
const input = (label: string) => view.container.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement;

const alice = user("alice");
const bob = user("bob");

beforeEach(() => {
  Object.values(toast).forEach((fn) => fn.mockReset());
});

afterEach(async () => {
  await view?.unmount();
});

describe("SharedCardsPanel", () => {
  it("asks you to sign in when disabled", async () => {
    view = await mount(createElement(SharedCardsPanel, { enabled: false }));
    expect(text()).toContain("Sign in to see shared cards.");
  });

  it("shows loading, then the empty state", async () => {
    view = await mount(createElement(SharedCardsPanel, { shares: fakeShares({ loading: true, loaded: false }) }));
    expect(text()).toContain("Loading shared cards…");
    await view.unmount();
    view = await mount(createElement(SharedCardsPanel, { shares: fakeShares() }));
    expect(text()).toContain("Nothing shared with you yet.");
    expect(text()).toContain("0 new");
  });

  it("opens and dismisses received shares", async () => {
    const shares = fakeShares({
      received: [
        share(1, alice, { message: "Read the impact" }),
        share(2, bob, { openedAt: "2026-01-02T00:00:00.000Z", updatedAt: "2020-01-01T00:00:00.000Z" }),
      ],
    });
    const onOpen = vi.fn();
    view = await mount(createElement(SharedCardsPanel, { shares, onOpen }));

    expect(text()).toContain("1 new");
    expect(text()).toContain("from Alice · just now · “Read the impact”");
    expect(text()).toContain("New");

    await click(button("Open")!);
    expect(shares.markOpened).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));

    await click(button("Dismiss")!);
    expect(shares.remove).toHaveBeenCalledWith(1);
    expect(toast.success).toHaveBeenCalledWith("Removed from your list.");
  });

  it("revokes a sent share and reports a failure", async () => {
    const shares = fakeShares({
      sent: [share(3, bob, { updatedAt: new Date(Date.now() - 2 * 3_600_000).toISOString() })],
      remove: vi.fn(async () => {
        throw new Error("Already revoked");
      }),
    });
    view = await mount(createElement(SharedCardsPanel, { shares }));
    expect(text()).toContain("Shared by you");
    expect(text()).toContain("to Bob · 2 h ago · not opened yet");

    await click(button("Stop sharing")!);
    expect(shares.remove).toHaveBeenCalledWith(3);
    expect(toast.error).toHaveBeenCalledWith("Already revoked");
  });

  it("needs a contact before sharing by code", async () => {
    view = await mount(createElement(SharedCardsPanel, { shares: fakeShares(), contacts: [] }));
    expect(text()).toContain("Add a contact first");
  });

  it("shares a card by invite link with the picked contacts", async () => {
    const shares = fakeShares();
    view = await mount(
      createElement(SharedCardsPanel, { shares, contacts: [contact(1, alice, true), contact(2, bob)] }),
    );
    const shareButton = () =>
      Array.from(view.container.querySelectorAll("button")).find((el) => el.textContent?.startsWith("Share with"))!;

    await type(input("Share code or invite link"), "not a code");
    expect(input("Share code or invite link").getAttribute("aria-invalid")).toBe("true");
    expect(shareButton().disabled).toBe(true);

    await type(input("Share code or invite link"), `https://debate-ai.com/editor#join=${SHARE_CODE}&pass=secret`);
    await type(input("Card title"), "Warming impact");
    await click(button("Alice")!);
    expect(shareButton().textContent).toBe("Share with 1 contact");
    await click(shareButton());

    expect(shares.share).toHaveBeenCalledWith({
      shareCode: SHARE_CODE,
      guestPass: "secret",
      title: "Warming impact",
      recipientIds: ["alice"],
    });
    expect(toast.success).toHaveBeenCalledWith("Card shared with 1 contact.");
    expect(input("Card title").value).toBe("");
  });

  it("warns about skipped recipients and surfaces share errors", async () => {
    const shares = fakeShares({
      share: vi
        .fn()
        .mockResolvedValueOnce({ shared: ["alice", "bob"], skipped: ["carol"] })
        .mockRejectedValueOnce(new Error("Session ended")),
    });
    view = await mount(createElement(SharedCardsPanel, { shares, contacts: [contact(1, alice), contact(2, bob)] }));
    const shareButton = () =>
      Array.from(view.container.querySelectorAll("button")).find((el) => el.textContent?.startsWith("Share with"))!;

    await type(input("Share code or invite link"), SHARE_CODE);
    await click(button("Alice")!);
    await click(button("Bob")!);
    expect(shareButton().textContent).toBe("Share with 2 contacts");
    await click(shareButton());
    expect(toast.success).toHaveBeenCalledWith("Card shared with 2 contacts.");
    expect(toast.warning).toHaveBeenCalledWith("1 recipient(s) couldn't be shared with.");

    await type(input("Share code or invite link"), SHARE_CODE);
    await click(button("Alice")!);
    await click(shareButton());
    expect(toast.error).toHaveBeenCalledWith("Session ended");
  });
});
