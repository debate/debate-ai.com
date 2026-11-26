/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  enablePushNotifications,
  getLastSelectedText,
  getPushNotificationPermission,
  hideToTray,
  isAutostartEnabled,
  isNativeWrapper,
  onQuickLaunchText,
  openInSystemBrowser,
  requestPushNotificationPermission,
  setAutostartEnabled,
  showMainWindow,
  showPushNotification,
} from "../../../src/lib/native/tauri";

type Invoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

function installTauri(invoke: Invoke, listen?: NonNullable<NonNullable<Window["__TAURI__"]>["event"]>["listen"]) {
  window.__TAURI__ = { core: { invoke }, ...(listen ? { event: { listen } } : {}) };
}

function stubNotification(permission: NotificationPermission, requestResult: NotificationPermission = permission) {
  const ctor = vi.fn();
  Object.assign(ctor, { permission, requestPermission: vi.fn(async () => requestResult) });
  vi.stubGlobal("Notification", ctor);
  return ctor as unknown as typeof Notification & ReturnType<typeof vi.fn>;
}

beforeEach(() => {
  delete window.__TAURI__;
  delete window.__TAURI_SELECTED_TEXT__;
  vi.unstubAllGlobals();
  vi.stubGlobal("Notification", undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("outside the native wrapper", () => {
  it("is not the wrapper and every native call is a safe no-op", async () => {
    expect(isNativeWrapper()).toBe(false);
    expect(await openInSystemBrowser("https://example.com")).toBe(false);
    expect(await getLastSelectedText()).toBe("");
    expect(await isAutostartEnabled()).toBe(false);
    expect(await setAutostartEnabled(true)).toBe(false);
    expect(await hideToTray()).toBe(false);
    expect(await showMainWindow()).toBe(false);
  });
});

describe("inside the native wrapper", () => {
  it("detects the wrapper from window.__TAURI__.core", () => {
    installTauri(vi.fn(async () => undefined));
    expect(isNativeWrapper()).toBe(true);
  });

  it("opens a URL through the opener plugin", async () => {
    const invoke = vi.fn(async (..._args: unknown[]) => undefined);
    installTauri(invoke);
    expect(await openInSystemBrowser("https://example.com/login")).toBe(true);
    expect(invoke).toHaveBeenCalledWith("plugin:opener|open_url", { url: "https://example.com/login" });
  });

  describe("getLastSelectedText", () => {
    it("prefers the text the wrapper injected on the window", async () => {
      const invoke = vi.fn(async () => "from invoke");
      installTauri(invoke);
      window.__TAURI_SELECTED_TEXT__ = "injected";
      expect(await getLastSelectedText()).toBe("injected");
      expect(invoke).not.toHaveBeenCalled();
    });

    it("asks the wrapper otherwise, and treats an empty answer as no text", async () => {
      installTauri(vi.fn(async () => "selected via invoke"));
      expect(await getLastSelectedText()).toBe("selected via invoke");
      installTauri(vi.fn(async () => null));
      expect(await getLastSelectedText()).toBe("");
    });

    it("returns an empty string when the command throws", async () => {
      installTauri(vi.fn(async () => Promise.reject(new Error("boom"))));
      expect(await getLastSelectedText()).toBe("");
    });
  });

  describe("autostart", () => {
    it("reads the enabled flag from the autostart plugin", async () => {
      const invoke = vi.fn(async () => true);
      installTauri(invoke);
      expect(await isAutostartEnabled()).toBe(true);
      expect(invoke).toHaveBeenCalledWith("plugin:autostart|is_enabled");
    });

    it("reports disabled when the plugin is missing", async () => {
      installTauri(vi.fn(async () => Promise.reject(new Error("no plugin"))));
      expect(await isAutostartEnabled()).toBe(false);
    });

    it("enables and disables through the matching plugin command", async () => {
      const invoke = vi.fn(async (..._args: unknown[]) => undefined);
      installTauri(invoke);
      expect(await setAutostartEnabled(true)).toBe(true);
      expect(await setAutostartEnabled(false)).toBe(true);
      expect(invoke.mock.calls.map((call) => call[0])).toEqual(["plugin:autostart|enable", "plugin:autostart|disable"]);
    });

    it("returns false when the command fails", async () => {
      installTauri(vi.fn(async () => Promise.reject(new Error("denied"))));
      expect(await setAutostartEnabled(true)).toBe(false);
    });
  });

  describe("window commands", () => {
    it("hides to the tray and shows the main window", async () => {
      const invoke = vi.fn(async (..._args: unknown[]) => undefined);
      installTauri(invoke);
      expect(await hideToTray()).toBe(true);
      expect(await showMainWindow()).toBe(true);
      expect(invoke.mock.calls.map((call) => call[0])).toEqual(["hide_to_tray", "show_main_window"]);
    });

    it("returns false when either command rejects", async () => {
      installTauri(vi.fn(async () => Promise.reject(new Error("no window"))));
      expect(await hideToTray()).toBe(false);
      expect(await showMainWindow()).toBe(false);
    });
  });
});

describe("onQuickLaunchText", () => {
  it("forwards the DOM event's text and ignores an empty one", () => {
    const callback = vi.fn();
    const stop = onQuickLaunchText(callback);
    window.dispatchEvent(new CustomEvent("tauri-selected-text", { detail: { text: "hello" } }));
    window.dispatchEvent(new CustomEvent("tauri-selected-text", { detail: { text: "" } }));
    window.dispatchEvent(new CustomEvent("tauri-selected-text"));
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("hello");
    stop();
    window.dispatchEvent(new CustomEvent("tauri-selected-text", { detail: { text: "after" } }));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("also listens to the Tauri event, keeps only string payloads, and unlistens on stop", async () => {
    const callback = vi.fn();
    const unlisten = vi.fn();
    let handler: (event: { payload: unknown }) => void = () => {};
    const listen = vi.fn(async (_event: string, next: typeof handler) => {
      handler = next;
      return unlisten;
    });
    installTauri(vi.fn(async () => undefined), listen);

    const stop = onQuickLaunchText(callback);
    await Promise.resolve();
    expect(listen).toHaveBeenCalledWith("quick-launch-text", expect.any(Function));

    handler({ payload: "from tauri" });
    handler({ payload: "" });
    handler({ payload: { not: "a string" } });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("from tauri");

    stop();
    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it("survives a failing Tauri listen call", async () => {
    const listen = vi.fn(async () => Promise.reject(new Error("no events")));
    installTauri(vi.fn(async () => undefined), listen);
    const stop = onQuickLaunchText(vi.fn());
    await Promise.resolve();
    expect(() => stop()).not.toThrow();
  });
});

describe("push notifications in the browser", () => {
  it("is unsupported without the Notification API", async () => {
    expect(await getPushNotificationPermission()).toBe("unsupported");
    expect(await requestPushNotificationPermission()).toBe("unsupported");
    expect(await showPushNotification({ title: "Hi" })).toBe(false);
  });

  it("reads and requests permission from the Notification API", async () => {
    const notification = stubNotification("default", "granted");
    expect(await getPushNotificationPermission()).toBe("default");
    expect(await requestPushNotificationPermission()).toBe("granted");
    expect(notification.requestPermission).toHaveBeenCalledTimes(1);
  });

  it("shows a notification only once permission is granted", async () => {
    const denied = stubNotification("denied");
    expect(await showPushNotification({ title: "Hi", body: "there" })).toBe(false);
    expect(denied).not.toHaveBeenCalled();

    const granted = stubNotification("granted");
    expect(await showPushNotification({ title: "Hi", body: "there" })).toBe(true);
    expect(granted).toHaveBeenCalledWith("Hi", { body: "there" });
  });

  it("returns false when constructing the notification throws", async () => {
    const granted = stubNotification("granted");
    granted.mockImplementation(() => {
      throw new Error("illegal constructor");
    });
    expect(await showPushNotification({ title: "Hi" })).toBe(false);
  });
});

describe("push notifications in the native wrapper", () => {
  it("maps the plugin's permission answer", async () => {
    const invoke = vi.fn<Invoke>(async () => true);
    installTauri(invoke);
    expect(await getPushNotificationPermission()).toBe("granted");
    invoke.mockResolvedValueOnce(false);
    expect(await getPushNotificationPermission()).toBe("denied");
    invoke.mockResolvedValueOnce(null);
    expect(await getPushNotificationPermission()).toBe("default");
    expect(invoke).toHaveBeenCalledWith("plugin:notification|is_permission_granted", undefined);
  });

  it("falls back to the Notification API when the plugin is missing", async () => {
    installTauri(vi.fn(async () => Promise.reject(new Error("unknown command"))));
    stubNotification("denied");
    expect(await getPushNotificationPermission()).toBe("denied");
  });

  it("requests permission through the plugin and returns a recognised answer", async () => {
    const invoke = vi.fn<Invoke>(async () => "granted");
    installTauri(invoke);
    expect(await requestPushNotificationPermission()).toBe("granted");
    invoke.mockResolvedValueOnce("denied");
    expect(await requestPushNotificationPermission()).toBe("denied");
  });

  it("re-checks the permission when the plugin answers with something else", async () => {
    const invoke = vi.fn<Invoke>(async (cmd) => (cmd.endsWith("request_permission") ? "weird" : true));
    installTauri(invoke);
    expect(await requestPushNotificationPermission()).toBe("granted");

    invoke.mockImplementation(async (cmd) => (cmd.endsWith("request_permission") ? "weird" : false));
    expect(await requestPushNotificationPermission()).toBe("denied");
  });

  it("falls back to the browser prompt when requesting fails", async () => {
    installTauri(vi.fn(async () => Promise.reject(new Error("unknown command"))));
    stubNotification("default", "granted");
    expect(await requestPushNotificationPermission()).toBe("granted");
  });

  it("notifies through the plugin with an empty body by default", async () => {
    const invoke = vi.fn<Invoke>(async () => undefined);
    installTauri(invoke);
    expect(await showPushNotification({ title: "Round starting" })).toBe(true);
    expect(invoke).toHaveBeenCalledWith("plugin:notification|notify", { title: "Round starting", body: "" });
  });

  it("falls back to the web Notification when the plugin fails", async () => {
    installTauri(vi.fn(async () => Promise.reject(new Error("unknown command"))));
    const granted = stubNotification("granted");
    expect(await showPushNotification({ title: "Hi" })).toBe(true);
    expect(granted).toHaveBeenCalledWith("Hi", { body: undefined });
  });
});

describe("enablePushNotifications", () => {
  it("stops without a toast when permission is not granted", async () => {
    stubNotification("default", "denied");
    expect(await enablePushNotifications({ title: "On" })).toEqual({ permission: "denied", shown: false });
  });

  it("shows the confirmation toast when granted and a demo is given", async () => {
    const granted = stubNotification("granted");
    expect(await enablePushNotifications({ title: "On", body: "Push is enabled" })).toEqual({
      permission: "granted",
      shown: true,
    });
    expect(granted).toHaveBeenCalledWith("On", { body: "Push is enabled" });
  });

  it("grants without showing anything when no demo is given", async () => {
    const granted = stubNotification("granted");
    expect(await enablePushNotifications()).toEqual({ permission: "granted", shown: false });
    expect(granted).not.toHaveBeenCalled();
  });
});
