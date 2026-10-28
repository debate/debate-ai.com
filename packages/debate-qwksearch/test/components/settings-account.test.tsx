/** @vitest-environment jsdom */
import { act } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { QwkSearchSession } from "../../src/components/connect-auth";

const qwk = vi.hoisted(() => ({
  state: { session: { connected: false } as QwkSearchSession, isPending: false },
  connect: vi.fn(),
  disconnect: vi.fn(async () => {}),
  load: vi.fn(async (_refresh?: boolean): Promise<QwkSearchSession> => ({ connected: true })),
}));
vi.mock("../../src/components/connect-auth", () => ({
  useQwkSearchSession: () => qwk.state,
  connectQwkSearch: qwk.connect,
  disconnectQwkSearch: qwk.disconnect,
  loadQwkSearchSession: qwk.load,
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import Account from "../../src/components/Settings/Sections/Account";
import { bodyText, button, cleanup, click, clickAsync, installDomShims, mount } from "../helpers/dom";

beforeAll(installDomShims);
beforeEach(() => {
  qwk.state = { session: { connected: false }, isPending: false };
  qwk.load.mockImplementation(async () => ({ connected: true }));
  qwk.disconnect.mockImplementation(async () => {});
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function signedIn(overrides: Partial<QwkSearchSession> = {}) {
  qwk.state = {
    isPending: false,
    session: {
      connected: true,
      user: { id: "q1", name: "Ada", email: "ada@example.com", image: null },
      plan: "free",
      upgradeUrl: "https://pay.example/upgrade",
      ...overrides,
    },
  };
}

const link = (text: string) =>
  [...document.querySelectorAll<HTMLAnchorElement>("a")].find((a) => a.textContent?.trim() === text);

describe("Account settings (QwkSearch link)", () => {
  it("shows only a spinner while the session is loading", () => {
    qwk.state = { session: { connected: false }, isPending: true };
    mount(<Account />);
    expect(bodyText()).toBe("");
    expect(document.querySelector(".animate-spin")).not.toBeNull();
    expect(document.querySelector("button")).toBeNull();
  });

  it("asks a signed-out reader to sign in with QwkSearch", () => {
    mount(<Account />);
    const text = bodyText();
    expect(text).toContain("Sign in with your QwkSearch account to save research chats");
    expect(text).toContain("You'll approve the link on qwksearch.com");
    click(button("Sign in with QwkSearch"));
    expect(qwk.connect).toHaveBeenCalledTimes(1);
  });

  it("treats a connected session without a user as signed out", () => {
    qwk.state = { session: { connected: true, user: null }, isPending: false };
    mount(<Account />);
    expect(button("Sign in with QwkSearch")).toBeTruthy();
    expect(bodyText()).not.toContain("Sign out of QwkSearch");
  });

  it("shows the linked account, the free plan and the upgrade link", () => {
    signedIn();
    mount(<Account />);
    const text = bodyText();
    expect(text).toContain("Research chats here run as this QwkSearch account.");
    expect(text).toContain("Ada");
    expect(text).toContain("ada@example.com");
    expect(text).toContain("You are on the free QwkSearch plan.");
    // No picture: the initial-letter avatar.
    expect(document.querySelector("img")).toBeNull();
    expect(text).toContain("A");
    expect(link("Upgrade QwkSearch")!.href).toBe("https://pay.example/upgrade");
    expect(link("Upgrade QwkSearch")!.target).toBe("_blank");
    expect(link("Manage on QwkSearch")!.href).toBe("https://qwksearch.com/settings");
  });

  it("labels a paid plan, shows the picture and hides the upgrade link", () => {
    signedIn({ plan: "pro", user: { id: "q1", name: "", email: "bo@example.com", image: "https://img/bo.png" } });
    mount(<Account />);
    const text = bodyText();
    expect(text).toContain("QwkSearch Pro");
    expect(text).not.toContain("You are on the free QwkSearch plan.");
    expect(link("Upgrade QwkSearch")).toBeUndefined();
    expect(document.querySelector("img")!.getAttribute("src")).toBe("https://img/bo.png");
    // A nameless account falls back to its email.
    expect(text).toContain("bo@example.com");
  });

  it("treats a missing plan as free but needs an upgrade link to offer one", () => {
    signedIn({ plan: null, upgradeUrl: null });
    mount(<Account />);
    expect(bodyText()).toContain("You are on the free QwkSearch plan.");
    expect(link("Upgrade QwkSearch")).toBeUndefined();
  });

  it("refreshes the plan and warns when the link was dropped", async () => {
    signedIn();
    mount(<Account />);
    await clickAsync(button("Refresh plan"));
    expect(qwk.load).toHaveBeenCalledWith(true);
    expect(toast.info).not.toHaveBeenCalled();
    expect(button("Refresh plan").disabled).toBe(false);

    qwk.load.mockImplementationOnce(async () => ({ connected: false }));
    await clickAsync(button("Refresh plan"));
    expect(toast.info).toHaveBeenCalledWith(
      "Your QwkSearch account was unlinked — its API key changed. Sign in again.",
    );
  });

  it("re-reads the plan when the window regains focus, only while connected", () => {
    signedIn();
    const handle = mount(<Account />);
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(qwk.load).toHaveBeenCalledWith(true);
    handle.unmount();

    qwk.load.mockClear();
    qwk.state = { session: { connected: false }, isPending: false };
    mount(<Account />);
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(qwk.load).not.toHaveBeenCalled();
  });

  it("signs out of QwkSearch and reports failures", async () => {
    signedIn();
    mount(<Account />);
    await clickAsync(button("Sign out of QwkSearch"));
    expect(qwk.disconnect).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("QwkSearch account unlinked.");

    qwk.disconnect.mockImplementationOnce(async () => {
      throw new Error("offline");
    });
    await clickAsync(button("Sign out of QwkSearch"));
    expect(toast.error).toHaveBeenCalledWith("Failed to unlink the QwkSearch account.");
    expect(button("Sign out of QwkSearch").disabled).toBe(false);
  });
});
