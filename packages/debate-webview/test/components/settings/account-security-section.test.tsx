/** @vitest-environment jsdom */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => ({
  passkey: {
    listUserPasskeys: vi.fn(),
    addPasskey: vi.fn(),
    deletePasskey: vi.fn(),
  },
  twoFactor: {
    enable: vi.fn(),
    verifyTotp: vi.fn(),
    disable: vi.fn(),
    generateBackupCodes: vi.fn(),
  },
}));

vi.mock("../../../src/lib/auth/client", () => ({ authClient: authMock }));

import { PasskeysSection, TwoFactorSection } from "../../../src/components/settings/sections/AccountSecuritySection";
import { configureHost } from "../../../src/host/config";
import { bodyText, button, change, click, clickAsync, cleanup, flush, installDomShims, mount, submit } from "../../helpers/dom";

beforeAll(() => installDomShims());
beforeEach(() => {
  vi.clearAllMocks();
  authMock.passkey.listUserPasskeys.mockResolvedValue({ data: [], error: null });
});
afterEach(() => {
  cleanup();
  configureHost({});
  vi.unstubAllGlobals();
});

const passkeyInput = () => document.querySelector<HTMLInputElement>("input[aria-label='Passkey name']")!;

describe("PasskeysSection", () => {
  it("asks a signed-out visitor to sign in and never loads passkeys", async () => {
    mount(<PasskeysSection signedIn={false} />);
    await flush();
    expect(bodyText()).toContain("to add a passkey.");
    expect(document.querySelector("a[href='/login']")).not.toBeNull();
    expect(authMock.passkey.listUserPasskeys).not.toHaveBeenCalled();
  });

  it("says passkeys are unavailable in a host that signs in outside the page", async () => {
    configureHost({ signIn: () => {} });
    mount(<PasskeysSection signedIn />);
    await flush();
    expect(bodyText()).toContain("can't create passkeys");
    expect(document.querySelector("form")).toBeNull();
  });

  it("lists passkeys with their date and sync state, and shows the empty state", async () => {
    vi.stubGlobal("PublicKeyCredential", class {});
    authMock.passkey.listUserPasskeys.mockResolvedValue({
      data: [
        { id: "1", name: "MacBook", createdAt: "2026-01-15T12:00:00Z", backedUp: true },
        { id: "2", name: null, deviceType: "singleDevice", createdAt: "not a date" },
        { id: "3", name: "Phone", deviceType: "multiDevice" },
      ],
      error: null,
    });
    mount(<PasskeysSection signedIn />);
    await flush();
    const items = [...document.querySelectorAll("li")].map((li) => li.textContent);
    expect(items).toHaveLength(3);
    expect(items[0]).toContain("MacBook");
    expect(items[0]).toContain("Added");
    expect(items[0]).toContain("Synced");
    expect(items[1]).toContain("Passkey");
    expect(items[1]).toContain("This device only");
    expect(items[1]).not.toContain("Added");
    expect(items[2]).toBe("Phone");
  });

  it("shows 'No passkeys yet.' when the account has none", async () => {
    vi.stubGlobal("PublicKeyCredential", class {});
    mount(<PasskeysSection signedIn />);
    await flush();
    expect(bodyText()).toContain("No passkeys yet.");
  });

  it("reports a load failure from the auth client", async () => {
    vi.stubGlobal("PublicKeyCredential", class {});
    authMock.passkey.listUserPasskeys.mockResolvedValue({ data: null, error: {} });
    mount(<PasskeysSection signedIn />);
    await flush();
    expect(document.querySelector("[role=alert]")?.textContent).toBe("Could not load your passkeys.");
  });

  it("adds a passkey under the typed name and reloads the list", async () => {
    vi.stubGlobal("PublicKeyCredential", class {});
    authMock.passkey.addPasskey.mockResolvedValue({ data: {}, error: null });
    mount(<PasskeysSection signedIn />);
    await flush();
    change(passkeyInput(), "  Work laptop ");
    submit(document.querySelector("form")!);
    await flush();
    expect(authMock.passkey.addPasskey).toHaveBeenCalledWith({ name: "Work laptop" });
    expect(bodyText()).toContain("Passkey added.");
    expect(authMock.passkey.listUserPasskeys).toHaveBeenCalledTimes(2);
  });

  it("falls back to a platform name when the field is blank", async () => {
    vi.stubGlobal("PublicKeyCredential", class {});
    authMock.passkey.addPasskey.mockResolvedValue({ data: {}, error: null });
    mount(<PasskeysSection signedIn />);
    await flush();
    change(passkeyInput(), "   ");
    submit(document.querySelector("form")!);
    await flush();
    const { name } = authMock.passkey.addPasskey.mock.calls[0][0];
    expect(name).toMatch(/^(iPhone or iPad|Android|Mac|Windows|Chromebook|Linux|Passkey)$/);
  });

  it("treats a dismissed browser prompt as a choice, not an error", async () => {
    vi.stubGlobal("PublicKeyCredential", class {});
    authMock.passkey.addPasskey.mockResolvedValue({ error: { message: "The operation was not allowed (NotAllowedError)" } });
    mount(<PasskeysSection signedIn />);
    await flush();
    submit(document.querySelector("form")!);
    await flush();
    expect(document.querySelector("[role=alert]")).toBeNull();
    expect(bodyText()).not.toContain("Passkey added.");
    expect(button("Add passkey").disabled).toBe(false);
  });

  it("explains a stale session when adding fails for that reason", async () => {
    vi.stubGlobal("PublicKeyCredential", class {});
    authMock.passkey.addPasskey.mockResolvedValue({ error: { code: "SESSION_NOT_FRESH" } });
    mount(<PasskeysSection signedIn />);
    await flush();
    submit(document.querySelector("form")!);
    await flush();
    expect(document.querySelector("[role=alert]")?.textContent).toContain("sign out and sign back in");
  });

  it("shows the server's message for other add failures", async () => {
    vi.stubGlobal("PublicKeyCredential", class {});
    authMock.passkey.addPasskey.mockResolvedValue({ error: { message: "Limit reached" } });
    mount(<PasskeysSection signedIn />);
    await flush();
    submit(document.querySelector("form")!);
    await flush();
    expect(document.querySelector("[role=alert]")?.textContent).toBe("Limit reached");
  });

  it("removes a passkey by id and reloads, surfacing a failure", async () => {
    vi.stubGlobal("PublicKeyCredential", class {});
    authMock.passkey.listUserPasskeys.mockResolvedValue({ data: [{ id: "abc", name: "Key" }], error: null });
    authMock.passkey.deletePasskey.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: {} });
    mount(<PasskeysSection signedIn />);
    await flush();
    const remove = document.querySelector<HTMLButtonElement>("button[aria-label='Remove passkey Key']")!;
    await clickAsync(remove);
    expect(authMock.passkey.deletePasskey).toHaveBeenCalledWith({ id: "abc" });
    expect(document.querySelector("[role=alert]")).toBeNull();
    await clickAsync(remove);
    expect(document.querySelector("[role=alert]")?.textContent).toBe("Could not remove the passkey.");
    expect(authMock.passkey.listUserPasskeys).toHaveBeenCalledTimes(3);
  });
});

