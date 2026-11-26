/** @vitest-environment jsdom */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  providers: { providers: [] as string[], isLoading: false, hasSocialProviders: false },
  signIn: { social: vi.fn(), magicLink: vi.fn() },
  toast: { error: vi.fn(), success: vi.fn() },
  track: vi.fn(),
  isNativeWrapper: vi.fn(),
  openInSystemBrowser: vi.fn(),
}));

vi.mock("../../../src/lib/hooks/useAuthProviders", () => ({ useAuthProviders: () => mocks.providers }));
vi.mock("../../../src/lib/auth/client", () => ({ authClient: { signIn: mocks.signIn } }));
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("../../../src/lib/analytics/mixpanel", () => ({ trackSignUpCompleted: mocks.track }));
vi.mock("../../../src/lib/native/tauri", () => ({
  isNativeWrapper: mocks.isNativeWrapper,
  openInSystemBrowser: mocks.openInSystemBrowser,
}));
vi.mock("../../../src/components/layout/auth/PasskeySignIn", () => ({
  PasskeySignIn: ({ callbackURL }: { callbackURL: string }) => <div data-testid="passkey">passkey {callbackURL}</div>,
}));

import { LoginForm } from "../../../src/components/layout/auth/LoginForm";
import { configureHost } from "../../../src/host/config";
import { bodyText, button, change, click, clickAsync, cleanup, flush, installDomShims, mount, submit } from "../../helpers/dom";

beforeAll(() => installDomShims());
beforeEach(() => {
  mocks.providers = { providers: [], isLoading: false, hasSocialProviders: false };
  mocks.signIn.social.mockResolvedValue({ error: null });
  mocks.signIn.magicLink.mockResolvedValue({ error: null });
  mocks.isNativeWrapper.mockReturnValue(false);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  configureHost({});
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("LoginForm", () => {
  it("shows a loading state while the providers are fetched", () => {
    mocks.providers.isLoading = true;
    mount(<LoginForm />);
    expect(bodyText()).toBe("Loading…");
  });

  it("hands sign-in to the host when it supplies its own", async () => {
    const signIn = vi.fn();
    configureHost({ signIn });
    mount(<LoginForm />);
    await flush();
    expect(bodyText()).toContain("Sign-in opens debate-ai.com in a new tab");
    click(button("Sign in"));
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(document.querySelector("form")).toBeNull();
  });

  it("offers the magic link and a not-configured notice when there are no social providers", async () => {
    mount(<LoginForm callbackURL="/research" />);
    await flush();
    expect(document.querySelector("[data-testid=passkey]")?.textContent).toBe("passkey /research");
    expect(bodyText()).toContain("Social sign-in is not configured for this deployment.");
    expect(bodyText()).not.toContain("Continue with");
    expect(button("Send Magic Link")).toBeTruthy();
  });

  it("shows only the social providers the deployment has, in a fixed order", async () => {
    mocks.providers = { providers: ["linkedin", "google", "github"], isLoading: false, hasSocialProviders: true };
    mount(<LoginForm />);
    await flush();
    const labels = [...document.querySelectorAll("button")].map((b) => /Continue with \w+/.exec(b.textContent ?? "")?.[0]).filter(Boolean);
    expect(labels).toEqual(["Continue with Google", "Continue with LinkedIn"]);
    expect(bodyText()).toContain("Or continue with email");
    expect(bodyText()).not.toContain("not configured");
  });

  it("starts a social sign-in with the callback URL and tracks it", async () => {
    mocks.providers = { providers: ["discord"], isLoading: false, hasSocialProviders: true };
    mount(<LoginForm callbackURL="/coaching" />);
    await flush();
    await clickAsync(button("Continue with Discord"));
    expect(mocks.signIn.social).toHaveBeenCalledWith({ provider: "discord", callbackURL: "/coaching" });
    expect(mocks.track).toHaveBeenCalledWith({ sign_up_method: "discord" });
    expect(mocks.toast.error).not.toHaveBeenCalled();
  });

  it("reports a failed social sign-in and re-enables the button", async () => {
    mocks.providers = { providers: ["google"], isLoading: false, hasSocialProviders: true };
    mocks.signIn.social.mockResolvedValue({ error: { message: "Provider down" } });
    mount(<LoginForm />);
    await flush();
    await clickAsync(button("Continue with Google"));
    expect(mocks.toast.error).toHaveBeenCalledWith("Could not sign in with Google");
    expect(button("Continue with Google").disabled).toBe(false);
  });

  it("sends a magic link, then offers to use a different email", async () => {
    mount(<LoginForm callbackURL="/x" />);
    await flush();
    change(document.querySelector("#magic-email")!, "me@example.com");
    submit(document.querySelector("form")!);
    await flush();
    expect(mocks.signIn.magicLink).toHaveBeenCalledWith({ email: "me@example.com", callbackURL: "/x" });
    expect(mocks.track).toHaveBeenCalledWith({ sign_up_method: "magic_link" });
    expect(mocks.toast.success).toHaveBeenCalledWith("Magic link sent — check your email.");
    expect(bodyText()).toContain("Check your email");
    expect(bodyText()).toContain("me@example.com");

    click(button("Use a different email"));
    expect(document.querySelector<HTMLInputElement>("#magic-email")!.value).toBe("");
  });

  it("reports a failed magic link and keeps the form", async () => {
    mocks.signIn.magicLink.mockResolvedValue({ error: { statusText: "Too Many Requests" } });
    mount(<LoginForm />);
    await flush();
    change(document.querySelector("#magic-email")!, "me@example.com");
    submit(document.querySelector("form")!);
    await flush();
    expect(mocks.toast.error).toHaveBeenCalledWith("Could not send the magic link. Please try again.");
    expect(document.querySelector("#magic-email")).not.toBeNull();
    expect(button("Send Magic Link").disabled).toBe(false);
  });

  describe("inside the native wrapper", () => {
    beforeEach(() => {
      mocks.isNativeWrapper.mockReturnValue(true);
    });

    it("replaces the controls with a hand-off to the system browser", async () => {
      mocks.openInSystemBrowser.mockResolvedValue(true);
      mount(<LoginForm />);
      await flush();
      expect(bodyText()).toContain("sign-in opens in your default browser");
      expect(document.querySelector("form")).toBeNull();
      await clickAsync(button("Continue in your browser"));
      const target = mocks.openInSystemBrowser.mock.calls[0][0] as string;
      expect(target).toBe(`${window.location.origin}/login?callbackURL=${encodeURIComponent("/auth/native-complete")}`);
    });
  });
});
