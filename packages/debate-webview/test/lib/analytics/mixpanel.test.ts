/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  init: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  track: vi.fn(),
  people: { set: vi.fn() },
}));

vi.mock("mixpanel-browser", () => ({ default: sdk }));

type Module = typeof import("../../../src/lib/analytics/mixpanel");

async function load(token: string): Promise<Module> {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_MIXPANEL_TOKEN", token);
  return import("../../../src/lib/analytics/mixpanel");
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("without a token", () => {
  it("never loads the SDK", async () => {
    const mixpanel = await load("");
    mixpanel.initMixpanel();
    mixpanel.identifyUser("u1", { plan: "pro" });
    mixpanel.trackEvent("Anything");
    mixpanel.trackPageView("/x");
    mixpanel.resetUser();
    await settle();
    expect(sdk.init).not.toHaveBeenCalled();
    expect(sdk.track).not.toHaveBeenCalled();
  });
});

describe("with a token", () => {
  it("initialises once, with page views and autotrack off, and queues events in order", async () => {
    const mixpanel = await load("tok-123");
    mixpanel.trackEvent("First", { a: 1 });
    mixpanel.trackEvent("Second");
    await settle();
    expect(sdk.init).toHaveBeenCalledTimes(1);
    expect(sdk.init).toHaveBeenCalledWith("tok-123", expect.objectContaining({ track_pageview: false, persistence: "localStorage", autotrack: false }));
    expect(sdk.track.mock.calls).toEqual([
      ["First", { a: 1 }],
      ["Second", undefined],
    ]);
  });

  it("initMixpanel starts the SDK without sending anything", async () => {
    const mixpanel = await load("tok");
    mixpanel.initMixpanel();
    await settle();
    expect(sdk.init).toHaveBeenCalledTimes(1);
    expect(sdk.track).not.toHaveBeenCalled();
  });

  it("identifies a user and sets traits only when given", async () => {
    const mixpanel = await load("tok");
    mixpanel.identifyUser("u1");
    mixpanel.identifyUser("u2", { plan: "pro" });
    await settle();
    expect(sdk.identify.mock.calls).toEqual([["u1"], ["u2"]]);
    expect(sdk.people.set).toHaveBeenCalledTimes(1);
    expect(sdk.people.set).toHaveBeenCalledWith({ plan: "pro" });
  });

  it("tracks sign-ups and page views under their event names", async () => {
    const mixpanel = await load("tok");
    mixpanel.trackSignUpCompleted({ sign_up_method: "google" });
    mixpanel.trackPageView("/research");
    await settle();
    expect(sdk.track.mock.calls).toEqual([
      ["Sign Up Completed", { sign_up_method: "google" }],
      ["Page Viewed", { path: "/research" }],
    ]);
  });

  it("only resets once the SDK was started this session", async () => {
    const mixpanel = await load("tok");
    mixpanel.resetUser();
    await settle();
    expect(sdk.reset).not.toHaveBeenCalled();

    mixpanel.initMixpanel();
    mixpanel.resetUser();
    await settle();
    expect(sdk.reset).toHaveBeenCalledTimes(1);
  });

  it("logs and carries on when a call into the SDK throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    sdk.track.mockImplementationOnce(() => {
      throw new Error("blocked");
    });
    const mixpanel = await load("tok");
    mixpanel.trackEvent("Bad");
    mixpanel.trackEvent("Good");
    await settle();
    expect(error).toHaveBeenCalledWith("[mixpanel] track failed:", expect.any(Error));
    expect(sdk.track).toHaveBeenLastCalledWith("Good", undefined);
  });

  it("logs and sends nothing when the SDK fails to initialise", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    sdk.init.mockImplementationOnce(() => {
      throw new Error("init failed");
    });
    const mixpanel = await load("tok");
    mixpanel.trackEvent("Lost");
    await settle();
    expect(error).toHaveBeenCalledWith("[mixpanel] init failed:", expect.any(Error));
    expect(sdk.track).not.toHaveBeenCalled();
  });
});
