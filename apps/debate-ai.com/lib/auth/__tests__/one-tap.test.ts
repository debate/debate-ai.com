import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { oneTapClient } from "better-auth/client/plugins";
import {
  ONE_TAP_CLIENT_OPTIONS,
  describeOneTapMoment,
  isBenignOneTapError,
} from "../one-tap";

/**
 * The bug these guard against: Google One Tap failing with `InvalidStateError`
 * — the browser refusing a second federated request while the first is still
 * pending — so a signed-out visitor is never offered a one-tap sign-in.
 *
 * Google's FedCM transition period ended in August 2025. Since then the prompt
 * *is* `navigator.credentials.get()`, one at a time, and the moment reasons
 * better-auth's retry loop looks for are no longer reported. Left on its
 * defaults the plugin therefore reads a final outcome as "unrecognised, try
 * again" and issues a second `get()` over the live one, five times over.
 *
 * See ../one-tap for the whole story.
 */

/** A `google.accounts.id` stub that records how often the prompt is shown. */
function stubGoogleIdentityServices(moment: Record<string, unknown>) {
  const prompt = vi.fn((callback: (moment: unknown) => void) => callback(moment));
  const initialize = vi.fn();

  vi.stubGlobal("window", {
    document: {},
    // Skips the plugin's <script> injection, which has no DOM to attach to.
    googleScriptInitialized: true,
    google: { accounts: { id: { initialize, prompt } } },
  });

  return { prompt, initialize };
}

/**
 * Run the plugin's real `oneTap()` action with this app's options. The action
 * is reached through `getActions` rather than a full auth client so the test
 * stays a plain Node unit test.
 */
async function runOneTap(moment: Record<string, unknown>) {
  const stubs = stubGoogleIdentityServices(moment);
  const plugin = oneTapClient({
    ...ONE_TAP_CLIENT_OPTIONS,
    clientId: "test-client-id.apps.googleusercontent.com",
  });

  const $fetch = vi.fn(async () => ({ data: null, error: null }));
  // `getActions` is typed against better-fetch's client internals; the action
  // under test only touches `$fetch` after a credential comes back, which this
  // test never triggers.
  const actions = (plugin.getActions as unknown as (f: unknown) => { oneTap: (o?: unknown) => Promise<void> })(
    $fetch,
  );

  await actions.oneTap({ callbackURL: "/" });
  return stubs;
}

/** A dismissal whose reason better-auth's own no-retry list does not contain. */
const RETRYING_DISMISSAL = {
  isDismissedMoment: () => true,
  getDismissedReason: () => "flow_restarted",
  isSkippedMoment: () => false,
  isNotDisplayed: () => false,
};

/** What FedCM actually reports for a prompt that never appeared: nothing. */
const FEDCM_SKIP_WITHOUT_REASON = {
  isDismissedMoment: () => false,
  isSkippedMoment: () => true,
  getSkippedReason: () => undefined,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("One Tap client options", () => {
  it("never asks Google to skip FedCM", () => {
    // `additionalOptions` is spread last into `google.accounts.id.initialize`,
    // so anything set there wins over better-auth's own handling — and the one
    // setting worth putting there is a flag Google stopped honouring.
    expect(JSON.stringify(ONE_TAP_CLIENT_OPTIONS)).not.toContain("use_fedcm");
  });

  it("shows the prompt once instead of stacking FedCM requests on retry", async () => {
    const { prompt } = await runOneTap(RETRYING_DISMISSAL);
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it("still resolves when FedCM reports a skip with no reason", async () => {
    const { prompt } = await runOneTap(FEDCM_SKIP_WITHOUT_REASON);
    expect(prompt).toHaveBeenCalledTimes(1);
  });
});

describe("describeOneTapMoment", () => {
  it("treats a reasonless FedCM outcome as final", () => {
    expect(describeOneTapMoment(FEDCM_SKIP_WITHOUT_REASON)).toEqual({
      reason: undefined,
      retryable: false,
    });
  });

  it("keeps a restarted flow retryable on the next page", () => {
    expect(describeOneTapMoment(RETRYING_DISMISSAL)).toEqual({
      reason: "flow_restarted",
      retryable: true,
    });
  });

  it("does not re-prompt someone who closed the prompt", () => {
    expect(
      describeOneTapMoment({
        isDismissedMoment: () => true,
        getDismissedReason: () => "cancel_called",
      }).retryable,
    ).toBe(false);
  });

  it("does not re-prompt after a credential was returned", () => {
    expect(
      describeOneTapMoment({
        isDismissedMoment: () => true,
        getDismissedReason: () => "credential_returned",
      }).retryable,
    ).toBe(false);
  });

  it("survives a notification with none of the methods on it", () => {
    expect(describeOneTapMoment({})).toEqual({ reason: undefined, retryable: false });
    expect(describeOneTapMoment()).toEqual({ reason: undefined, retryable: false });
  });
});

describe("isBenignOneTapError", () => {
  const named = (name: string) => Object.assign(new Error(name), { name });

  it.each(["AbortError", "NetworkError", "NotAllowedError", "InvalidStateError"])(
    "logs %s quietly — it is the browser or the visitor, not this app",
    (name) => {
      expect(isBenignOneTapError(named(name))).toBe(true);
    },
  );

  it("keeps IdentityCredentialError loud — that one is a misconfiguration", () => {
    expect(isBenignOneTapError(named("IdentityCredentialError"))).toBe(false);
  });

  it("keeps anything that is not an Error loud", () => {
    expect(isBenignOneTapError("AbortError")).toBe(false);
  });
});