const TOTP_URI = "otpauth://totp/Debate%20AI:me@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Debate%20AI";

describe("TwoFactorSection", () => {
  it("asks a signed-out visitor to sign in", () => {
    mount(<TwoFactorSection signedIn={false} enabled={false} />);
    expect(bodyText()).toContain("to turn on two-factor authentication.");
    expect(bodyText()).not.toContain("Off");
  });

  it("reflects the session's state with an On/Off badge", () => {
    const view = mount(<TwoFactorSection signedIn enabled={false} />);
    expect(bodyText()).toContain("Off");
    expect(button("Set up an authenticator app")).toBeTruthy();
    view.rerender(<TwoFactorSection signedIn enabled />);
    expect(bodyText()).toContain("On");
    expect(button("New backup codes")).toBeTruthy();
  });

  it("walks through setup: shows the key, takes a 6-digit code and shows the backup codes", async () => {
    authMock.twoFactor.enable.mockResolvedValue({ data: { totpURI: TOTP_URI, backupCodes: ["aaaa-1111", "bbbb-2222"] }, error: null });
    authMock.twoFactor.verifyTotp.mockResolvedValue({ error: null });
    mount(<TwoFactorSection signedIn enabled={false} />);
    await clickAsync(button("Set up an authenticator app"));
    expect(authMock.twoFactor.enable).toHaveBeenCalledWith({});
    expect(document.querySelector("code")?.textContent).toBe("JBSWY3DPEHPK3PXP");
    expect(document.querySelector<HTMLAnchorElement>("a[href^='otpauth://']")).not.toBeNull();
    await flush();
    expect(document.querySelector("[role=img][aria-label='QR code for your authenticator app'] svg")).not.toBeNull();

    const input = document.querySelector<HTMLInputElement>("#account-2fa-code")!;
    expect(button("Verify and turn on").disabled).toBe(true);
    change(input, "12ab34-56789");
    expect(input.value).toBe("123456");
    expect(button("Verify and turn on").disabled).toBe(false);
    submit(input.closest("form")!);
    await flush();

    expect(authMock.twoFactor.verifyTotp).toHaveBeenCalledWith({ code: "123456" });
    expect(bodyText()).toContain("aaaa-1111");
    expect(bodyText()).toContain("bbbb-2222");
    expect(bodyText()).toContain("On");
  });

  it("keeps the setup open with a hint when the code is wrong, and can be cancelled", async () => {
    authMock.twoFactor.enable.mockResolvedValue({ data: { totpURI: TOTP_URI, backupCodes: [] }, error: null });
    authMock.twoFactor.verifyTotp.mockResolvedValue({ error: { code: "INVALID_TWO_FACTOR_CODE" } });
    mount(<TwoFactorSection signedIn enabled={false} />);
    await clickAsync(button("Set up an authenticator app"));
    change(document.querySelector("#account-2fa-code")!, "000000");
    submit(document.querySelector("form")!);
    await flush();
    expect(document.querySelector("[role=alert]")?.textContent).toBe("That code didn't match. Try the newest one.");
    click(button("Cancel"));
    expect(bodyText()).toContain("Set up an authenticator app");
  });

  it("shows no key when the URI has no secret, and reports a failed start", async () => {
    authMock.twoFactor.enable.mockResolvedValueOnce({ data: { totpURI: "otpauth://totp/x", backupCodes: [] }, error: null });
    mount(<TwoFactorSection signedIn enabled={false} />);
    await clickAsync(button("Set up an authenticator app"));
    expect(document.querySelector("code")).toBeNull();
    click(button("Cancel"));

    authMock.twoFactor.enable.mockResolvedValueOnce({ data: null, error: null });
    await clickAsync(button("Set up an authenticator app"));
    expect(document.querySelector("[role=alert]")?.textContent).toBe("Could not start two-factor setup.");
  });

  it("makes new backup codes and offers copy and download", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const createObjectURL = vi.fn(() => "blob:codes");
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    authMock.twoFactor.generateBackupCodes.mockResolvedValue({ data: { backupCodes: ["x1", "x2"] }, error: null });
    mount(<TwoFactorSection signedIn enabled />);
    await clickAsync(button("New backup codes"));
    expect(bodyText()).toContain("x1");
    expect(bodyText()).not.toContain("Making new backup codes replaces the old ones.");

    await clickAsync(button("Copy"));
    expect(writeText).toHaveBeenCalledWith("x1\nx2");

    click(button("Download"));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:codes");
  });

  it("reports a failure to make backup codes", async () => {
    authMock.twoFactor.generateBackupCodes.mockResolvedValue({ data: null, error: { message: "Nope" } });
    mount(<TwoFactorSection signedIn enabled />);
    await clickAsync(button("New backup codes"));
    expect(document.querySelector("[role=alert]")?.textContent).toBe("Nope");
  });

  it("asks for confirmation before turning two-factor off, and can back out", async () => {
    authMock.twoFactor.disable.mockResolvedValue({ error: null });
    mount(<TwoFactorSection signedIn enabled />);
    click(button("Turn off"));
    click(button("Keep it on"));
    expect(authMock.twoFactor.disable).not.toHaveBeenCalled();
    click(button("Turn off"));
    await clickAsync(button("Yes, turn off"));
    expect(authMock.twoFactor.disable).toHaveBeenCalledWith({});
    expect(bodyText()).toContain("Off");
    expect(bodyText()).toContain("Set up an authenticator app");
  });

  it("stays on and says why when turning off fails", async () => {
    authMock.twoFactor.disable.mockResolvedValue({ error: { code: "SESSION_NOT_FRESH" } });
    mount(<TwoFactorSection signedIn enabled />);
    click(button("Turn off"));
    await clickAsync(button("Yes, turn off"));
    expect(document.querySelector("[role=alert]")?.textContent).toContain("sign out and sign back in");
    expect(button("New backup codes")).toBeTruthy();
  });
});
