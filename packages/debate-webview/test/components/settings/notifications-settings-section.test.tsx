/** @vitest-environment jsdom */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const tauri = vi.hoisted(() => ({
  enablePushNotifications: vi.fn(),
  getPushNotificationPermission: vi.fn(),
  isNativeWrapper: vi.fn(),
}));

vi.mock("../../../src/lib/native/tauri", () => tauri);

import { NotificationsSettingsSection } from "../../../src/components/settings/sections/NotificationsSettingsSection";
import { bodyText, button, cleanup, clickAsync, flush, installDomShims, mockFetch, mount } from "../../helpers/dom";

beforeAll(() => installDomShims());
beforeEach(() => {
  tauri.getPushNotificationPermission.mockResolvedValue("default");
  tauri.isNativeWrapper.mockReturnValue(false);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const settings = (overrides: Record<string, unknown> = {}) => ({
  email: "debater@example.com",
  emailUnsubscribed: false,
  pushEnabled: false,
  ...overrides,
});

function routes(initial = settings(), putStatus = 200) {
  const state = { value: initial };
  return mockFetch([
    {
      match: "/api/settings/notifications",
      method: "PUT",
      status: putStatus,
      respond: ({ body }: { body: unknown }) => {
        if (putStatus >= 400) return { error: "Save failed" };
        state.value = { ...state.value, ...(body as object) };
        return { notifications: state.value };
      },
    },
    { match: "/api/settings/notifications", respond: () => ({ notifications: state.value }) },
  ]);
}

const puts = (calls: { method: string; body: unknown }[]) => calls.filter((call) => call.method === "PUT").map((call) => call.body);

describe("NotificationsSettingsSection", () => {
  it("asks a signed-out visitor to sign in without loading anything", async () => {
    const { calls } = routes();
    mount(<NotificationsSettingsSection signedIn={false} />);
    await flush();
    expect(bodyText()).toContain("Sign in to manage email unsubscribe and push notifications.");
    expect(calls).toHaveLength(0);
  });

  it("shows the address and the browser permission once loaded", async () => {
    routes();
    mount(<NotificationsSettingsSection signedIn />);
    expect(bodyText()).toContain("Loading notification settings…");
    await flush();
    expect(bodyText()).toContain("debater@example.com");
    expect(bodyText()).toContain("Permission: default.");
    expect(bodyText()).toContain("Uses this browser");
  });

  it("describes the native notification system inside the wrapper and hides an unsupported permission", async () => {
    tauri.isNativeWrapper.mockReturnValue(true);
    tauri.getPushNotificationPermission.mockResolvedValue("unsupported");
    routes();
    mount(<NotificationsSettingsSection signedIn />);
    await flush();
    expect(bodyText()).toContain("Uses the native Debate AI (Tauri) notification system on this device.");
    expect(bodyText()).not.toContain("Permission:");
  });

  it("shows the error when the settings cannot be loaded", async () => {
    mockFetch([{ match: "/api/settings/notifications", respond: { error: "Not allowed" }, status: 403 }]);
    mount(<NotificationsSettingsSection signedIn />);
    await flush();
    expect(bodyText()).toContain("Not allowed");
    expect(button("Unsubscribe from all emails")).toBeTruthy();
  });

  it("unsubscribes from email, then offers to resubscribe", async () => {
    const { calls } = routes();
    mount(<NotificationsSettingsSection signedIn />);
    await flush();
    await clickAsync(button("Unsubscribe from all emails"));
    expect(puts(calls)).toEqual([{ emailUnsubscribed: true }]);
    expect(bodyText()).toContain("Unsubscribed from all Debate AI emails.");

    await clickAsync(button("Resubscribe to emails"));
    expect(puts(calls).at(-1)).toEqual({ emailUnsubscribed: false });
    expect(bodyText()).toContain("You will receive Debate AI emails again.");
    expect(button("Unsubscribe from all emails")).toBeTruthy();
  });

  it("shows the server's error when the email preference cannot be saved", async () => {
    routes(settings(), 500);
    mount(<NotificationsSettingsSection signedIn />);
    await flush();
    await clickAsync(button("Unsubscribe from all emails"));
    expect(bodyText()).toContain("Save failed");
    expect(bodyText()).not.toContain("Unsubscribed from all");
  });

  it("enables push in a browser: requests permission with a demo toast, then saves", async () => {
    tauri.enablePushNotifications.mockResolvedValue({ permission: "granted", shown: true });
    const { calls } = routes();
    mount(<NotificationsSettingsSection signedIn />);
    await flush();
    await clickAsync(button("Enable push notifications"));
    expect(tauri.enablePushNotifications).toHaveBeenCalledWith({
      title: "Debate AI notifications on",
      body: "You will get alerts in this browser when Debate AI sends them.",
    });
    expect(puts(calls)).toEqual([{ pushEnabled: true }]);
    expect(bodyText()).toContain("Browser notifications enabled.");
    expect(bodyText()).toContain("Permission: granted.");
    expect(button("Turn off push notifications")).toBeTruthy();
  });

  it("enables push in the native app with its own wording", async () => {
    tauri.isNativeWrapper.mockReturnValue(true);
    tauri.enablePushNotifications.mockResolvedValue({ permission: "granted", shown: true });
    routes();
    mount(<NotificationsSettingsSection signedIn />);
    await flush();
    await clickAsync(button("Enable push notifications"));
    expect(tauri.enablePushNotifications.mock.calls[0][0].body).toBe("You will get alerts in the Debate AI app.");
    expect(bodyText()).toContain("Push notifications enabled in the native app.");
  });

  it("records push as off and shows the denied permission when the user refuses", async () => {
    tauri.enablePushNotifications.mockResolvedValue({ permission: "denied", shown: false });
    const { calls } = routes();
    mount(<NotificationsSettingsSection signedIn />);
    await flush();
    await clickAsync(button("Enable push notifications"));
    expect(puts(calls)).toEqual([{ pushEnabled: false }]);
    expect(bodyText()).toContain("Permission: denied.");
    expect(bodyText()).not.toContain("Browser notifications enabled.");
    expect(button("Enable push notifications")).toBeTruthy();
  });

  it("does not claim success when the environment has no notification support", async () => {
    tauri.enablePushNotifications.mockResolvedValue({ permission: "unsupported", shown: false });
    const { calls } = routes();
    mount(<NotificationsSettingsSection signedIn />);
    await flush();
    await clickAsync(button("Enable push notifications"));
    expect(puts(calls)).toEqual([{ pushEnabled: false }]);
    expect(bodyText()).not.toContain("enabled.");
    expect(button("Enable push notifications")).toBeTruthy();
  });

  it("reports a failure to enable push", async () => {
    tauri.enablePushNotifications.mockRejectedValue(new Error("Plugin crashed"));
    routes();
    mount(<NotificationsSettingsSection signedIn />);
    await flush();
    await clickAsync(button("Enable push notifications"));
    expect(bodyText()).toContain("Plugin crashed");
  });

  it("turns push off for an account that has it on", async () => {
    const { calls } = routes(settings({ pushEnabled: true }));
    mount(<NotificationsSettingsSection signedIn />);
    await flush();
    await clickAsync(button("Turn off push notifications"));
    expect(puts(calls)).toEqual([{ pushEnabled: false }]);
    expect(bodyText()).toContain("Push notifications turned off for this account.");
    expect(button("Enable push notifications")).toBeTruthy();
  });

  it("reports a failure to turn push off", async () => {
    routes(settings({ pushEnabled: true }), 500);
    mount(<NotificationsSettingsSection signedIn />);
    await flush();
    await clickAsync(button("Turn off push notifications"));
    expect(bodyText()).toContain("Save failed");
  });
});
